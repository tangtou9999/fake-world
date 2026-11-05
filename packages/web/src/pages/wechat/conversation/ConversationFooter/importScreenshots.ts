import {
	EConversationType,
	type TConversationItem,
	setConversationListValue,
} from "@/stateV2/conversation";
import { touchDialogue } from "@/stateV2/fileHelper";
import { type GeminiImage, callGemini, parseJsonLoose } from "@/utils/gemini";
import { nanoid } from "nanoid";

export type ParsedItem = {
	kind: "text" | "time" | "system" | "redPacket" | "transfer" | "voice" | "image" | "other";
	who?: "friend" | "me";
	text?: string;
	amount?: string;
	note?: string;
	status?: "accepted" | "awaiting" | "expired" | "rejected";
	seconds?: number;
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
	const raw = await callGemini(IMPORT_PROMPT, { json: true, images });
	const list = parseJsonLoose<ParsedItem[]>(raw);
	if (!Array.isArray(list) || list.length === 0) throw new Error("没有识别出聊天内容，换清晰一点的截图再试");
	return list;
}

const paragraph = (text: string) => [{ type: "paragraph", children: [{ text }] }] as never;

/** 把识别结果写入聊天；replace=true 时先清空原有记录 */
export function applyParsedItems(conversationId: string, list: ParsedItem[], replace: boolean) {
	const base = Date.now() - list.length * 60_000;
	let pendingTime: string | undefined;
	const items: TConversationItem[] = [];
	let lastPreview = "";
	list.forEach((it, i) => {
		const role = it.who === "me" ? "mine" : "friend";
		const common = { id: nanoid(8), sendTimestamp: base + i * 60_000 } as const;
		const upper = pendingTime;
		const takeUpper = () => {
			pendingTime = undefined;
			return upper;
		};
		switch (it.kind) {
			case "time":
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
				items.push({ ...common, type: EConversationType.voice, role, duration: Math.max(1, Math.round(it.seconds || 3)), showStt: !!it.text, stt: it.text, upperText: takeUpper() } as TConversationItem);
				lastPreview = "[语音]";
				return;
			default: {
				const text = it.text || (it.kind === "image" ? "[图片]" : "");
				if (!text) return;
				items.push({ ...common, type: EConversationType.text, role, textContent: paragraph(text), upperText: takeUpper() } as TConversationItem);
				lastPreview = text;
			}
		}
	});
	setConversationListValue(conversationId, (prev) => (replace ? items : [...prev, ...items]));
	if (lastPreview) touchDialogue(conversationId, lastPreview);
	return items.length;
}
