import { FILE_HELPER_ID, FILE_HELPER_PROFILE } from "@/faker/wechat/user/fileHelper";
import dayjs from "dayjs";
import { setConversationListValue } from "./conversation";
import { setDialogueListValue } from "./dialogueList";
import { setAllProfilesValue } from "./profile";

const SEEDED_KEY = "fileHelperSeeded";

/**
 * 「文件传输助手」：当备忘录用的对话。只在第一次打开（或清除数据后）加进主页，
 * 以后用户自己删掉就不会再冒出来；已有数据的老用户也会补上。
 */
export function ensureFileHelper() {
	try {
		if (localStorage.getItem(SEEDED_KEY)) return;
		setAllProfilesValue((prev) =>
			prev.some((v) => v.id === FILE_HELPER_ID) ? prev : [...prev, FILE_HELPER_PROFILE],
		);
		setDialogueListValue((prev) =>
			prev.some((v) => v.friendId === FILE_HELPER_ID)
				? prev
				: [
						{
							id: FILE_HELPER_ID,
							friendId: FILE_HELPER_ID,
							lastMessage: "",
							lastMessageTime: "",
						},
						...prev,
					],
		);
		if (localStorage.getItem(`conversationList-${FILE_HELPER_ID}`) === null) {
			setConversationListValue(FILE_HELPER_ID, []);
		}
		localStorage.setItem(SEEDED_KEY, "1");
	} catch {
		// 隐私模式等拿不到 localStorage 时，直接跳过
	}
}

/** 在文件传输助手里发了消息后，同步主页那一行的预览文字和时间 */
export function touchFileHelperDialogue(preview: string) {
	setDialogueListValue((prev) =>
		prev.map((v) =>
			v.friendId === FILE_HELPER_ID
				? { ...v, lastMessage: preview, lastMessageTime: dayjs().format("HH:mm") }
				: v,
		),
	);
}
