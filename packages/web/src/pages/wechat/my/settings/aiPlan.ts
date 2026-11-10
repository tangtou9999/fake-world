import { addFriendByMe } from "@/stateV2/friendRequests";
import { type IStateFeed, setFeedListValue } from "@/stateV2/moments";
import { getProfileValueSnapshot, setProfileValue } from "@/stateV2/profile";
import { getWalletVauleSnapshot, walletAtom } from "@/stateV2/wallet";
import { mainStore } from "@/stateV2/store";
import { EConversationType, getConversationListValueSnapshot, setConversationListValue } from "@/stateV2/conversation";
import { applyParsedItems, previewLine, type ParsedItem } from "@/pages/wechat/conversation/ConversationFooter/importScreenshots";
import { exportConversationPng } from "@/pages/wechat/conversation/LongShot";
import { slateToPlain, textToSlateChildren } from "@/wechatComponents/SlateText/emojiNames";
import { parseJsonLoose } from "@/utils/gemini";
import { parseAt } from "@/utils/parseAt";
import dayjs from "dayjs";
import { nanoid } from "nanoid";
import { armReplay } from "@/pages/wechat/conversation/replay";
import { writeStandIn } from "@/pages/wechat/conversation/standIn";
import { applyAction, listContacts, personaPatchFrom, previewSetPersona, resolveTarget, setPersona, type PersonaPatch } from "./aiChatTools";
import { shiftTimes } from "./chatOps";

export type PlanStep =
	| { do: "chat"; target: string; mode: "append" | "replace" | "range"; from?: string; to?: string; items: ParsedItem[] }
	| { do: "wallet"; balance?: string; miniFund?: string; business?: string }
	| { do: "moment"; target: string; text: string; at?: string }
	| { do: "profile"; target: string; remark?: string; nickname?: string; signature?: string; area?: string; description?: string }
	| { do: "setPersona"; target: string; patch: PersonaPatch }
	| { do: "setAutoReply"; target: string; on: boolean }
	| { do: "friend"; nickname: string; avatar?: string; greeting?: string; items?: ParsedItem[]; moment?: string }
	| { do: "shot"; target: string; query?: string; from?: string; to?: string }
	| { do: "timeline"; target: string; days?: number; hours?: number; minutes?: number; evening?: boolean }
	| { do: "replay"; target: string; query?: string; from?: string; to?: string };

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const asItems = (v: unknown) => (Array.isArray(v) ? (v as ParsedItem[]) : []);

/** 解析私人 AI 回复末尾的 ```wxplan 代码块。没有这个块就不会写入任何数据。 */
export const parsePlan = (raw: string): { text: string; plan?: { steps: PlanStep[] } } => {
	const m = raw.match(/```wxplan\s*([\s\S]*?)```/);
	const text = raw.replace(/```wxplan[\s\S]*?(```|$)/g, "").trim();
	if (!m) return { text };
	try {
		const j = parseJsonLoose<{ steps?: Record<string, unknown>[] }>(m[1]);
		const steps: PlanStep[] = [];
		for (const s of Array.isArray(j.steps) ? j.steps : []) {
			const target = String(s.target ?? "");
			if (s.do === "chat" && asItems(s.items).length) {
				const mode = s.mode === "replace" ? "replace" : s.mode === "range" ? "range" : "append";
				steps.push({ do: "chat", target, mode, from: s.from ? String(s.from) : undefined, to: s.to ? String(s.to) : undefined, items: asItems(s.items) });
			} else if (s.do === "wallet" && (s.balance || s.miniFund || s.business)) {
				steps.push({ do: "wallet", balance: s.balance ? String(s.balance) : undefined, miniFund: s.miniFund ? String(s.miniFund) : undefined, business: s.business ? String(s.business) : undefined });
			} else if (s.do === "moment" && s.text) {
				steps.push({ do: "moment", target, text: String(s.text), at: s.at ? String(s.at) : undefined });
			} else if (s.do === "profile" && target) {
				steps.push({ do: "profile", target, remark: s.remark as string, nickname: s.nickname as string, signature: s.signature as string, area: s.area as string, description: s.description as string });
			} else if (s.do === "setPersona" && target) {
				const patch = personaPatchFrom(s);
				if (patch) steps.push({ do: "setPersona", target, patch });
			} else if (s.do === "setAutoReply" && target && s.on !== undefined && s.on !== null) {
				const v = s.on;
				const on = v === true || v === 1 || v === "1" || v === "true" || v === "on" || v === "开启";
				const off = v === false || v === 0 || v === "0" || v === "false" || v === "off" || v === "关闭";
				if (on || off) steps.push({ do: "setAutoReply", target, on });
			} else if (s.do === "friend" && s.nickname) {
				steps.push({ do: "friend", nickname: String(s.nickname), avatar: s.avatar ? String(s.avatar) : undefined, greeting: s.greeting ? String(s.greeting) : undefined, items: asItems(s.items), moment: s.moment ? String(s.moment) : undefined });
			} else if (s.do === "shot" && target) {
				steps.push({ do: "shot", target, query: s.query ? String(s.query) : undefined, from: s.from ? String(s.from) : undefined, to: s.to ? String(s.to) : undefined });
			} else if (s.do === "timeline" && target && (s.evening === true || num(s.days) || num(s.hours) || num(s.minutes))) {
				steps.push({ do: "timeline", target, days: num(s.days), hours: num(s.hours), minutes: num(s.minutes), evening: s.evening === true });
			} else if (s.do === "replay" && target) {
				steps.push({ do: "replay", target, query: s.query ? String(s.query) : undefined, from: s.from ? String(s.from) : undefined, to: s.to ? String(s.to) : undefined });
			}
		}
		if (!steps.length) return { text: `${text}\n\n（AI 附上的操作里没有可执行的内容，什么都没改。）` };
		return { text, plan: { steps } };
	} catch {
		return { text: `${text}\n\n（AI 附上的操作格式有误，没能识别，什么都没改。）` };
	}
};

const plain = (item: { type?: string; textContent?: unknown[]; simpleContent?: string; amount?: string; note?: string; stt?: string }) => {
	if (item.type === EConversationType.text) return (item.textContent ?? []).map((n) => slateToPlain(n as never)).join("");
	if (item.type === EConversationType.centerText) return item.simpleContent ?? "";
	if (item.type === EConversationType.voice) return item.stt ?? "";
	if (item.type === EConversationType.transfer || item.type === EConversationType.redPacket) return `${item.note ?? ""} ${item.amount ?? ""}`;
	return "";
};

export const locateMessages = (conversationId: string, step: { query?: string; from?: string; to?: string }) => {
	const list = getConversationListValueSnapshot(conversationId);
	const from = parseAt(step.from);
	const to = parseAt(step.to);
	if (from !== null && to !== null) {
		const end = dayjs(to).endOf("minute").valueOf();
		return list.filter((v) => (v.sendTimestamp ?? 0) >= from && (v.sendTimestamp ?? 0) <= end).map((v) => v.id);
	}
	const q = step.query?.trim();
	if (!q) return list.map((v) => v.id);
	const hits = list.map((v, i) => ({ v, i })).filter(({ v }) => plain(v as never).includes(q));
	if (!hits.length) return [];
	return list.slice(hits[0].i, hits[hits.length - 1].i + 1).map((v) => v.id);
};

const who = (target: string) => resolveTarget(target, listContacts())?.name || target || "对方";

export const describeStep = (step: PlanStep) => {
	switch (step.do) {
		case "chat":
			return `${step.mode === "replace" ? "清空并重写" : step.mode === "range" ? `改写 ${step.from ?? ""} ~ ${step.to ?? ""}` : "按时间插入"}「${who(step.target)}」的聊天，${step.items.length} 条。${step.items.slice(0, 3).map((it) => previewLine(it)).join("；")}`;
		case "wallet":
			return `零钱余额改为 ¥${step.balance ?? "（不动）"}${step.miniFund ? `，零钱通 ¥${step.miniFund}` : ""}${step.business ? `，经营账户 ¥${step.business}` : ""}`;
		case "moment":
			return `给「${who(step.target)}」发一条朋友圈：${step.text.slice(0, 40)}`;
		case "profile":
			return `改「${who(step.target)}」的资料${step.remark ? `，备注「${step.remark}」` : ""}${step.signature ? `，签名「${step.signature}」` : ""}${step.nickname ? `，昵称「${step.nickname}」` : ""}`;
		case "setPersona":
			return previewSetPersona(who(step.target), resolveTarget(step.target, listContacts())?.id, step.patch);
		case "setAutoReply":
			return `${step.on ? "开启" : "关闭"}「${who(step.target)}」的 AI 代聊。确认后，去和对方聊天就会${step.on ? "自动回复" : "不再自动回复"}`;
		case "friend":
			return `按添加好友创建「${step.nickname}」${step.avatar ? "" : "（素材库还没有，头像用文字头像）"}，并写入 ${step.items?.length ?? 0} 条聊天${step.moment ? "，再发一条朋友圈" : ""}`;
		case "shot": {
			const id = resolveTarget(step.target, listContacts())?.id;
			const n = id ? locateMessages(id, step).length : 0;
			return `给「${who(step.target)}」导出长图${step.query ? `，定位「${step.query}」` : ""}${n ? `，约 ${n} 条` : ""}`;
		}
		case "timeline": {
			const bits = [
				step.days ? `${step.days > 0 ? "推后" : "提前"} ${Math.abs(step.days)} 天` : "",
				step.hours ? `${step.hours > 0 ? "推后" : "提前"} ${Math.abs(step.hours)} 小时` : "",
				step.evening ? "改到晚上" : "",
			].filter(Boolean);
			return `「${who(step.target)}」整段时间线：${bits.join("，") || "调整"}。顺序不变，收款记录一起移动`;
		}
		case "replay": {
			const id = resolveTarget(step.target, listContacts())?.id;
			const n = id ? locateMessages(id, step).length : 0;
			return `回放「${who(step.target)}」${step.query ? `里和「${step.query}」有关的` : step.from ? ` ${step.from} ~ ${step.to ?? ""}` : ""}这一段${n ? `，约 ${n} 条` : ""}。到聊天里确认首尾，不会改记录`;
		}
	}
};

const yuan = (v?: string) => (v && Number.isFinite(Number.parseFloat(v)) ? Number.parseFloat(v).toFixed(2) : undefined);

const postMoment = (userId: string, text: string, at?: string) => {
	const ts = Math.min(parseAt(at) ?? Date.now(), Date.now());
	const item: IStateFeed = {
		id: nanoid(8),
		userId,
		sendTimestamp: ts,
		content: { type: "text", text: text.split("\n").map((line) => ({ type: "paragraph", children: textToSlateChildren(line) })) as never },
	};
	setFeedListValue((prev) => [item, ...prev].sort((a, b) => b.sendTimestamp - a.sendTimestamp));
};

const needId = (target: string) => {
	const hit = resolveTarget(target, listContacts());
	if (!hit) throw new Error(`找不到「${target}」`);
	return hit.id;
};

/** 点「确认执行」后才调用。聊天、转账红包走原来的写入；钱包和朋友圈走手动编辑同一套存储。enableReply 会在人设写入后打开代聊。 */
export const applyPlan = async (steps: PlanStep[], opts?: { enableReply?: boolean }) => {
	const lines: string[] = [];
	const enableIds: string[] = [];
	let shot = "";
	let goto = "";
	for (const step of steps) {
		if (step.do === "chat") {
			const id = needId(step.target);
			const res = applyAction(id, { target: step.target, mode: step.mode, from: step.from, to: step.to, items: step.items });
			lines.push(`「${who(step.target)}」的聊天已写入 ${res.applied} 条${res.notes.length ? `（${res.notes.join("；")}）` : ""}`);
		} else if (step.do === "wallet") {
			const cur = getWalletVauleSnapshot();
			const balance = yuan(step.balance) ?? cur.balance;
			const miniFund = yuan(step.miniFund) ?? cur.miniFund;
			const business = yuan(step.business) ?? cur.business;
			mainStore.set(walletAtom, { ...cur, balance, miniFund, business });
			lines.push(`零钱余额已改为 ¥${balance}`);
		} else if (step.do === "moment") {
			postMoment(step.target ? needId(step.target) : "0", step.text, step.at);
			lines.push(`已给「${who(step.target)}」发朋友圈`);
		} else if (step.do === "profile") {
			const id = needId(step.target);
			const prev = getProfileValueSnapshot(id);
			if (!prev) throw new Error(`找不到「${step.target}」`);
			setProfileValue(id, {
				...prev,
				...(step.remark !== undefined ? { remark: step.remark } : {}),
				...(step.nickname ? { nickname: step.nickname } : {}),
				...(step.signature !== undefined ? { signature: step.signature } : {}),
				...(step.area !== undefined ? { area: step.area } : {}),
				...(step.description !== undefined ? { description: step.description } : {}),
			});
			lines.push(`已更新「${who(step.target)}」的资料`);
		} else if (step.do === "setPersona") {
			const id = needId(step.target);
			await setPersona(id, step.patch);
			if (opts?.enableReply) enableIds.push(id);
			lines.push(`已更新「${who(step.target)}」的人设卡${opts?.enableReply ? "，并开启代聊" : ""}`);
		} else if (step.do === "setAutoReply") {
			const id = needId(step.target);
			writeStandIn(id, step.on);
			lines.push(`已${step.on ? "开启" : "关闭"}「${who(step.target)}」的 AI 代聊`);
		} else if (step.do === "friend") {
			const id = addFriendByMe({ nickname: step.nickname, wechat: step.nickname, avatarInfo: step.avatar || "", greeting: step.greeting || "你好" });
			if (step.items?.length) {
				// 开场白已经按「添加好友」写好。剧情按每条自己的日期插入，先清掉开场白，避免被挤到现在。
				setConversationListValue(id, []);
				const res = applyParsedItems(id, step.items, false, true);
				lines.push(`已添加「${step.nickname}」，写入 ${res.applied} 条聊天`);
			} else lines.push(`已添加「${step.nickname}」`);
			if (step.moment) postMoment(id, step.moment);
		} else if (step.do === "timeline") {
			const id = needId(step.target);
			let count = 0;
			setConversationListValue(id, (prev) => {
				const list = prev.map((v) => ({ ...v })) as Record<string, any>[];
				const next = shiftTimes(list, { op: "shift", days: step.days, hours: step.hours, minutes: step.minutes, evening: step.evening });
				count = next.length;
				return next as never;
			});
			lines.push(`已调整「${who(step.target)}」的时间线（${count} 条）`);
		} else if (step.do === "shot") {
			const id = needId(step.target);
			const ids = locateMessages(id, step);
			if (!ids.length) throw new Error(`「${step.target}」里没有对得上的消息`);
			shot = await exportConversationPng(id, ids);
			lines.push(`已生成「${who(step.target)}」的长图，共 ${ids.length} 条`);
		} else if (step.do === "replay") {
			const id = needId(step.target);
			const ids = locateMessages(id, step);
			if (!ids.length) throw new Error(`「${step.target}」里没有对得上的消息`);
			armReplay(id, ids);
			goto = id;
			lines.push(`已标出「${who(step.target)}」的 ${ids.length} 条，到聊天里确认后再播放`);
		}
	}
	for (const id of enableIds) writeStandIn(id, true);
	return { summary: lines.join("；"), shot, goto };
};
