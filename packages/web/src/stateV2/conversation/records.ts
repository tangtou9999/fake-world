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

/** 配对消息默认紧挨在发起之后，不另起一个时间标签 */
export const PAIR_GAP = 2_000;

const normYuan = (amount: unknown) => {
	const n = Number(String(amount ?? "").replace(/[^\d.]/g, ""));
	return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

const clampTime = (t: number) => (t > Date.now() ? Date.now() : t);

const settledTransfer = (s: string) => s === "accepted" || s === "returned" || s === "rejected";

const closestLegacyPair = (list: TConversationItem[], init: Extract<TConversationItem, { type: EConversationType.transfer }>) => {
	const amount = normYuan(init.amount);
	const cands = list.filter(
		(v): v is Extract<TConversationItem, { type: EConversationType.transfer }> =>
			v.type === EConversationType.transfer &&
			v.id !== init.id &&
			!v.pairOf &&
			v.originalSender === init.originalSender &&
			v.role !== init.role &&
			v.role !== v.originalSender &&
			normYuan(v.amount) === amount &&
			settledTransfer(v.transferStatus),
	);
	if (!cands.length) return undefined;
	const t = init.sendTimestamp ?? 0;
	cands.sort((a, b) => Math.abs((a.sendTimestamp ?? 0) - t) - Math.abs((b.sendTimestamp ?? 0) - t));
	return cands[0];
};

/**
 * 和手动点「领取 / 退回」同一套：
 * accepted / returned / rejected 时，对面必须有一条转账气泡（pairOf 指向发起）。
 * awaiting 时删掉这条配对。时间用 at，没给就用发起时间再加一点点。
 * 没有变化时返回原来的数组。
 */
export const settleTransfer = (
	list: TConversationItem[],
	id: string,
	status: "accepted" | "returned" | "awaiting" | "rejected",
	at?: number,
): TConversationItem[] => {
	const init = list.find((v) => v.id === id);
	if (!init || init.type !== EConversationType.transfer) return list;
	const opposite: TConversationRole = init.role === "mine" ? "friend" : "mine";
	const linked = list.find((v): v is Extract<TConversationItem, { type: EConversationType.transfer }> => v.type === EConversationType.transfer && v.pairOf === id);
	const legacy = linked ? undefined : closestLegacyPair(list, init);
	const existing = linked ?? legacy;

	if (status === "awaiting") {
		if (init.transferStatus === "awaiting" && !existing) return list;
		return list.flatMap((v) => {
			if (existing && v.id === existing.id) return [];
			if (v.id === id && v.type === EConversationType.transfer) return [{ ...v, transferStatus: "awaiting" as TTransferStatus }];
			return [v];
		});
	}

	const wantTs = clampTime(at ?? (init.sendTimestamp ? init.sendTimestamp + PAIR_GAP : Date.now()));
	if (
		init.transferStatus === status &&
		existing &&
		existing.pairOf === id &&
		existing.transferStatus === status &&
		existing.role === opposite &&
		existing.originalSender === init.originalSender &&
		normYuan(existing.amount) === normYuan(init.amount) &&
		(at == null || existing.sendTimestamp === wantTs)
	) {
		return list;
	}

	const pairId = existing?.id ?? nanoid(8);
	const pair: TConversationItem = {
		id: pairId,
		type: EConversationType.transfer,
		role: opposite,
		originalSender: init.originalSender,
		transferStatus: status,
		amount: normYuan(init.amount),
		sendTimestamp: wantTs,
		pairOf: id,
		...(init.transferTo && opposite === "friend" ? { senderId: init.transferTo } : {}),
	};
	const base = list.flatMap((v) => {
		if (v.id === pairId) return [];
		if (v.id === id && v.type === EConversationType.transfer) return [{ ...v, transferStatus: status }];
		return [v];
	});
	return stampInserted(insertByTime(base, [pair]), new Set([pairId]));
};

/**
 * 红包只有领取，没有退回。
 * accepted：状态改成已领取，并补上和手动领取一样的「领取了红包」提示。
 * awaiting：改回待领取，并删掉这条提示。
 */
export const settleRedPacket = (
	list: TConversationItem[],
	id: string,
	status: "accepted" | "awaiting",
	at?: number,
): TConversationItem[] => {
	const pkt = list.find((v) => v.id === id);
	if (!pkt || pkt.type !== EConversationType.redPacket) return list;
	const reply = list.find((v) => v.type === EConversationType.redPacketAcceptedReply && v.redPacketId === id);
	if (status === "awaiting") {
		if (pkt.redPacketStatus === "awaiting" && !reply) return list;
		return list.flatMap((v) => {
			if (v.type === EConversationType.redPacketAcceptedReply && v.redPacketId === id) return [];
			if (v.id === id && v.type === EConversationType.redPacket) return [{ ...v, redPacketStatus: "awaiting" as TRedPacketStatus }];
			return [v];
		});
	}
	const wantTs = clampTime(at ?? (pkt.sendTimestamp ? pkt.sendTimestamp + PAIR_GAP : Date.now()));
	if (pkt.redPacketStatus === "accepted" && reply && (at == null || reply.sendTimestamp === wantTs)) return list;
	const replyId = reply?.id ?? nanoid(8);
	const msg: TConversationItem = {
		id: replyId,
		type: EConversationType.redPacketAcceptedReply,
		role: "friend",
		redPacketId: id,
		sendTimestamp: wantTs,
	};
	const base = list.flatMap((v) => {
		if (v.id === replyId) return [];
		if (v.id === id && v.type === EConversationType.redPacket) return [{ ...v, redPacketStatus: "accepted" as TRedPacketStatus }];
		return [v];
	});
	return stampInserted(insertByTime(base, [msg]), new Set([replyId]));
};

/** 打开聊天时：已接收 / 已退回却没有配对的旧记录，按手动领取的结构补上。已经成对的不动。 */
export const ensureMoneyPairs = (list: TConversationItem[]): { list: TConversationItem[]; changed: boolean } => {
	let cur = list;
	for (const item of list) {
		if (
			item.type === EConversationType.transfer &&
			item.role === item.originalSender &&
			(item.transferStatus === "accepted" || item.transferStatus === "returned" || item.transferStatus === "rejected")
		) {
			const next = settleTransfer(cur, item.id, item.transferStatus);
			if (next !== cur) cur = next;
		}
		if (item.type === EConversationType.redPacket && item.redPacketStatus === "accepted") {
			const next = settleRedPacket(cur, item.id, "accepted");
			if (next !== cur) cur = next;
		}
	}
	return { list: cur, changed: cur !== list };
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
