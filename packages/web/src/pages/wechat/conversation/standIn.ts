import { fromLastGenerateUpperText, setConversationListValue, type TConversationItem, EConversationType } from "@/stateV2/conversation";
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

/** 编辑模式下，哪些聊天开启了「AI 代回」 */
export const standInAtom = atomWithStorage<Record<string, boolean>>("ai-stand-in", {});

/** 代回等待时，标题栏复用「对方正在输入…」 */
export const standInTypingAtom = atom<Record<string, boolean>>({});

/** 代回节奏（毫秒）。私人 AI 不走这里。 */
const PACE = {
	readMin: 2000,
	readMax: 6000,
	perCharMin: 250,
	perCharMax: 400,
	typeMax: 12000,
	burstGapMin: 1500,
} as const;

const chain = new Map<string, Promise<void>>();
const controllers = new Map<string, AbortController>();
const typingOwner = new Map<string, number>();
let seq = 0;

const span = (min: number, max: number) => min + Math.random() * (max - min);

const typeMs = (text: string) => {
	const chars = Math.max(1, Array.from(text).length);
	return Math.min(PACE.typeMax, Math.round(chars * span(PACE.perCharMin, PACE.perCharMax)));
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
		setTyping(conversationId, true);
		const contact = listContacts().find((c) => c.id === conversationId);
		const name = contact?.name ?? "对方";
		const log = chatLog(conversationId, name, 40);
		const readFor = span(PACE.readMin, PACE.readMax);
		const started = Date.now();
		const reply = await callGemini("我刚发来一条消息。请只用这个好友以往的语气回复，1 到 3 条，每条一行，不要解释，不要代码块。", {
			system: `你在扮演微信好友「${name}」。下面是你们的聊天，最后几条是刚发生的。按这个人的口气回，短句，口语。\n${log.text}`,
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
			const gap = i === 0 ? typeMs(line) : Math.max(typeMs(line), PACE.burstGapMin);
			await sleep(gap, signal);
			if (signal.aborted || typingOwner.get(conversationId) !== token) return;
			if (!mainStore.get(standInAtom)[conversationId]) return;
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
	setTyping(conversationId, true);
	const prev = chain.get(conversationId) ?? Promise.resolve();
	const next = prev.catch(() => undefined).then(() => run(conversationId, token, ctrl.signal));
	chain.set(conversationId, next);
};
