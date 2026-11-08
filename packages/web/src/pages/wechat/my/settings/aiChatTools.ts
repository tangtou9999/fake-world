import { MYSELF_ID } from "@/faker/wechat/user";
import type { ParsedItem } from "@/pages/wechat/conversation/ConversationFooter/importScreenshots";
import { applyParsedItems } from "@/pages/wechat/conversation/ConversationFooter/importScreenshots";
import type { AiChatAction } from "@/stateV2/aiChat";
import { GEMINI_VOICES, VOICE_ACCENTS, type VoiceProfile } from "@/stateV2/gemini";
import { EConversationType, getConversationListValueSnapshot } from "@/stateV2/conversation";
import { getAllProfilesValueSnapshot } from "@/stateV2/profile";
import { EMOJI_NAME_LIST, slateToPlain } from "@/wechatComponents/SlateText/emojiNames";
import { getGroup, groupDefaultSender, groupsAtom, isGroupId } from "@/stateV2/group";
import { mainStore } from "@/stateV2/store";
import { parseJsonLoose } from "@/utils/gemini";
import dayjs from "dayjs";

export type Contact = { id: string; name: string; tokens: string[] };

const nameOf = (id: string) => {
	const p = getAllProfilesValueSnapshot().find((x) => x.id === id);
	return p?.remark || p?.nickname || id;
};

export const listContacts = (): Contact[] => [
	...mainStore.get(groupsAtom).map((g) => ({ id: g.id, name: `群聊「${g.name}」`, tokens: [g.name, `群聊「${g.name}」`].filter((t) => t.length >= 2) })),
	...getAllProfilesValueSnapshot()
		.filter((p) => p.id !== MYSELF_ID)
		.map((p) => {
			const name = p.remark || p.nickname || p.id;
			const tokens = Array.from(
				new Set([p.remark, p.nickname, ...(p.remark ?? "").split(/[-—_（(\s]/)].filter((t): t is string => !!t && t.length >= 2)),
			);
			return { id: p.id, name, tokens };
		}),
];

/** 群成员名单（带人设描述），给 AI 看 */
export const groupMembersText = (groupId: string) => {
	const g = getGroup(groupId);
	if (!g) return "";
	return g.memberIds
		.filter((m) => m !== MYSELF_ID)
		.map((m) => {
			const p = getAllProfilesValueSnapshot().find((x) => x.id === m);
			return `- ${nameOf(m)}${p?.description ? `（${p.description}）` : ""}`;
		})
		.join("\n");
};

export const findMentioned = (text: string, contacts: Contact[]) =>
	contacts.filter((c) => c.tokens.some((t) => text.includes(t)));

const describe = (v: Record<string, any>, name: string, groupId?: string) => {
	const friendName = groupId ? nameOf(v.senderId ?? groupDefaultSender(groupId) ?? "") : name;
	const who = v.role === "mine" ? "我" : friendName;
	let body: string;
	switch (v.type) {
		case EConversationType.text:
			body = (v.textContent ?? []).map((n: never) => slateToPlain(n)).join("\n");
			break;
		case EConversationType.image:
			body = "[图片]";
			break;
		case EConversationType.video:
			body = "[视频]";
			break;
		case EConversationType.voice:
			body = `[语音 ${v.duration ?? ""}″${v.stt ? ` 转文字：${v.stt}` : ""}]`;
			break;
		case EConversationType.redPacket:
			body = `[红包 ¥${v.amount} ${v.note ?? ""} 状态：${v.redPacketStatus ?? ""} 发起人：${v.originalSender === "mine" ? "我" : friendName}]`;
			break;
		case EConversationType.transfer:
			body = `[转账 ¥${v.amount} ${v.note ?? ""} 状态：${v.transferStatus ?? ""} 发起人：${v.originalSender === "mine" ? "我" : friendName}]`;
			break;
		case EConversationType.centerText:
			return `[${dayjs(v.sendTimestamp).format("YYYY-MM-DD HH:mm")}] （系统提示）${v.simpleContent ?? ""}`;
		default:
			body = `[${String(v.type)}]`;
	}
	return `[${dayjs(v.sendTimestamp).format("YYYY-MM-DD HH:mm")}] ${who}：${body}`;
};

/** 某个联系人的全部聊天记录（不再只取最近几条）；极端过长时保留最新的部分 */
export const chatLog = (id: string, name: string, maxLines?: number) => {
	const all = getConversationListValueSnapshot(id) as unknown as Record<string, any>[];
	const list = maxLines ? all.slice(-maxLines) : all;
	let text = list.map((v) => describe(v, name, isGroupId(id) ? id : undefined)).join("\n");
	if (text.length > 200_000) text = `（更早的记录因太长已省略）\n${text.slice(-200_000)}`;
	return { count: all.length, text };
};

export const WXCHAT_RULES = (now: string, contactNames: string, currentName?: string, groupMembers?: string) => `
【把内容放进聊天窗口】
当用户要你为某个联系人生成、续写、改写聊天记录时：先正常回复（简短说明即可），然后在回复的最末尾附一个代码块，格式固定：
\`\`\`wxchat
{"target":"联系人名字","mode":"append","items":[{"kind":"text","who":"friend","text":"内容","at":"YYYY-MM-DD HH:mm"}]}
\`\`\`
- target：${currentName ? `默认就是当前聊天「${currentName}」；用户明确说别的联系人时才改成那个人，` : ""}必须是联系人列表里的名字（照抄）。
- mode 有三种：
  append = 追加到该聊天末尾；
  replace = 清空整个聊天后用 items 整个替换（用户说「重写整个聊天」才用，items 要包含全部记录）；
  range = 只修改某个时间段：额外写 "from":"YYYY-MM-DD HH:mm","to":"YYYY-MM-DD HH:mm"，该时间段内（含两端）的旧消息会被 items 替换，时间段之外的聊天保持不动。用户说「把昨天某一段改成……」「把这几句改掉」就用 range，items 只写这一段修改后的内容，at 必须落在 from 到 to 之间。
- items 每项：kind 为 text / redPacket / transfer / voice / system；who 为 friend（对方）或 me（我）；text 文字（voice 时是这句话说的内容，必须填写，播放时就用它读出声音，聊天里默认不显示，用户长按「转文字」才会看到；system 是居中灰色提示）；redPacket、transfer 需要 amount（数字字符串）、note、status（awaiting 或 accepted）；voice 需要 seconds，并且要按这一句话「当时所处的真实场景」带上 scene、pace，可选 tone：scene 只能是 clean（安静/普通）、bed（家里被窝）、room（夜晚客厅房间）、crowd（嘈杂餐厅夜宵摊）、rain（雨夜车内）、mall（商场超市）、street（户外马路街头）之一；pace 只能是 normal（自然闲聊）、fast（快节奏互怼）、slow（深夜走心）之一；tone 是这一句的口气，如「奶声奶气撒娇，稍微提高音量」。同一个人今天在车里、明天在家里，scene 就要不同，别全用一个；外语消息可加 translation（中文译文）；每项都要有 at。
- at 单调递增，不能晚于现在（现在是 ${now}）；停顿、第二天等用 at 的间隔表现；追加时 at 不早于该聊天最后一条的时间。
- 只有用户明确要求生成/修改聊天内容时才附代码块；普通聊天、咨询不要附。
${groupMembers ? `
【这是群聊】当前聊天是微信群，群成员（不含我）：
${groupMembers}
- 群里 who 为 friend 的每一项都必须加 "sender":"成员名"（照抄上面名字，不要写「对方」）；who 为 me 是「我」，不需要 sender。
- 生成群聊要像真实群：多个成员轮流发言、插话、接梗、互相回应，每人风格不同（参考他们的人设和已有记录里的说话方式），不要让一个人连着说太多条；红包、转账也要标明是哪个成员发的（sender）；用户没点名谁说时由你合理安排。
- 群里的 target 照抄「当前聊天」的名字。` : ""}
微信表情：文字里可以写 [名字] 表示表情，只能用这些名字：${EMOJI_NAME_LIST.join("、")}；不要用其他方括号表情或 Unicode 小黄脸，数量像真人聊天一样适度。读取聊天记录时表情也显示成 [名字]。
当前所有联系人：${contactNames || "（暂无）"}`;

export type Level = 0 | 1 | 2 | 3;

/** 拦截后逐级缩减上下文：0 完整 → 1 少量历史 → 2 只带每个聊天的最近 40 条且不带历史 → 3 什么都不带 */
export const buildSystem = (
	base: string,
	level: Level,
	contacts: Contact[],
	ctxIds: string[],
	/** 聊天窗口里的 AI：带上导入规则；私人 AI 不带（它不能改聊天） */
	chatMode?: { currentId: string },
) => {
	const groupText = chatMode && isGroupId(chatMode.currentId) ? groupMembersText(chatMode.currentId) : "";
	const now = dayjs().format("YYYY-MM-DD HH:mm dddd");
	const names = contacts.map((c) => c.name).slice(0, 150).join("、");
	const cur = chatMode ? contacts.find((c) => c.id === chatMode.currentId)?.name : undefined;
	let s = chatMode ? `${base}\n${WXCHAT_RULES(now, names, cur, groupText || undefined)}` : `${base}\n现在的真实时间：${now}`;
	if (level >= 3) return s;
	for (const id of ctxIds) {
		const c = contacts.find((x) => x.id === id);
		if (!c) continue;
		const log = chatLog(id, c.name, level === 2 ? 40 : undefined);
		s += `\n\n【与「${c.name}」的${level === 2 ? "最近" : "完整"}聊天记录（共 ${log.count} 条，格式：[时间] 说话人：内容）】\n${log.text || "（还没有消息）"}`;
	}
	return s;
};

/** AI 按用户一句话描述「生成声音」时附的 ```wxvoice 代码块 → 清洗后的声音档案（只含声纹、胸腔、气声、口音、人设，绝不含环境） */
export type VoiceMake = { name: string; sample: string; profile: VoiceProfile };

export const parseVoiceMake = (raw: string): { text: string; make?: VoiceMake } => {
	const m = raw.match(/```wxvoice\s*([\s\S]*?)```/);
	const text = raw.replace(/```wxvoice[\s\S]*?(```|$)/g, "").trim();
	if (!m) return { text };
	try {
		const j = parseJsonLoose<{ name?: string; voice?: string; fx?: number; chest?: number; air?: number; accent?: string; persona?: string; sample?: string }>(m[1]);
		const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
		const voice = GEMINI_VOICES.find((v) => v.id.toLowerCase() === String(j.voice ?? "").toLowerCase())?.id ?? "Aoede";
		const accent = VOICE_ACCENTS.includes(String(j.accent)) ? String(j.accent) : "默认自然口语";
		return {
			text,
			make: {
				name: String(j.name ?? "").trim().slice(0, 16) || "新声音",
				sample: String(j.sample ?? "").trim() || "你好呀，这是我给你调的新声音，你听听喜不喜欢？",
				profile: { voice, chest: clamp(j.fx ?? j.chest), air: clamp(j.air), accent, persona: String(j.persona ?? "").trim() },
			},
		};
	} catch {
		return { text: `${text}\n\n（AI 附上的声音参数格式有误，没能识别，请让它重新生成一次）` };
	}
};

export const parseAction = (raw: string): { text: string; action?: AiChatAction } => {
	const m = raw.match(/```wxchat\s*([\s\S]*?)```/);
	const text = raw.replace(/```wxchat[\s\S]*?(```|$)/g, "").trim();
	if (!m) return { text };
	try {
		const j = parseJsonLoose<{ target?: string; mode?: string; from?: string; to?: string; items?: unknown[] }>(m[1]);
		if (!Array.isArray(j.items) || j.items.length === 0) return { text };
		const mode = j.mode === "range" && j.from && j.to ? "range" : j.mode === "replace" ? "replace" : "append";
		return {
			text,
			action: { target: String(j.target ?? ""), mode, from: j.from, to: j.to, items: j.items },
		};
	} catch {
		return { text: `${text}\n\n（AI 附上的聊天数据格式有误，没能识别，请让它重新输出一次）` };
	}
};

export const resolveTarget = (target: string, contacts: Contact[], fallbackId?: string | null) => {
	const exact = contacts.find((c) => c.name === target || c.tokens.includes(target));
	if (exact) return exact;
	const loose = contacts.find((c) => c.tokens.some((t) => target.includes(t) || t.includes(target)));
	if (loose) return loose;
	return fallbackId ? contacts.find((c) => c.id === fallbackId) : undefined;
};

export const applyAction = (conversationId: string, action: AiChatAction) => {
	const range =
		action.mode === "range" && action.from && action.to
			? { from: dayjs(action.from).startOf("minute").valueOf(), to: dayjs(action.to).endOf("minute").valueOf() }
			: undefined;
	return applyParsedItems(conversationId, action.items as ParsedItem[], action.mode === "replace", true, range);
};
