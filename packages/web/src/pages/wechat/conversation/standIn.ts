import { fromLastGenerateUpperText, setConversationListValue, type TConversationItem, EConversationType } from "@/stateV2/conversation";
import { getDialogueListValueSnapshot, setDialogueListValue } from "@/stateV2/dialogueList";
import { touchDialogue } from "@/stateV2/fileHelper";
import { isGroupId } from "@/stateV2/group";
import atomWithStorage from "@/stateV2/atomWithStorage";
import { mainStore } from "@/stateV2/store";
import { callGemini } from "@/utils/gemini";
import { textToSlateChildren } from "@/wechatComponents/SlateText/emojiNames";
import { showToast } from "@/wechatComponents/Toast";
import dayjs from "dayjs";
import { atom } from "jotai";
import { nanoid } from "nanoid";
import { chatLog, listContacts } from "@/pages/wechat/my/settings/aiChatTools";
import { personaSystemExtra, readPersona } from "./persona";

/** 哪些单聊开启了 AI 代回。编辑模式开关和私人 AI 共用，持久化。聊天页不因此多出标识。 */
export const standInAtom = atomWithStorage<Record<string, boolean>>("ai-stand-in", {});

/** 编辑模式「AI代回」和私人 AI 的 setAutoReply 都走这里。 */
export const writeStandIn = (conversationId: string, on: boolean) => {
	if (isGroupId(conversationId)) throw new Error("群聊不能开代聊");
	const cur = mainStore.get(standInAtom);
	if (!!cur[conversationId] === on) return;
	mainStore.set(standInAtom, { ...cur, [conversationId]: on });
};

/** 代回等待时，标题栏复用「对方正在输入…」 */
export const standInTypingAtom = atom<Record<string, boolean>>({});

/** 代回节奏（毫秒）。私人 AI 不走这里。 */
const PACE = {
	readMin: 500,
	readMax: 1500,
	firstPerCharMin: 80,
	firstPerCharMax: 120,
	firstTypeMax: 3000,
	laterPerCharMin: 180,
	laterPerCharMax: 250,
	laterMin: 1500,
	laterMax: 7000,
	/** 连发间隔在基准时间上再乘这一档 */
	gapJitter: 0.3,
	nameGapMin: 300,
	nameGapMax: 800,
} as const;

const chain = new Map<string, Promise<void>>();
const controllers = new Map<string, AbortController>();
const typingOwner = new Map<string, number>();
let seq = 0;

const span = (min: number, max: number) => min + Math.random() * (max - min);

const charCount = (text: string) => Array.from(text).length;

/** 第一条：按字数，上限 3 秒，不加抖动。 */
const firstTypeMs = (text: string) => {
	const chars = Math.max(1, charCount(text));
	return Math.min(PACE.firstTypeMax, Math.round(chars * span(PACE.firstPerCharMin, PACE.firstPerCharMax)));
};

/** 第二条起：按字数，至少 1.5 秒，最多约 7 秒，再 ±30%。 */
const laterGapMs = (text: string) => {
	const chars = Math.max(1, charCount(text));
	const raw = chars * span(PACE.laterPerCharMin, PACE.laterPerCharMax);
	const base = Math.min(PACE.laterMax, Math.max(PACE.laterMin, raw));
	const jittered = base * (1 + span(-PACE.gapJitter, PACE.gapJitter));
	return Math.round(Math.min(PACE.laterMax, Math.max(PACE.laterMin, jittered)));
};

/** 很短的消息大约一半不显示「正在输入」。 */
const wantsTyping = (text: string) => charCount(text) > 6 || Math.random() >= 0.5;

const viewingChat = (id: string) => {
	const path = (window.location.hash.replace(/^#/, "") || window.location.pathname).split("?")[0].replace(/\/$/, "");
	return path === `/wechat/conversation/${id}`;
};

/** 和自己发消息一样更新首页预览、时间、排序；人不在这个聊天里时再加一条未读。 */
const noteHome = (conversationId: string, preview: string) => {
	const here = viewingChat(conversationId);
	const prevN = getDialogueListValueSnapshot().find((v) => v.friendId === conversationId)?.unreadMarkNumber ?? 0;
	touchDialogue(conversationId, preview);
	if (here) return;
	setDialogueListValue((prev) =>
		prev.map((v) => (v.friendId === conversationId ? { ...v, unreadMarkNumber: prevN + 1, unreadDisplayType: "number" } : v)),
	);
};

const stopped = (e: unknown, signal: AbortSignal) => signal.aborted || (e instanceof Error && e.name === "AbortError");

const sleep = (ms: number, signal: AbortSignal) =>
	new Promise<void>((resolve, reject) => {
		if (signal.aborted) {
			reject(new DOMException("已停止", "AbortError"));
			return;
		}
		const timer = window.setTimeout(() => {
			signal.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			window.clearTimeout(timer);
			reject(new DOMException("已停止", "AbortError"));
		};
		signal.addEventListener("abort", onAbort, { once: true });
	});

const setTyping = (conversationId: string, on: boolean) => {
	const prev = mainStore.get(standInTypingAtom);
	if (!!prev[conversationId] === on) return;
	const next = { ...prev };
	if (on) next[conversationId] = true;
	else delete next[conversationId];
	mainStore.set(standInTypingAtom, next);
};

const run = async (conversationId: string, token: number, signal: AbortSignal) => {
	try {
		if (signal.aborted || typingOwner.get(conversationId) !== token) return;
		if (!mainStore.get(standInAtom)[conversationId] || isGroupId(conversationId)) return;
		setTyping(conversationId, false);
		const contact = listContacts().find((c) => c.id === conversationId);
		const name = contact?.name ?? "对方";
		const readFor = span(PACE.readMin, PACE.readMax);
		const started = Date.now();
		const card = await readPersona(conversationId);
		const log = chatLog(conversationId, name, 40);
		if (signal.aborted || typingOwner.get(conversationId) !== token) return;
		const reply = await callGemini("我刚发来一条消息。请只用这个好友以往的语气回复，1 到 3 条，每条一行，不要解释，不要代码块。", {
			system: `你在扮演微信好友「${name}」。下面是你们的聊天，最后几条是刚发生的。按这个人的口气回，短句，口语。\n${log.text}${personaSystemExtra(card)}`,
			windowKey: `standin:${conversationId}`,
			signal,
		});
		const rest = readFor - (Date.now() - started);
		if (rest > 0) await sleep(rest, signal);
		const lines = reply
			.replace(/```[\s\S]*?```/g, "")
			.split(/\n+/)
			.map((s) => s.replace(/^[\d.、\-\s]+/, "").trim())
			.filter((s) => s && !s.startsWith("```"))
			.slice(0, 3);
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (i === 0) {
				if (wantsTyping(line)) setTyping(conversationId, true);
				await sleep(firstTypeMs(line), signal);
			} else {
				setTyping(conversationId, false);
				const gap = laterGapMs(line);
				const pause = Math.min(gap, Math.round(span(PACE.nameGapMin, PACE.nameGapMax)));
				await sleep(pause, signal);
				if (signal.aborted || typingOwner.get(conversationId) !== token) return;
				if (!mainStore.get(standInAtom)[conversationId]) return;
				if (wantsTyping(line)) setTyping(conversationId, true);
				await sleep(gap - pause, signal);
			}
			if (signal.aborted || typingOwner.get(conversationId) !== token) return;
			if (!mainStore.get(standInAtom)[conversationId]) return;
			setTyping(conversationId, false);
			setConversationListValue(conversationId, (prev) => [
				...prev,
				{
					id: nanoid(8),
					type: EConversationType.text,
					role: "friend",
					textContent: [{ type: "paragraph", children: textToSlateChildren(line) }],
					sendTimestamp: dayjs().valueOf(),
					upperText: fromLastGenerateUpperText(prev),
				} as TConversationItem,
			]);
			noteHome(conversationId, line);
		}
	} catch (e) {
		if (stopped(e, signal)) return;
		showToast({ content: e instanceof Error ? e.message : "AI 代回失败" });
	} finally {
		if (controllers.get(conversationId)?.signal === signal) controllers.delete(conversationId);
		if (typingOwner.get(conversationId) === token) {
			typingOwner.delete(conversationId);
			setTyping(conversationId, false);
		}
	}
};

/** 用户以「我」发出一条后调用。新消息会打断还在读/打字的上一条回复。 */
export const replyAsFriend = (conversationId: string) => {
	if (!mainStore.get(standInAtom)[conversationId]) return;
	controllers.get(conversationId)?.abort();
	const ctrl = new AbortController();
	controllers.set(conversationId, ctrl);
	const token = ++seq;
	typingOwner.set(conversationId, token);
	setTyping(conversationId, false);
	const prev = chain.get(conversationId) ?? Promise.resolve();
	const next = prev.catch(() => undefined).then(() => run(conversationId, token, ctrl.signal));
	chain.set(conversationId, next);
};
