import {
	EConversationType,
	type TConversationItem,
	setConversationListValue,
} from "@/stateV2/conversation";
import { touchDialogue } from "@/stateV2/fileHelper";
import { getGeminiConfig } from "@/stateV2/gemini";
import { type GeminiImage, callGemini, parseJsonLoose } from "@/utils/gemini";
import { nanoid } from "nanoid";
import dayjs from "dayjs";
import { parseAt } from "@/utils/parseAt";
import { Node } from "slate";
import { formatWechatTime, getConversationListValueSnapshot } from "@/stateV2/conversation";
import { getMyProfileValueSnapshot, getProfileValueSnapshot, getAllProfilesValueSnapshot } from "@/stateV2/profile";
import { EMOJI_NAME_LIST, slateToPlain, textToSlateChildren } from "@/wechatComponents/SlateText/emojiNames";
import { MYSELF_ID } from "@/faker/wechat/user";
import { getGroup, groupDefaultSender, isGroupId } from "@/stateV2/group";
import { MONEY_MAX, insertByTime, makeRedPacketReceipt, makeTransferReceipt, moneyOverLimit, settleRedPacket, settleTransfer, stampInserted } from "@/stateV2/conversation/records";

export type ParsedItem = {
	kind: "text" | "time" | "system" | "redPacket" | "redPacketReceipt" | "redPacketAct" | "transfer" | "transferReceipt" | "transferAct" | "voice" | "image" | "call" | "other";
	who?: "friend" | "me";
	text?: string;
	amount?: string;
	/** 群红包份数（默认群里所有人） */
	count?: number;
	note?: string;
	status?: "accepted" | "awaiting" | "expired" | "rejected" | "returned" | "cancelled";
	seconds?: number;
	/** 剧本模式：消息发生的时间 "YYYY-MM-DD HH:mm" */
	at?: string;
	/** 剧本模式：文字消息的译文（越南语等外语消息） */
	translation?: string;
	/** 语音：这一句所处的环境(scene)、语速(pace)、口气(tone) */
	scene?: string;
	pace?: string;
	tone?: string;
	/** 群聊：这条消息是哪位群成员发的（成员名字，照抄群成员列表） */
	sender?: string;
	/** 发起和领取/退回共用的短标记，用来把两个动作连上。不会写进聊天记录 */
	pair?: string;
	/** transferAct / redPacketAct：receive 领取，return 退回（红包没有退回） */
	act?: "receive" | "return";
	/** 超时未领自动退回的小时数，如 24。不写就不会自动退 */
	autoReturnHours?: number;
	/** 语音：false = 未播放（红点）。不写则视为已播放 */
	read?: boolean;
};

/** 单条红包 / 转账最高 200 元。超了就拒绝这一条，不悄悄改小 */
export const MAX_RED_PACKET = MONEY_MAX;

const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
/** 视频通话记录文字：who 是「谁打的」 */
export const callText = (role: "mine" | "friend", status?: string, seconds?: number) =>
	status === "rejected" ? (role === "mine" ? "对方已拒绝" : "已拒绝") : status === "cancelled" ? (role === "mine" ? "已取消" : "对方已取消") : `通话时长 ${mmss(Math.max(1, Math.round(seconds || 30)))}`;

/** 群成员的显示名（备注优先） */
export const memberName = (id: string) => {
	const p = getAllProfilesValueSnapshot().find((x) => x.id === id);
	return p?.remark || p?.nickname || id;
};

/** 群里按名字找成员 id：精确 → 包含；找不到返回 undefined */
export const resolveMember = (conversationId: string, name?: string) => {
	const g = getGroup(conversationId);
	if (!g || !name) return undefined;
	const others = g.memberIds.filter((m) => m !== MYSELF_ID);
	const n = name.trim();
	const all = getAllProfilesValueSnapshot();
	const names = (id: string) => {
		const p = all.find((x) => x.id === id);
		return [p?.remark, p?.nickname, id].filter((t): t is string => !!t);
	};
	return (
		others.find((m) => names(m).includes(n)) ??
		others.find((m) => names(m).some((t) => t.length >= 2 && (n.includes(t) || t.includes(n))))
	);
};

export const IMPORT_PROMPT = `这些是同一段微信聊天的截图，已按时间顺序给出（第 1 张最早）。请把聊天内容 1:1 转录成 JSON 数组，按出现顺序，不要遗漏、不要改写、不要翻译、不要总结。
规则：
- 右侧（绿色气泡、右边头像）= "me"；左侧（白色气泡、左边头像）= "friend"。
- 相邻两张截图可能有重叠的部分，重复出现的消息只保留一次。
- 每个元素的 kind 只能是：
  text（文字消息：who, text）
  time（页面中间的灰色时间，如 "09:27" "昨天 16:30"：text）
  system（页面中间的灰色提示，如「你已添加了xx」「对方撤回了一条消息」「xx领取了你的红包」：text）
  redPacket（红包：who, amount 如 "8.88"（看不到就留空）, note 红包文案, status：accepted 已领取/awaiting 未领取/expired 已过期）
  transfer（转账：who, amount, note, status：accepted 已收款/awaiting 待收款/rejected 已退还/expired 已过期）
  voice（语音：who, seconds 秒数, text 若能看到转文字则填）
  image（图片/表情/视频/文件/名片等无法转录的：who, text 填简短说明如 "[图片]" "[视频]" "[动画表情]"）
  other（其他看不懂的：text）
- 只输出 JSON 数组，不要任何解释。`;

export async function parseScreenshots(images: GeminiImage[]) {
	const raw = await callGemini(IMPORT_PROMPT, { json: true, images, model: getGeminiConfig().visionModel || undefined });
	const list = parseJsonLoose<ParsedItem[]>(raw);
	if (!Array.isArray(list) || list.length === 0) throw new Error("没有识别出聊天内容，换清晰一点的截图再试");
	return list;
}

/** AI 没写清是谁说的时：在群成员里轮流分配，避免全算在同一个人头上 */
const groupRotate = (conversationId: string, n: number) => {
	const others = (getGroup(conversationId)?.memberIds ?? []).filter((m) => m !== MYSELF_ID);
	return others.length ? others[(n - 1) % others.length] : groupDefaultSender(conversationId);
};

const paragraph = (text: string) => [{ type: "paragraph", children: textToSlateChildren(text) }] as never;

const hoursOf = (v: unknown) => {
	const n = Number(v);
	return Number.isFinite(n) && n > 0 ? n : undefined;
};

const transferStatusOf = (status?: string) =>
	status === "awaiting" ? "awaiting" : status === "rejected" ? "rejected" : status === "returned" ? "returned" : status === "expired" ? "expired" : "accepted";

const packetStatusOf = (status?: string) =>
	status === "awaiting" ? "awaiting" : status === "expired" ? "expired" : status === "returned" || status === "rejected" ? "returned" : "accepted";

/** 每条用自己的 at。不把整批挤到最后一条后面，也不为了单调把早的时间往后推。未来的时间压到现在。 */
function ownStamps(list: ParsedItem[]) {
	const now = Date.now();
	let prev = 0;
	return list.map((it) => {
		const parsed = parseAt(it.at);
		let t = parsed ?? (prev || now - 60_000) + 30_000;
		if (t > now) t = now;
		prev = t;
		return t;
	});
}

export type ApplyParsedResult = { applied: number; notes: string[] };

/**
 * 把识别结果写入聊天。
 * replace：清空后替换。
 * range：只换该时间段。
 * appendToEnd：用户明确选择追加到末尾。
 * 其余在 timed 时按每条自己的时间插入，不覆盖、不打乱已有消息。
 */
export function applyParsedItems(
	conversationId: string,
	list: ParsedItem[],
	replace: boolean,
	timed = false,
	range?: { from: number; to: number },
	appendToEnd = false,
): ApplyParsedResult {
	const notes: string[] = [];
	const base = Date.now() - list.length * 60_000;
	const existing = getConversationListValueSnapshot(conversationId);
	const before = range ? existing.filter((v) => (v.sendTimestamp ?? 0) < range.from) : [];
	const after = range ? existing.filter((v) => (v.sendTimestamp ?? 0) > range.to) : [];
	const lastBefore = range ? (before.at(-1)?.sendTimestamp ?? 0) : undefined;
	const placeAtTime = timed && !replace && !range && !appendToEnd;
	const stamps = timed
		? placeAtTime
			? ownStamps(list)
			: computeStamps(conversationId, list, replace, {
					last: lastBefore,
					cap: after[0]?.sendTimestamp,
				})
		: [];
	let prevStamp = range ? (lastBefore ?? 0) : replace ? 0 : (existing.at(-1)?.sendTimestamp ?? 0);
	let pendingTime: string | undefined;
	let items: TConversationItem[] = [];
	const pairOf = new Map<string, { pair: string; kind: "init" | "receipt" }>();
	const actWant = new Map<string, { act: "receive" | "return"; ts: number }>();
	const fmtAmount = (v?: string) => {
		const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
		return Number.isFinite(n) && n > 0 ? n.toFixed(2) : "0.00";
	};
	let lastPreview = "";
	let newestTs = 0;
	let rotate = 0;
	const rejectMoney = (it: ParsedItem) => {
		if (!moneyOverLimit(it.amount)) return false;
		notes.push(`¥${it.amount} 超过 ${MAX_RED_PACKET}，这条没有写入`);
		return true;
	};
	list.forEach((it, i) => {
		const role = it.who === "me" ? "mine" : "friend";
		const ts = timed ? stamps[i] : base + i * 60_000;
		const inGroup = isGroupId(conversationId) && role === "friend" && it.kind !== "system" && it.kind !== "redPacketReceipt" && it.kind !== "transferReceipt";
		const sid = inGroup ? (resolveMember(conversationId, it.sender) ?? groupRotate(conversationId, ++rotate)) : undefined;
		const common = { id: nanoid(8), sendTimestamp: ts, ...(sid ? { senderId: sid } : {}) } as const;
		let upper = pendingTime;
		if (timed) {
			pendingTime = undefined;
			upper = !placeAtTime && (!prevStamp || ts - prevStamp >= 5 * 60_000) ? formatWechatTime(ts) : undefined;
		}
		if (it.kind !== "time") prevStamp = ts;
		const takeUpper = () => {
			pendingTime = undefined;
			return upper;
		};
		const rememberPair = (kind: "init" | "receipt") => {
			if (it.pair) pairOf.set(common.id, { pair: String(it.pair), kind });
		};
		switch (it.kind) {
			case "time":
				if (timed) return;
				pendingTime = it.text;
				return;
			case "system":
				items.push({ ...common, type: EConversationType.centerText, role: "friend", simpleContent: it.text ?? "", upperText: takeUpper() } as TConversationItem);
				lastPreview = it.text ?? "";
				newestTs = Math.max(newestTs, ts);
				return;
			case "redPacketAct":
			case "transferAct": {
				if (it.pair) actWant.set(String(it.pair), { act: it.act === "return" ? "return" : "receive", ts });
				return;
			}
			case "redPacket": {
				if (rejectMoney(it)) return;
				rememberPair("init");
				items.push({
					...common,
					type: EConversationType.redPacket,
					role,
					originalSender: role,
					amount: fmtAmount(it.amount),
					note: it.note || undefined,
					redPacketStatus: timed ? (it.status === "accepted" || it.status === "expired" || it.status === "returned" ? (it.status === "returned" ? "returned" : it.status) : "awaiting") : packetStatusOf(it.status),
					autoReturnHours: hoursOf(it.autoReturnHours),
					upperText: takeUpper(),
				} as TConversationItem);
				lastPreview = "[微信红包]";
				newestTs = Math.max(newestTs, ts);
				return;
			}
			case "redPacketReceipt": {
				if (timed && it.pair) actWant.set(String(it.pair), { act: "receive", ts });
				if (timed) return;
				rememberPair("receipt");
				const member = resolveMember(conversationId, it.sender);
				const receipt = makeRedPacketReceipt({
					sendTimestamp: ts,
					receiver: role,
					receiverId: member,
					senderId: member,
				});
				items.push({ ...receipt, id: common.id, upperText: takeUpper() } as TConversationItem);
				lastPreview = "[领取红包]";
				newestTs = Math.max(newestTs, ts);
				return;
			}
			case "call": {
				const status = it.status === "rejected" || it.status === "cancelled" || it.status === "accepted" ? it.status : "accepted";
				items.push({
					...common,
					type: EConversationType.call,
					role,
					callStatus: status,
					seconds: status === "accepted" ? Math.max(1, Math.round(it.seconds || 30)) : undefined,
					upperText: takeUpper(),
				} as TConversationItem);
				lastPreview = `[视频通话] ${callText(role, status, it.seconds)}`;
				newestTs = Math.max(newestTs, ts);
				return;
			}
			case "transfer": {
				rememberPair("init");
				items.push({
					...common,
					type: EConversationType.transfer,
					role,
					originalSender: role,
					amount: fmtAmount(it.amount),
					note: it.note || undefined,
					transferStatus: timed ? (it.status === "accepted" || it.status === "returned" || it.status === "rejected" || it.status === "expired" ? it.status : "awaiting") : transferStatusOf(it.status),
					autoReturnHours: hoursOf(it.autoReturnHours),
					upperText: takeUpper(),
				} as TConversationItem);
				lastPreview = "[转账]";
				newestTs = Math.max(newestTs, ts);
				return;
			}
			case "transferReceipt": {
				if (timed && it.pair) actWant.set(String(it.pair), { act: "receive", ts });
				if (timed) return;
				rememberPair("receipt");
				const member = resolveMember(conversationId, it.sender);
				const receipt = makeTransferReceipt({
					sendTimestamp: ts,
					receiver: role,
					receiverId: member,
					amount: it.amount,
					senderId: member,
				});
				items.push({ ...receipt, id: common.id, upperText: takeUpper() } as TConversationItem);
				lastPreview = "[转账收款]";
				newestTs = Math.max(newestTs, ts);
				return;
			}
			case "voice":
				items.push({ ...common, type: EConversationType.voice, role, duration: Math.max(1, Math.round(it.seconds || 3)), showStt: false, stt: it.text, isRead: it.read === false ? false : true, scene: it.scene, pace: it.pace, tone: it.tone, upperText: takeUpper() } as TConversationItem);
				lastPreview = "[语音]";
				newestTs = Math.max(newestTs, ts);
				return;
			default: {
				const text = it.text || (it.kind === "image" ? "[图片]" : "");
				if (!text) return;
				items.push({ ...common, type: EConversationType.text, role, textContent: paragraph(text), translation: it.translation || undefined, upperText: takeUpper() } as TConversationItem);
				lastPreview = text;
				newestTs = Math.max(newestTs, ts);
			}
		}
	});
	for (const [id, info] of pairOf) {
		if (info.kind !== "receipt") continue;
		const init = [...pairOf].find(([, o]) => o.kind === "init" && o.pair === info.pair);
		if (!init) continue;
		const msg = items.find((v) => v.id === id);
		if (!msg) continue;
		if (msg.type === EConversationType.transferReceipt) msg.transferId = init[0];
		if (msg.type === EConversationType.redPacketAcceptedReply) msg.redPacketId = init[0];
	}
	if (timed) {
		for (const item of items) {
			if (item.type !== EConversationType.transfer && item.type !== EConversationType.redPacket) continue;
			if (item.role !== item.originalSender) continue;
			const mark = pairOf.get(item.id);
			const act = mark?.pair ? actWant.get(mark.pair) : undefined;
			if (item.type === EConversationType.transfer) {
				const st = item.transferStatus;
				const want = act?.act === "return" ? "returned" : act?.act === "receive" ? "accepted" : st === "returned" ? "returned" : st === "rejected" ? "rejected" : st === "accepted" ? "accepted" : null;
				if (want) items = settleTransfer(items, item.id, want, act?.ts);
			} else if (act?.act === "receive" || item.redPacketStatus === "accepted") {
				items = settleRedPacket(items, item.id, "accepted", act?.ts);
			}
		}
	}
	const newIds = new Set(items.map((v) => v.id));
	setConversationListValue(conversationId, (prev) => {
		if (range) {
			return [...prev.filter((v) => (v.sendTimestamp ?? 0) < range.from), ...items, ...prev.filter((v) => (v.sendTimestamp ?? 0) > range.to)];
		}
		if (placeAtTime) return stampInserted(insertByTime(prev, items), newIds);
		return replace ? items : [...prev, ...items];
	});
	const lastOld = existing.at(-1)?.sendTimestamp ?? 0;
	if (lastPreview && newestTs >= lastOld && !(range && after.length)) touchDialogue(conversationId, lastPreview);
	return { applied: items.length, notes };
}

/** 为剧本里的每条消息算出合法时间：单调递增，且不晚于现在、不早于已有最后一条 */
function computeStamps(
	conversationId: string,
	list: ParsedItem[],
	replace: boolean,
	opt: { last?: number; cap?: number; fromZero?: boolean } = {},
) {
	const now = Date.now();
	const last = opt.last ?? (replace ? 0 : (getConversationListValueSnapshot(conversationId).at(-1)?.sendTimestamp ?? 0));
	const top = Math.min(now, opt.cap ? opt.cap - 1000 : now);
	const out: number[] = [];
	let prev = opt.fromZero ? 0 : last || now - list.length * 60_000;
	list.forEach((it) => {
		const parsed = parseAt(it.at);
		let t = parsed ?? prev + 30_000;
		if (t < prev + 1000) t = prev + 1000;
		out.push(t);
		prev = t;
	});
	// 不能出现未来的时间：从后往前压到现在以内
	for (let i = out.length - 1; i >= 0; i--) {
		const cap = i === out.length - 1 ? top : out[i + 1] - 1000;
		if (out[i] > cap) out[i] = cap;
	}
	return out;
}

const SCRIPT_PROMPT = (ctx: {
	friend: string;
	me: string;
	history: string;
	now: string;
	lastAt: string;
	script: string;
	/** 群聊：成员列表说明（非群聊为空） */
	group?: string;
}) => `你是微信聊天剧本的执行器。用户用自然语言写了一段剧本，你要严格按剧本生成聊天消息 JSON，而不是自由发挥。
${ctx.group ? `这是一个微信群聊。群名与成员：\n${ctx.group}\n群聊规则：who 为 friend 的每一条都必须再加 "sender"：群成员名字（照抄上面列表，不要写别的名字，不要写「对方」）；多个成员要像真实群聊那样轮流、插话、接梗、互相 @ 或回应，每人说话风格不同，不要一个人连说很多条；剧本没点名时由你从成员里合理安排谁说；「我」的消息 who 为 me，不需要 sender。` : `对方：${ctx.friend}`}
我：${ctx.me}
现在的真实时间：${ctx.now}
聊天里最后一条消息的时间：${ctx.lastAt}
已有的最近聊天（请自然衔接，不要重复）：
${ctx.history || "（暂无）"}

用户的剧本：
${ctx.script}

执行规则：
1. 严格遵守剧本里的数量和顺序，如「对方说两句、我说一句」就是 2 条 friend、1 条 me；「中间停顿几句」或「过了一会/第二天」意味着时间间隔，用 at 的跳跃表现，不要生成消息。
2. 每个元素都必须有 at（"YYYY-MM-DD HH:mm"）。at 必须单调递增、且绝对不能晚于现在的真实时间 ${ctx.now}。默认接在最后一条已有消息之后；但如果用户明确要求生成「很久以前」的聊天（如「一个月前」「两个月前」「半年前」「去年」「上个月那几天」），at 必须真的写成那段过去的日期（以现在的真实时间往前推算，系统会按时间把它插到聊天记录的正确位置），不要写成今天或最近几天。「第二天」「一小时后」等如果会超过现在，就把整段剧本整体往前挪（例如挪到昨天或前天），保证最后一条仍不晚于现在。同一段连续对话间隔 5 秒到 2 分钟；「停顿」「新的时间节点」间隔至少 10 分钟，通常几十分钟到几小时。
3. kind 只能是：
   text（who, text, 可选 translation：若这条是外语，translation 填中文译文）
   redPacket（发起那条，永远是刚发出去：who, amount 数字字符串且不超过 200, note 祝福语, pair, 可选 autoReturnHours。不要用 status 表示已经领了）
   redPacketAct（领取动作：pair 与发起相同, act 只能是 receive, at 是领取时间。红包没有退回）
   transfer（发起那条，永远是刚转出去、还没收：who, amount 按剧本原数写、可以超过 200, note 备注，没有备注就省略, pair）
   transferAct（对方处理：pair 与发起相同, act 为 receive 领取 或 return 退回, at 是处理时间）
   voice（who, seconds, text 为转文字, 可选 scene：clean/bed/room/crowd/rain/mall/street, pace：normal/fast/slow, tone 口气, read：false 表示还没播放）
   call（视频通话记录，不要写成文字：who 是谁打的；status：rejected 被拒绝 / cancelled 已取消 / accepted 接通（接通要写 seconds 通话秒数））
   system（text，居中的灰色系统提示）
4. 转账和红包必须写成「发起」加可选的「领取/退回」两个动作，禁止合并成一条，也不要自己再写一条假的收款气泡。系统会用和用户手动发、手动点领取完全相同的结构落进聊天：转账领取后，发起那条变成已被接收，对方那边多一条已收款；转账退回后两边都是已退回；红包领取后发起那条变成已领取，并多一条「领取了红包」的系统提示。还没收 / 还没领就只有发起那一条。pair 是你编的短标记（如 "a"）。红包金额不能超过 200，超过就不要写这条。转账金额照剧本写，不要因为超过 200 就省略（例如「转 300 未收」就是一条 300 的待收款）。只有用户明确要求「超时未领自动退回」时才写 autoReturnHours（小时，如 24）。
   例：「给他转 100 元，让他退回」= {"kind":"transfer","who":"me","amount":"100","pair":"a","at":"..."} 然后 {"kind":"transferAct","pair":"a","act":"return","at":"稍晚一点"}。
   「给他转 200 元，让他接收」= transfer who me amount 200 + transferAct act receive。
   「给他转 300 元，未收」= 只有 transfer who me amount 300，不要 transferAct。
   「对方发红包，我领取」= redPacket who friend + redPacketAct act receive。
   「对方发红包，未领取」= 只有 redPacket who friend。红包不要写 return。
5. 口语化、简短，符合各自身份，不要旁白、编号。不要输出 time 类元素。
6. 文字里可以用微信表情，写成 [名字]，只能用这些名字：${EMOJI_NAME_LIST.join("、")}；真人聊天表情不要太多，不要用其他方括号表情，也不要用 Unicode 小黄脸。只输出 JSON 数组，如 [{"kind":"text","who":"friend",${ctx.group ? '"sender":"成员名",' : ""}"text":"在吗","at":"2026-01-02 10:00"}]。who 只能是 friend 或 me。`;

export async function generateScript(conversationId: string, script: string) {
	const group = getGroup(conversationId);
	const friend = getProfileValueSnapshot(conversationId);
	const me = getMyProfileValueSnapshot();
	const existing = getConversationListValueSnapshot(conversationId);
	const senderLabel = (v: { role?: string; senderId?: string }) => {
		if (v.role === "mine") return "我";
		if (!group) return "对方";
		return memberName(v.senderId ?? groupDefaultSender(conversationId) ?? "");
	};
	const history = existing
		.filter((v) => v.type === EConversationType.text)
		.slice(group ? -30 : -12)
		.map((v) => {
			const t = (v as unknown as { textContent: Parameters<typeof Node.string>[0][] }).textContent
				.map((n) => slateToPlain(n as never))
				.join("");
			return `${senderLabel(v as { role?: string; senderId?: string })}：${t}`;
		})
		.join("\n");
	const lastTs = existing.at(-1)?.sendTimestamp;
	const prompt = SCRIPT_PROMPT({
		group: group
			? `「${group.name}」\n${group.memberIds
					.filter((m) => m !== MYSELF_ID)
					.map((m) => {
						const p = getAllProfilesValueSnapshot().find((x) => x.id === m);
						return `- ${memberName(m)}${p?.description ? `（${p.description}）` : ""}`;
					})
					.join("\n")}`
			: undefined,
		friend: `${friend?.remark || friend?.nickname || "朋友"}${friend?.description ? `（${friend.description}）` : ""}`,
		me: me?.nickname || "我",
		history,
		now: dayjs().format("YYYY-MM-DD HH:mm dddd"),
		lastAt: lastTs ? dayjs(lastTs).format("YYYY-MM-DD HH:mm") : "（没有历史消息）",
		script,
	});
	const raw = await callGemini(prompt, { json: true, windowKey: `c:${conversationId}` });
	const list = parseJsonLoose<ParsedItem[]>(raw);
	if (!Array.isArray(list) || list.length === 0) throw new Error("没有生成出内容，换个说法再试一次");
	return list.filter((v) => v && v.kind !== "time");
}

/** 译文：中文 → 越南语，其余 → 中文 */
export async function translateText(text: string) {
	const raw = await callGemini(
		`把下面这句微信消息翻译。如果原文是中文，翻成越南语；否则翻成简体中文。只输出译文本身，不要解释、不要引号。\n\n${text}`,
	);
	return raw.trim().replace(/^["“]|["”]$/g, "");
}

export const previewLine = (it: ParsedItem) => {
	const who = it.who === "me" ? "我" : it.sender || "对方";
	const at = parseAt(it.at);
	const tm = at !== null ? dayjs(at).format("YYYY/M/D HH:mm") : it.at ? `⚠️${it.at}` : "";
	switch (it.kind) {
		case "redPacket": return `${tm} ${who}发红包 ¥${it.amount ?? ""} ${it.note ?? ""}${moneyOverLimit(it.amount) ? "（超过200，不会写入）" : ""}`;
		case "redPacketReceipt":
		case "redPacketAct": return `${tm} ${who}领取红包`;
		case "transfer": return `${tm} ${who}转账 ¥${it.amount ?? ""} ${it.note ?? ""}`;
		case "transferReceipt":
		case "transferAct": return `${tm} ${who}${it.act === "return" ? "退回转账" : "收款"}`;
		case "call": return `${tm} ${who}发起视频通话：${callText(it.who === "me" ? "mine" : "friend", it.status, it.seconds)}`;
		case "voice": return `${tm} ${who}语音 ${it.seconds ?? 3}″ ${it.text ?? ""}`;
		case "system": return `${tm} [系统] ${it.text ?? ""}`;
		default: return `${tm} ${who}：${it.text ?? ""}${it.translation ? `（${it.translation}）` : ""}`;
	}
};
