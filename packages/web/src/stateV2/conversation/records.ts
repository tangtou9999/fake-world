import { nanoid } from "nanoid";
import { formatWechatTime } from "./helpers";
import {
	EConversationType,
	type TConversationItem,
	type TConversationRole,
	type TRedPacketStatus,
	type TTransferStatus,
} from "./typing";

/**
 * 聊天记录的数据操作（按 id 增删改、按时间插入、区间替换、超时退回）。
 * 只动传入的数组，不读存储。旧消息缺 id 时补一个，其它字段原样保留。
 */

export const MONEY_MAX = 200;

const GAP = 5 * 60_000;

export const moneyOverLimit = (amount: unknown) => {
	const n = typeof amount === "number" ? amount : Number(String(amount ?? "").replace(/[^\d.]/g, ""));
	return Number.isFinite(n) && n > MONEY_MAX;
};

/** 缺 id 或 id 重复时补一个新的。已经合格的列表原样返回（同一引用）。 */
export const ensureIds = (list: TConversationItem[]): { list: TConversationItem[]; changed: boolean } => {
	if (!Array.isArray(list) || list.length === 0) return { list: list ?? [], changed: false };
	const seen = new Set<string>();
	let changed = false;
	const next = list.map((item) => {
		const id = item && typeof item.id === "string" ? item.id : "";
		if (id && !seen.has(id)) {
			seen.add(id);
			return item;
		}
		changed = true;
		const nid = nanoid(8);
		seen.add(nid);
		return { ...item, id: nid };
	});
	return { list: changed ? next : list, changed };
};

/**
 * 把新消息按 sendTimestamp 插进已有列表。
 * 已有消息的相对顺序不动，不覆盖；没有时间的新消息才追加到末尾。
 */
export const insertByTime = <T extends { id: string; sendTimestamp?: number }>(existing: T[], incoming: T[]): T[] => {
	const incomingIds = new Set(incoming.map((v) => v.id));
	const placed = existing.filter((v) => !incomingIds.has(v.id));
	const sorted = [...incoming].sort((a, b) => (a.sendTimestamp ?? Number.POSITIVE_INFINITY) - (b.sendTimestamp ?? Number.POSITIVE_INFINITY));
	for (const item of sorted) {
		const t = item.sendTimestamp;
		if (!t) {
			placed.push(item);
			continue;
		}
		const idx = placed.findIndex((v) => typeof v.sendTimestamp === "number" && v.sendTimestamp > t);
		placed.splice(idx < 0 ? placed.length : idx, 0, item);
	}
	return placed;
};

/** 只给新插入的那几条补时间标签，不改其它消息的文字、不重排 */
export const stampInserted = <T extends { id: string; sendTimestamp?: number; upperText?: string }>(list: T[], ids: Set<string>) => {
	list.forEach((v, i) => {
		if (!ids.has(v.id) || !v.sendTimestamp) return;
		const prevTs = list[i - 1]?.sendTimestamp ?? 0;
		v.upperText = !prevTs || v.sendTimestamp - prevTs >= GAP ? formatWechatTime(v.sendTimestamp) : undefined;
	});
	return list;
};

/** 用 incoming 换掉 [from, to] 里的消息（含两端）。区间外的一条不动。 */
export const rangeReplace = <T extends { id: string; sendTimestamp?: number }>(existing: T[], from: number, to: number, incoming: T[]): T[] => {
	const lo = Math.min(from, to);
	const hi = Math.max(from, to);
	const kept = existing.filter((v) => {
		const t = v.sendTimestamp;
		if (typeof t !== "number" || !t) return true;
		return t < lo || t > hi;
	});
	return insertByTime(kept, incoming);
};

export const makeTransferReceipt = (p: {
	sendTimestamp: number;
	receiver: TConversationRole;
	receiverId?: string;
	transferId?: string;
	amount?: string;
	senderId?: string;
}): TConversationItem =>
	({
		id: nanoid(8),
		type: EConversationType.transferReceipt,
		role: p.receiver,
		receiver: p.receiver,
		receiverId: p.receiverId,
		transferId: p.transferId,
		amount: p.amount,
		sendTimestamp: p.sendTimestamp,
		...(p.senderId ? { senderId: p.senderId } : {}),
	}) as TConversationItem;

export const makeRedPacketReceipt = (p: {
	sendTimestamp: number;
	receiver: TConversationRole;
	receiverId?: string;
	redPacketId?: string;
	senderId?: string;
}): TConversationItem =>
	({
		id: nanoid(8),
		type: EConversationType.redPacketAcceptedReply,
		role: "friend",
		redPacketId: p.redPacketId || "",
		receiver: p.receiver,
		claimerId: p.receiver === "friend" ? p.receiverId : undefined,
		sendTimestamp: p.sendTimestamp,
		...(p.senderId ? { senderId: p.senderId } : {}),
	}) as TConversationItem;

const noticeIdOf = (id: string) => `ret-${id}`;

/**
 * 只处理带 autoReturnHours 且仍是「待领取」的转账/红包。
 * 到期后把这一条改成 returned，并在到期那个时间点插入一条系统提示（已有则不重复）。
 */
export const applyAutoReturn = (list: TConversationItem[], now = Date.now()): { list: TConversationItem[]; changed: boolean } => {
	const notices: TConversationItem[] = [];
	let changed = false;
	const next = list.map((item) => {
		if (item.type !== EConversationType.transfer && item.type !== EConversationType.redPacket) return item;
		const hours = item.autoReturnHours;
		if (!hours || hours <= 0 || !item.sendTimestamp) return item;
		const status = item.type === EConversationType.transfer ? item.transferStatus : item.redPacketStatus;
		if (status !== "awaiting") return item;
		const due = item.sendTimestamp + hours * 3_600_000;
		if (due > now) return item;
		changed = true;
		const nid = noticeIdOf(item.id);
		if (!list.some((v) => v.id === nid) && !notices.some((v) => v.id === nid)) {
			notices.push({
				id: nid,
				type: EConversationType.centerText,
				role: "friend",
				simpleContent: item.type === EConversationType.transfer ? "转账超时未收款，已退回" : "红包超时未领取，已退回",
				sendTimestamp: due,
			});
		}
		if (item.type === EConversationType.transfer) return { ...item, transferStatus: "returned" as TTransferStatus };
		return { ...item, redPacketStatus: "returned" as TRedPacketStatus };
	});
	if (!changed) return { list, changed: false };
	const merged = stampInserted(insertByTime(next, notices), new Set(notices.map((n) => n.id)));
	return { list: merged, changed: true };
};
