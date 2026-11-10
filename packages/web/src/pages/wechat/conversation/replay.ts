import { atom } from "jotai";
import { mainStore } from "@/stateV2/store";

export type ReplaySpeed = "fast" | "normal" | "slow";
export type ReplayView = "full" | "privacy";
export type ReplayPhase = "setup" | "countdown" | "playing" | "paused" | "done";

export type ReplayState = {
	conversationId: string;
	ids: string[];
	view: ReplayView;
	speed: ReplaySpeed;
	countdownSec: 3 | 5 | 10;
	phase: ReplayPhase;
	shown: number;
	typing: boolean;
	/** 下一次点消息改的是起点还是终点 */
	pick: "start" | "end";
};

/** 只存在内存里。播放时不写聊天记录。 */
export const replayAtom = atom<ReplayState | null>(null);

export const armReplay = (conversationId: string, ids: string[]) => {
	mainStore.set(replayAtom, {
		conversationId,
		ids,
		view: "full",
		speed: "normal",
		countdownSec: 10,
		phase: "setup",
		shown: 0,
		typing: false,
		pick: "start",
	});
};

const SPEED = { fast: 0.45, normal: 1, slow: 1.85 };

const charsOf = (item: { type?: string; textContent?: unknown; duration?: number }) => {
	if (item.type === "text") {
		const blocks = (item.textContent ?? []) as { children?: { text?: string }[] }[];
		const n = blocks.map((p) => (p.children ?? []).map((c) => c.text ?? "").join("")).join("").length;
		return Math.max(1, n);
	}
	if (item.type === "voice") return Math.max(4, (item.duration ?? 3) * 4);
	if (item.type === "centerText" || item.type === "transferReceipt" || item.type === "redPacketAcceptedReply") return 2;
	return 8;
};

/** 对方发之前先停一会儿，当「正在输入」；自己的消息短一些。字数越多停得越久。 */
export const holdMs = (item: { type?: string; role?: string; textContent?: unknown; duration?: number }, speed: ReplaySpeed) => {
	const typing = item.role === "friend" && item.type !== "centerText" && item.type !== "transferReceipt" && item.type !== "redPacketAcceptedReply";
	const chars = charsOf(item);
	const base = typing ? Math.min(4200, 900 + chars * 70) : Math.min(1100, 260 + chars * 18);
	return Math.max(typing ? 700 : 220, Math.round(base * SPEED[speed]));
};

export const showsTyping = (item: { type?: string; role?: string }) =>
	item.role === "friend" && item.type !== "centerText" && item.type !== "transferReceipt" && item.type !== "redPacketAcceptedReply";

/** 在当前顺序里，把点到的那条设成起点或终点，中间的消息按原顺序保留（转账和收款不会被拆开）。 */
export const retarget = (state: ReplayState, id: string, order: string[]) => {
	const pos = (x: string) => order.indexOf(x);
	let start = state.ids[0] ?? id;
	let end = state.ids[state.ids.length - 1] ?? id;
	if (state.pick === "start") start = id;
	else end = id;
	if (pos(start) < 0) start = id;
	if (pos(end) < 0) end = id;
	if (pos(start) > pos(end)) [start, end] = [end, start];
	return order.slice(pos(start), pos(end) + 1);
};
