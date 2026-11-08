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
import { Node } from "slate";
import { formatWechatTime, getConversationListValueSnapshot } from "@/stateV2/conversation";
import { getMyProfileValueSnapshot, getProfileValueSnapshot, getAllProfilesValueSnapshot } from "@/stateV2/profile";
import { EMOJI_NAME_LIST, slateToPlain, textToSlateChildren } from "@/wechatComponents/SlateText/emojiNames";
import { MYSELF_ID } from "@/faker/wechat/user";
import { getGroup, groupDefaultSender, isGroupId } from "@/stateV2/group";

export type ParsedItem = {
	kind: "text" | "time" | "system" | "redPacket" | "transfer" | "voice" | "image" | "other";
	who?: "friend" | "me";
	text?: string;
	amount?: string;
	note?: string;
	status?: "accepted" | "awaiting" | "expired" | "rejected";
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
};

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

/** 把识别结果写入聊天；replace=true 时先清空原有记录 */
export function applyParsedItems(
	conversationId: string,
	list: ParsedItem[],
	replace: boolean,
	timed = false,
	range?: { from: number; to: number },
) {
	const base = Date.now() - list.length * 60_000;
	const existing = getConversationListValueSnapshot(conversationId);
	const before = range ? existing.filter((v) => (v.sendTimestamp ?? 0) < range.from) : [];
	const after = range ? existing.filter((v) => (v.sendTimestamp ?? 0) > range.to) : [];
	const lastBefore = range ? (before.at(-1)?.sendTimestamp ?? 0) : undefined;
	// 追加「很久以前」的聊天（一个月前、半年前……）：不挤到最后一条后面，而是按时间插进原有记录中间
	const firstAtRaw = list.find((v) => v.at && dayjs(v.at).isValid())?.at;
	const firstAtTs = firstAtRaw ? dayjs(firstAtRaw).valueOf() : 0;
	const lastExistingTs = existing.at(-1)?.sendTimestamp ?? 0;
	const past = timed && !replace && !range && firstAtTs > 0 && firstAtTs < lastExistingTs - 60_000;
	const insertAt = past ? existing.findIndex((v) => (v.sendTimestamp ?? 0) > firstAtTs) : -1;
	const nextAfterPast = past && insertAt >= 0 ? existing[insertAt] : undefined;
	const stamps = timed
		? computeStamps(conversationId, list, replace, {
				last: past ? 0 : lastBefore,
				cap: past ? nextAfterPast?.sendTimestamp : after[0]?.sendTimestamp,
				fromZero: past,
			})
		: [];
	let prevStamp = range ? (lastBefore ?? 0) : replace ? 0 : past ? (insertAt > 0 ? (existing[insertAt - 1].sendTimestamp ?? 0) : 0) : (existing.at(-1)?.sendTimestamp ?? 0);
	let pendingTime: string | undefined;
	const items: TConversationItem[] = [];
	let lastPreview = "";
	let rotate = 0;
	list.forEach((it, i) => {
		const role = it.who === "me" ? "mine" : "friend";
		const ts = timed ? stamps[i] : base + i * 60_000;
		const inGroup = isGroupId(conversationId) && role === "friend" && it.kind !== "system";
		const sid = inGroup ? (resolveMember(conversationId, it.sender) ?? groupRotate(conversationId, ++rotate)) : undefined;
		const common = { id: nanoid(8), sendTimestamp: ts, ...(sid ? { senderId: sid } : {}) } as const;
		let upper = pendingTime;
		if (timed) {
			pendingTime = undefined;
			upper = !prevStamp || ts - prevStamp >= 5 * 60_000 ? formatWechatTime(ts) : undefined;
		}
		if (it.kind !== "time") prevStamp = ts;
		const takeUpper = () => {
			pendingTime = undefined;
			return upper;
		};
		switch (it.kind) {
			case "time":
				if (timed) return;
				pendingTime = it.text;
				return;
			case "system":
				items.push({ ...common, type: EConversationType.centerText, role: "friend", simpleContent: it.text ?? "", upperText: takeUpper() } as TConversationItem);
				return;
			case "redPacket":
				items.push({
					...common,
					type: EConversationType.redPacket,
					role,
					originalSender: role,
					amount: it.amount || "0.00",
					note: it.note || undefined,
					redPacketStatus: it.status === "awaiting" ? "awaiting" : it.status === "expired" ? "expired" : "accepted",
					upperText: takeUpper(),
				} as TConversationItem);
				lastPreview = "[微信红包]";
				return;
			case "transfer":
				items.push({
					...common,
					type: EConversationType.transfer,
					role,
					originalSender: role,
					amount: it.amount || "0.00",
					note: it.note || undefined,
					transferStatus: it.status === "awaiting" ? "awaiting" : it.status === "rejected" ? "rejected" : it.status === "expired" ? "expired" : "accepted",
					upperText: takeUpper(),
				} as TConversationItem);
				lastPreview = "[转账]";
				return;
			case "voice":
				items.push({ ...common, type: EConversationType.voice, role, duration: Math.max(1, Math.round(it.seconds || 3)), showStt: false, stt: it.text, isRead: true, scene: it.scene, pace: it.pace, tone: it.tone, upperText: takeUpper() } as TConversationItem);
				lastPreview = "[语音]";
				return;
			default: {
				const text = it.text || (it.kind === "image" ? "[图片]" : "");
				if (!text) return;
				items.push({ ...common, type: EConversationType.text, role, textContent: paragraph(text), translation: it.translation || undefined, upperText: takeUpper() } as TConversationItem);
				lastPreview = text;
			}
		}
	});
	setConversationListValue(conversationId, (prev) => {
		if (range) {
			return [...prev.filter((v) => (v.sendTimestamp ?? 0) < range.from), ...items, ...prev.filter((v) => (v.sendTimestamp ?? 0) > range.to)];
		}
		if (past) {
			const idx = prev.findIndex((v) => (v.sendTimestamp ?? 0) > firstAtTs);
			if (idx < 0) return [...prev, ...items];
			const lastNew = items.at(-1)?.sendTimestamp ?? 0;
			const next = prev[idx];
			const fixedNext = { ...next, upperText: (next.sendTimestamp ?? 0) - lastNew >= 5 * 60_000 ? formatWechatTime(next.sendTimestamp ?? 0) : undefined } as TConversationItem;
			return [...prev.slice(0, idx), ...items, fixedNext, ...prev.slice(idx + 1)];
		}
		return replace ? items : [...prev, ...items];
	});
	if (lastPreview && !(range && after.length)) touchDialogue(conversationId, lastPreview);
	return items.length;
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
		const d = it.at ? dayjs(it.at) : null;
		let t = d?.isValid() ? d.valueOf() : prev + 30_000;
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
   redPacket（who, amount 数字字符串, note 祝福语, status：awaiting）
   transfer（who, amount, note, status：awaiting）
   voice（who, seconds, text 为转文字）
   system（text，居中的灰色系统提示）
4. 「发红包/转账」由谁发就用谁的 who；金额没说就按场景给合理金额。
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
	const tm = it.at ? dayjs(it.at).format("M/D HH:mm") : "";
	switch (it.kind) {
		case "redPacket": return `${tm} ${who}发红包 ¥${it.amount ?? ""} ${it.note ?? ""}`;
		case "transfer": return `${tm} ${who}转账 ¥${it.amount ?? ""} ${it.note ?? ""}`;
		case "voice": return `${tm} ${who}语音 ${it.seconds ?? 3}″ ${it.text ?? ""}`;
		case "system": return `${tm} [系统] ${it.text ?? ""}`;
		default: return `${tm} ${who}：${it.text ?? ""}${it.translation ? `（${it.translation}）` : ""}`;
	}
};
