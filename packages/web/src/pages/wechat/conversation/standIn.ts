import { fromLastGenerateUpperText, getConversationListValueSnapshot, setConversationListValue, type TConversationItem, EConversationType } from "@/stateV2/conversation";
import { getDialogueListValueSnapshot, setDialogueListValue } from "@/stateV2/dialogueList";
import { touchDialogue } from "@/stateV2/fileHelper";
import { isGroupId } from "@/stateV2/group";
import atomWithStorage from "@/stateV2/atomWithStorage";
import { mainStore } from "@/stateV2/store";
import { callGemini } from "@/utils/gemini";
import { slateToPlain, textToSlateChildren } from "@/wechatComponents/SlateText/emojiNames";
import { showToast } from "@/wechatComponents/Toast";
import dayjs from "dayjs";
import { atom } from "jotai";
import { nanoid } from "nanoid";
import { chatLog, listContacts } from "@/pages/wechat/my/settings/aiChatTools";
import { personaSystemExtra, readPersona } from "./persona";

/** 哪些单聊开启了 AI 代聊。编辑模式开关和私人 AI 共用，持久化。聊天页不因此多出标识。 */
export const standInAtom = atomWithStorage<Record<string, boolean>>("ai-stand-in", {});

/** 编辑模式「AI代聊」和私人 AI 的 setAutoReply 都走这里。 */
export const writeStandIn = (conversationId: string, on: boolean) => {
	if (isGroupId(conversationId)) throw new Error("群聊不能开代聊");
	const cur = mainStore.get(standInAtom);
	if (!!cur[conversationId] === on) return;
	mainStore.set(standInAtom, { ...cur, [conversationId]: on });
};

/** 代聊等待时，标题栏复用「对方正在输入…」 */
export const standInTypingAtom = atom<Record<string, boolean>>({});

/** 代聊节奏（毫秒）：模拟真人看消息、打字、停顿。私人 AI 不走这里。 */
const PACE = {
	/** 看到消息到开始打字的反应时间 */
	readMin: 1200,
	readMax: 3200,
	/** 每看一个字多花的时间（上限 2 秒） */
	readPerChar: 35,
	/** 打字：起手 + 每字耗时（拼音打字，比想象的慢） */
	typeBase: 1100,
	typePerCharMin: 230,
	typePerCharMax: 380,
	typeMax: 16000,
	/** 连发第二、三条前的停顿 */
	nextIdleMin: 500,
	nextIdleMax: 1800,
} as const;

/** 这次回几条：先按对方这句话的长短、是不是在提问来随机，模型遇到特殊情况可以自己多/少一条。 */
const pickCount = (lastMine: string) => {
	const n = charCount(lastMine);
	const asks = (lastMine.match(/[?？]/g) ?? []).length;
	const w = n <= 4 ? [0.72, 0.22, 0.06] : n > 40 || asks >= 2 ? [0.2, 0.45, 0.35] : [0.5, 0.35, 0.15];
	const r = Math.random();
	return r < w[0] ? 1 : r < w[0] + w[1] ? 2 : 3;
};

const plainText = (it: TConversationItem) => {
	const c = (it as { textContent?: unknown[] }).textContent;
	return it.type === EConversationType.text && Array.isArray(c) ? c.map((n) => slateToPlain(n as never)).join("") : "";
};

const chain = new Map<string, Promise<void>>();
const controllers = new Map<string, AbortController>();
const typingOwner = new Map<string, number>();
let seq = 0;

const span = (min: number, max: number) => min + Math.random() * (max - min);

const charCount = (text: string) => Array.from(text).length;

/** 一条消息要打多久：起手 + 每字 230~380ms，再 ±25%；很短的几个字 1~2 秒，最长 16 秒。 */
const typeMs = (text: string, later = false) => {
	const chars = Math.max(1, charCount(text));
	const raw = chars <= 4 ? span(900, 2200) : PACE.typeBase + chars * span(PACE.typePerCharMin, PACE.typePerCharMax);
	return Math.round(Math.min(PACE.typeMax, raw * span(0.75, 1.25) * (later ? 0.8 : 1)));
};

/** 很短的消息大约一半不显示「正在输入」；其余都显示。 */
const wantsTyping = (text: string) => charCount(text) > 4 || Math.random() >= 0.5;

/** 打字这段时间里，「正在输入」不是一直亮着：打一阵、停一下（想想/删改）、再打。 */
const typeFor = async (conversationId: string, total: number, show: boolean, signal: AbortSignal, alive: () => boolean) => {
	if (!show || total < 4500) {
		if (show) setTyping(conversationId, true);
		await sleep(total, signal);
		return;
	}
	let left = total;
	while (left > 0) {
		const on = Math.min(left, span(2200, 5500));
		setTyping(conversationId, true);
		await sleep(on, signal);
		left -= on;
		if (left <= 0 || !alive()) break;
		const off = Math.min(left, span(500, 1700));
		setTyping(conversationId, false);
		await sleep(off, signal);
		left -= off;
	}
};

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
		const started = Date.now();
		const card = await readPersona(conversationId);
		const log = chatLog(conversationId, name, 60);
		if (signal.aborted || typingOwner.get(conversationId) !== token) return;
		const list = getConversationListValueSnapshot(conversationId);
		const mineTexts = list.filter((v) => v.role === "mine" && plainText(v)).map(plainText);
		const lastMine = mineTexts.at(-1) ?? "";
		const myRecent = mineTexts.slice(-3).join(" / ");
		const said = list.filter((v) => v.role === "friend" && plainText(v)).slice(-10).map(plainText);
		const readFor = span(PACE.readMin, PACE.readMax) + Math.min(2000, charCount(lastMine) * PACE.readPerChar);
		const want = pickCount(lastMine);
		const reply = await callGemini(`对方（我）刚发来：${myRecent || lastMine}\n请像${name}本人那样回复。`, {
			system: `你在扮演微信好友「${name}」，和对方真人聊天。下面是你们的聊天，最后几条是刚发生的。现在是 ${dayjs().format("HH:mm")}。
要求：
1. 像真人发微信：口语、短句、有情绪，可以有错别字感、省略号、语气词，不要客服腔，不要总结，不要解释。
2. 这次默认回 ${want} 条，每条单独一行。只有情况明显需要时才多或少一条（比如对方很激动、连问几个问题、你有话要补充时多一条；对方只是"嗯""哦""好"时 1 条甚至很短的几个字就够），最多 3 条。大多数时候 1~2 条就好，不要每次都 3 条。
3. 每条长短不一，不要整齐划一；不要每次都用同样的开头和句式。${said.length ? `\n4. 你最近说过这些，别重复它们的说法、口头禅和句式：\n${said.map((x) => `- ${x}`).join("\n")}` : ""}
5. 只输出要发的内容，每条一行，不要编号，不要引号，不要代码块。
${log.text}${personaSystemExtra(card)}`,
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
		const alive = () => !signal.aborted && typingOwner.get(conversationId) === token && !!mainStore.get(standInAtom)[conversationId];
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (i > 0) {
				setTyping(conversationId, false);
				await sleep(span(PACE.nextIdleMin, PACE.nextIdleMax), signal);
				if (!alive()) return;
			}
			await typeFor(conversationId, typeMs(line, i > 0), wantsTyping(line), signal, alive);
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
		showToast({ content: e instanceof Error ? e.message : "AI 代聊失败" });
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
