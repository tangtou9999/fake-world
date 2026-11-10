import { fromLastGenerateUpperText, setConversationListValue, type TConversationItem, EConversationType } from "@/stateV2/conversation";
import { isGroupId } from "@/stateV2/group";
import atomWithStorage from "@/stateV2/atomWithStorage";
import { mainStore } from "@/stateV2/store";
import { callGemini } from "@/utils/gemini";
import { textToSlateChildren } from "@/wechatComponents/SlateText/emojiNames";
import { showToast } from "@/wechatComponents/Toast";
import dayjs from "dayjs";
import { nanoid } from "nanoid";
import { chatLog, listContacts } from "@/pages/wechat/my/settings/aiChatTools";

/** 编辑模式下，哪些聊天开启了「AI 代回」 */
export const standInAtom = atomWithStorage<Record<string, boolean>>("ai-stand-in", {});

const chain = new Map<string, Promise<void>>();
const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

const run = async (conversationId: string) => {
	if (!mainStore.get(standInAtom)[conversationId] || isGroupId(conversationId)) return;
	const contact = listContacts().find((c) => c.id === conversationId);
	const name = contact?.name ?? "对方";
	const log = chatLog(conversationId, name, 40);
	let reply = "";
	try {
		reply = await callGemini("我刚发来一条消息。请只用这个好友以往的语气回复，1 到 3 条，每条一行，不要解释，不要代码块。", {
			system: `你在扮演微信好友「${name}」。下面是你们的聊天，最后几条是刚发生的。按这个人的口气回，短句，口语。\n${log.text}`,
			windowKey: `standin:${conversationId}`,
		});
	} catch (e) {
		showToast({ content: e instanceof Error ? e.message : "AI 代回失败" });
		return;
	}
	const lines = reply
		.replace(/```[\s\S]*?```/g, "")
		.split(/\n+/)
		.map((s) => s.replace(/^[\d.、\-\s]+/, "").trim())
		.filter((s) => s && !s.startsWith("```"))
		.slice(0, 3);
	for (let i = 0; i < lines.length; i++) {
		if (i > 0) await wait(800);
		const line = lines[i];
		setConversationListValue(conversationId, (prev) => [
			...prev,
			{
				id: nanoid(8),
				type: EConversationType.text,
				role: "friend",
				textContent: [{ type: "paragraph", children: textToSlateChildren(line) }],
				sendTimestamp: dayjs().valueOf(),
				upperText: fromLastGenerateUpperText(prev),
			} as TConversationItem,
		]);
	}
};

/** 用户以「我」发出一条后调用。按队列回复，避免两条回复叠在一起。 */
export const replyAsFriend = (conversationId: string) => {
	if (!mainStore.get(standInAtom)[conversationId]) return;
	const prev = chain.get(conversationId) ?? Promise.resolve();
	const next = prev.then(() => run(conversationId)).catch(() => undefined);
	chain.set(conversationId, next);
};
