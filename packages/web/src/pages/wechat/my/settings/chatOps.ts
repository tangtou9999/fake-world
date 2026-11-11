import { EConversationType, type TConversationItem, formatWechatTime, getConversationListValueSnapshot, setConversationListValue } from "@/stateV2/conversation";
import { moneyOverLimit, settleRedPacket, settleTransfer } from "@/stateV2/conversation/records";
import { textToSlateChildren } from "@/wechatComponents/SlateText/emojiNames";
import { parseJsonLoose } from "@/utils/gemini";
import dayjs from "dayjs";
import { parseAt } from "@/utils/parseAt";

export type ChatOp =
	| { op: "delete"; ids: string[] }
	| { op: "setTime"; id: string; at: string }
	| { op: "edit"; id: string; text?: string; amount?: string; note?: string; status?: string; seconds?: number; at?: string; scene?: string; pace?: string; tone?: string; read?: boolean }
	| { op: "shift"; days?: number; hours?: number; minutes?: number; evening?: boolean; ids?: string[] }
	| { op: "replay"; query?: string; from?: string; to?: string };

export type OpsAction = { target: string; targetId?: string; ops: ChatOp[]; applied?: string };

/** 解析 AI 回复末尾的 ```wxops 代码块 */
export const parseOps = (raw: string): { text: string; ops?: OpsAction } => {
	const m = raw.match(/```wxops\s*([\s\S]*?)```/);
	const text = raw.replace(/```wxops[\s\S]*?(```|$)/g, "").trim();
	if (!m) return { text };
	try {
		const j = parseJsonLoose<{ target?: string; ops?: unknown[] }>(m[1]);
		const ops: ChatOp[] = [];
		for (const o of (Array.isArray(j.ops) ? j.ops : []) as Record<string, unknown>[]) {
			if (o?.op === "delete") {
				const ids = (Array.isArray(o.ids) ? o.ids : [o.id]).map((v) => String(v ?? "").replace(/^#/, "")).filter(Boolean);
				if (ids.length) ops.push({ op: "delete", ids });
			} else if ((o?.op === "setTime" || o?.op === "move") && o.id && o.at) {
				ops.push({ op: "setTime", id: String(o.id).replace(/^#/, ""), at: String(o.at) });
			} else if (o?.op === "edit" && o.id) {
				ops.push({ op: "edit", id: String(o.id).replace(/^#/, ""), text: o.text as string, amount: o.amount as string, note: o.note as string, status: o.status as string, seconds: o.seconds as number, at: o.at as string, scene: o.scene as string, pace: o.pace as string, tone: o.tone as string, read: typeof o.read === "boolean" ? o.read : undefined });
			} else if (o?.op === "shift") {
				const ids = (Array.isArray(o.ids) ? o.ids : []).map((v) => String(v ?? "").replace(/^#/, "")).filter(Boolean);
				const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
				const evening = o.evening === true;
				const days = num(o.days);
				const hours = num(o.hours);
				const minutes = num(o.minutes);
				if (evening || days || hours || minutes) ops.push({ op: "shift", days, hours, minutes, evening, ...(ids.length ? { ids } : {}) });
			} else if (o?.op === "replay") {
				ops.push({ op: "replay", query: o.query ? String(o.query) : undefined, from: o.from ? String(o.from) : undefined, to: o.to ? String(o.to) : undefined });
			}
		}
		if (!ops.length) return { text: `${text}\n\n（AI 附上的修改指令里没有可执行的内容，请让它重新输出）` };
		return { text, ops: { target: String(j.target ?? ""), ops } };
	} catch {
		return { text: `${text}\n\n（AI 附上的修改指令格式有误，没能识别，请让它重新输出一次）` };
	}
};

const plainOf = (v: TConversationItem) => {
	const r = v as unknown as Record<string, any>;
	switch (v.type) {
		case EConversationType.text:
			return (r.textContent ?? []).map((n: any) => (n.children ?? []).map((c: any) => c.text ?? (c.emojiSymbol ? "[表情]" : "")).join("")).join("");
		case EConversationType.redPacket:
			return `红包 ¥${r.amount} ${r.note ?? ""}`;
		case EConversationType.transfer:
			return `转账 ¥${r.amount} ${r.note ?? ""}`;
		case EConversationType.transferReceipt:
			return `转账收款${r.amount ? ` ¥${r.amount}` : ""}`;
		case EConversationType.voice:
			return `语音 ${r.duration}″`;
		case EConversationType.call:
			return `视频通话 ${r.callStatus ?? ""} ${r.seconds ?? ""}秒`;
		case EConversationType.centerText:
			return `（系统提示）${r.simpleContent ?? ""}`;
		case EConversationType.redPacketAcceptedReply:
			return "红包收款";
		default:
			return `[${String(v.type)}]`;
	}
};

/** 给确认卡片显示：这条 id 对应哪条消息 */
export const describeId = (conversationId: string, id: string) => {
	const v = getConversationListValueSnapshot(conversationId).find((x) => x.id === id);
	if (!v) return `（找不到 #${id}）`;
	return `${dayjs(v.sendTimestamp).format("M/D HH:mm")} ${v.role === "mine" ? "我" : "对方"}：${plainOf(v).slice(0, 30)}`;
};

export const describeOp = (conversationId: string, o: ChatOp) => {
	switch (o.op) {
		case "delete":
			return `删除 ${o.ids.length} 条：${o.ids.slice(0, 3).map((i) => describeId(conversationId, i)).join("；")}${o.ids.length > 3 ? "……" : ""}`;
		case "setTime":
			return `改时间 → ${o.at}：${describeId(conversationId, o.id)}`;
		case "shift": {
			const bits = [
				o.days ? `${o.days > 0 ? "推后" : "提前"} ${Math.abs(o.days)} 天` : "",
				o.hours ? `${o.hours > 0 ? "推后" : "提前"} ${Math.abs(o.hours)} 小时` : "",
				o.minutes ? `${o.minutes > 0 ? "推后" : "提前"} ${Math.abs(o.minutes)} 分钟` : "",
				o.evening ? "改到当天晚上" : "",
			].filter(Boolean);
			return `时间线：${bits.join("，") || "调整时间"}${o.ids?.length ? `（${o.ids.length} 条）` : "（整段一起移动，收款记录也跟着走）"}`;
		}
		case "replay":
			return `回放${o.query ? `「${o.query}」` : o.from ? ` ${o.from} ~ ${o.to ?? ""}` : "这一段"}。到聊天里确认首尾后再播，不改记录`;
		default: {
			const f = [o.text !== undefined && `内容「${o.text.slice(0, 20)}」`, o.amount && `金额 ¥${o.amount}`, o.note !== undefined && `备注「${o.note}」`, o.status && `状态 ${o.status}`, o.seconds && `${o.seconds} 秒`, o.scene && `场景 ${o.scene}`, o.pace && `语速 ${o.pace}`, o.at && `时间 ${o.at}`].filter(Boolean).join("，");
			return `修改 ${f}：${describeId(conversationId, o.id)}`;
		}
	}
};

/** 按时间稳定排序，并重算改动位置（及其后一条）的时间标签：相隔 5 分钟以上显示，今天/昨天/星期自动判断 */
export const reflow = (input: Record<string, any>[], touched: Set<string>) => {
	let list = input;
	// 按时间稳定排序（没有时间的保持原位）
	const keyed = list.map((v, i) => ({ v, i, t: v.sendTimestamp ?? 0 }));
	if (keyed.some((k, i) => i > 0 && k.t && keyed[i - 1].t && k.t < keyed[i - 1].t)) {
		keyed.sort((a, b) => (a.t && b.t ? a.t - b.t : a.i - b.i));
		list = keyed.map((k) => k.v);
	}
	// 时间标签：改过的位置及其后一条重新算（相隔 5 分钟以上显示，今天/昨天/星期自动判断）
	const after = new Set<string>();
	list.forEach((v, i) => {
		if (touched.has(v.id) && list[i + 1]) after.add(list[i + 1].id);
	});
	list.forEach((v, i) => {
		if (!v.sendTimestamp) return;
		const prevTs = list[i - 1]?.sendTimestamp ?? 0;
		const needed = !prevTs || v.sendTimestamp - prevTs >= 5 * 60_000;
		if (touched.has(v.id) || after.has(v.id)) v.upperText = needed ? formatWechatTime(v.sendTimestamp) : undefined;
		else if (needed && !v.upperText) v.upperText = formatWechatTime(v.sendTimestamp);
	});
	return list;
};

/** 整段（或指定 id）平移 / 改到晚上。顺序不变，转账和收款各自的时间一起动，不晚于现在，并重算时间标签。 */
export const shiftTimes = (list: Record<string, any>[], shift: Extract<ChatOp, { op: "shift" }>) => {
	const ids = new Set(shift.ids?.length ? shift.ids : list.map((v) => v.id as string));
	const touched = new Set<string>();
	const now = Date.now();
	if (shift.evening) {
		const chosen = list.filter((v) => ids.has(v.id) && v.sendTimestamp).sort((a, b) => a.sendTimestamp - b.sendTimestamp);
		const byDay = new Map<string, typeof chosen>();
		for (const v of chosen) {
			const key = dayjs(v.sendTimestamp).format("YYYY-MM-DD");
			byDay.set(key, [...(byDay.get(key) ?? []), v]);
		}
		for (const arr of byDay.values()) {
			const day = dayjs(arr[0].sendTimestamp).startOf("day");
			let cursor = Math.min(day.hour(19).minute(Math.min(arr.length - 1, 20) * 8).valueOf(), now);
			for (let i = arr.length - 1; i >= 0; i--) {
				arr[i].sendTimestamp = cursor;
				touched.add(arr[i].id);
				cursor = Math.max(day.valueOf(), cursor - 8 * 60_000);
			}
		}
	}
	const delta = (shift.days ?? 0) * 86400000 + (shift.hours ?? 0) * 3600000 + (shift.minutes ?? 0) * 60000;
	if (delta) {
		for (const v of list) {
			if (!ids.has(v.id) || !v.sendTimestamp) continue;
			v.sendTimestamp = Math.min(v.sendTimestamp + delta, now);
			touched.add(v.id);
		}
	}
	return touched.size ? reflow(list, touched) : list;
};

/** 执行修改；返回结果说明。改完按时间重新排序，并重算受影响消息的时间标签 */
export const applyOps = (conversationId: string, ops: ChatOp[]) => {
	let deleted = 0;
	let edited = 0;
	const missingIds: string[] = [];
	const warnings: string[] = [];
	const touched = new Set<string>();
	const settle: { id: string; kind: "transfer" | "redPacket"; status: string }[] = [];
	setConversationListValue(conversationId, (prev) => {
		let list = prev.map((v) => ({ ...v })) as Record<string, any>[];
		const find = (id: string) => list.find((v) => v.id === id);
		for (const o of ops) {
			if (o.op === "shift") {
				list = shiftTimes(list, o);
				edited++;
				continue;
			}
			if (o.op === "replay") continue;
			if (o.op === "delete") {
				// 收款记录和发起那条各自独立，删一条不连带另一条
				for (const id of o.ids) {
					const idx = list.findIndex((v) => v.id === id);
					if (idx < 0) missingIds.push(id);
					else {
						list.splice(idx, 1);
						deleted++;
					}
				}
				continue;
			}
			const it = find(o.id);
			if (!it) {
				missingIds.push(o.id);
				continue;
			}
			const atTs = parseAt(o.at);
			if (atTs !== null) {
				it.sendTimestamp = Math.min(atTs, Date.now());
				touched.add(it.id);
			}
			if (o.op === "edit") {
				if (o.text !== undefined && it.type === EConversationType.text) it.textContent = [{ type: "paragraph", children: textToSlateChildren(o.text) }];
				if (o.text !== undefined && it.type === EConversationType.centerText) it.simpleContent = o.text;
				if (o.text !== undefined && it.type === EConversationType.voice) it.stt = o.text;
				if (o.seconds && it.type === EConversationType.voice) it.duration = Math.max(1, Math.round(o.seconds));
				if (o.seconds && it.type === EConversationType.call) it.seconds = Math.max(1, Math.round(o.seconds));
				if (o.scene !== undefined && it.type === EConversationType.voice) it.scene = o.scene || undefined;
				if (o.pace !== undefined && it.type === EConversationType.voice) it.pace = o.pace || undefined;
				if (o.tone !== undefined && it.type === EConversationType.voice) it.tone = o.tone || undefined;
				if (o.read !== undefined && it.type === EConversationType.voice) it.isRead = o.read;
				if (o.amount && (it.type === EConversationType.redPacket || it.type === EConversationType.transfer)) {
					const n = Number(o.amount);
					if (it.type === EConversationType.redPacket && moneyOverLimit(n)) warnings.push(`#${o.id} 红包金额 ¥${n} 超过 200，金额没改`);
					else if (Number.isFinite(n) && n > 0) it.amount = n.toFixed(2);
				}
				if (o.note !== undefined && (it.type === EConversationType.redPacket || it.type === EConversationType.transfer)) it.note = o.note || undefined;
				if (o.status && it.type === EConversationType.redPacket && ["awaiting", "accepted", "expired", "returned"].includes(o.status)) {
					it.redPacketStatus = o.status;
					if (o.status === "accepted" || o.status === "awaiting") settle.push({ id: it.id, kind: "redPacket", status: o.status });
				}
				if (o.status && it.type === EConversationType.transfer && ["awaiting", "accepted", "rejected", "expired", "returned"].includes(o.status)) {
					it.transferStatus = o.status;
					if (o.status === "accepted" || o.status === "returned" || o.status === "rejected" || o.status === "awaiting") settle.push({ id: it.id, kind: "transfer", status: o.status });
				}
				if (o.status && it.type === EConversationType.call && ["rejected", "cancelled", "accepted"].includes(o.status)) it.callStatus = o.status;
				edited++;
			} else edited++;
		}
		let typed = list as TConversationItem[];
		for (const s of settle) {
			if (s.kind === "transfer" && (s.status === "accepted" || s.status === "returned" || s.status === "rejected" || s.status === "awaiting")) {
				typed = settleTransfer(typed, s.id, s.status);
			}
			if (s.kind === "redPacket" && (s.status === "accepted" || s.status === "awaiting")) typed = settleRedPacket(typed, s.id, s.status);
		}
		// 只有改了时间才整表重排。配对消息按自己的时间插进去，不把别的消息挪走。
		if (touched.size) typed = reflow(typed as Record<string, any>[], touched) as TConversationItem[];
		return typed;
	});
	const miss = missingIds.length ? `，找不到这些 id（已跳过，其余已执行）：${missingIds.map((id) => `#${id}`).join("、")}` : "";
	const warn = warnings.length ? `。${warnings.join("；")}` : "";
	return `已执行：删除 ${deleted} 条、修改 ${edited} 处${miss}${warn}`;
};
