import { EConversationType, type TConversationItem, setConversationListValue } from "@/stateV2/conversation";
import { getGroup } from "@/stateV2/group";
import { MYSELF_ID } from "@/faker/wechat/user";
import { nanoid } from "nanoid";

/** 把总金额随机拆成 n 份（拼手气），每份至少 0.01，合计正好等于总金额 */
export const splitAmount = (total: number, n: number): number[] => {
	const cents = Math.max(Math.round(total * 100), n);
	const cuts = new Set<number>();
	while (cuts.size < n - 1) cuts.add(1 + Math.floor(Math.random() * (cents - 1)));
	const pts = [0, ...[...cuts].sort((a, b) => a - b), cents];
	const out: number[] = [];
	for (let i = 1; i < pts.length; i++) out.push((pts[i] - pts[i - 1]) / 100);
	return out;
};

const shuffle = <T,>(a: T[]) => {
	const b = [...a];
	for (let i = b.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[b[i], b[j]] = [b[j], b[i]];
	}
	return b;
};

export type PacketPlan = {
	/** 红包上显示/入账的金额：对方发的红包 = 我抢到的那一份；我发的 = 总额 */
	amount: string;
	/** 会来领取的成员（顺序即领取顺序） */
	claimers: string[];
};

/**
 * 群红包：总共 count 份（默认 = 群里所有人，含我）。
 * 对方发的：其余人（含发的人自己）都领，留一份给我；我发的：随机成员领 count 份。
 */
export const planGroupPacket = (groupId: string, fromMe: boolean, total: number, count?: number): PacketPlan => {
	const members = (getGroup(groupId)?.memberIds ?? []).filter((m) => m !== MYSELF_ID);
	const all = members.length + 1;
	const n = Math.max(1, Math.min(Math.round(count || all), all));
	if (fromMe) {
		const take = Math.min(n, members.length);
		return { amount: total.toFixed(2), claimers: shuffle(members).slice(0, take) };
	}
	const shares = splitAmount(total, n);
	return { amount: shares[0].toFixed(2), claimers: shuffle(members).slice(0, Math.min(n - 1, members.length)) };
};

const replyItem = (packetId: string, claimerId: string, ts: number) =>
	({
		id: nanoid(8),
		type: EConversationType.redPacketAcceptedReply,
		role: "friend",
		redPacketId: packetId,
		claimerId,
		sendTimestamp: ts,
	}) as TConversationItem;

/** 立刻生成领取记录（用于生成过去的聊天），时间错开几秒 */
export const instantClaims = (packetId: string, claimers: string[], startTs: number) =>
	claimers.map((c, i) => replyItem(packetId, c, startTs + (i + 1) * 1500));

/** 5~10 秒内陆续有人领取：每隔一会儿在聊天末尾追加一条 */
export const dripClaims = (conversationId: string, packetId: string, claimers: string[]) => {
	if (!claimers.length) return;
	const span = 5000 + Math.random() * 5000;
	const times = claimers.map(() => 600 + Math.random() * (span - 600)).sort((a, b) => a - b);
	claimers.forEach((c, i) => {
		setTimeout(() => {
			setConversationListValue(conversationId, (prev) =>
				prev.some((v) => v.id === packetId) ? [...prev, replyItem(packetId, c, Date.now())] : prev,
			);
		}, times[i]);
	});
};
