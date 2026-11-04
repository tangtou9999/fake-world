import { FILE_HELPER_ID, FILE_HELPER_PROFILE } from "@/faker/wechat/user/fileHelper";
import dayjs from "dayjs";
import { setConversationListValue } from "./conversation";
import { type IDialogueItem, setDialogueListValue } from "./dialogueList";
import { multipleDeviceLoginAtom } from "./multipleDeviceLogin";
import { setAllProfilesValue } from "./profile";
import { mainStore } from "./store";

const SEEDED_KEY = "fileHelperSeeded";

/**
 * 「文件传输助手」：当备忘录用的对话。只在第一次打开（或清除数据后）加进主页，
 * 以后用户自己删掉就不会再冒出来；已有数据的老用户也会补上。
 */
export function ensureFileHelper() {
	try {
		upgradeV2();
		upgradeV3();
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
							isPinned: true,
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

/**
 * 在任意聊天里发了消息后：同步主页那一行的预览文字和时间，
 * 并把这个聊天移到列表最上面（置顶的聊天仍在最前）。
 */
export function touchDialogue(friendId: string, preview: string) {
	setDialogueListValue((prev) => {
		const time = dayjs().format("HH:mm");
		const existing = prev.find((v) => v.friendId === friendId);
		const updated: IDialogueItem = existing
			? { ...existing, lastMessage: preview, lastMessageTime: time, unreadMarkNumber: undefined }
			: { id: friendId, friendId, lastMessage: preview, lastMessageTime: time };
		if (updated.isPinned) {
			return existing ? prev.map((v) => (v === existing ? updated : v)) : [updated, ...prev];
		}
		const rest = prev.filter((v) => v !== existing);
		const pinnedCount = rest.filter((v) => v.isPinned).length;
		return [...rest.slice(0, pinnedCount), updated, ...rest.slice(pinnedCount)];
	});
}

export const touchFileHelperDialogue = (preview: string) => touchDialogue(FILE_HELPER_ID, preview);

/** v2：换成真实图标、置顶，并默认隐藏「iPad 微信已登录」条（只执行一次） */
function upgradeV2() {
	if (localStorage.getItem("fileHelperV2")) return;
	localStorage.setItem("fileHelperV2", "1");
	setAllProfilesValue((prev) =>
		prev.map((v) =>
			v.id === FILE_HELPER_ID ? { ...v, avatarInfo: FILE_HELPER_PROFILE.avatarInfo } : v,
		),
	);
	setDialogueListValue((prev) =>
		prev.map((v) => (v.friendId === FILE_HELPER_ID ? { ...v, isPinned: true } : v)),
	);
	mainStore.set(multipleDeviceLoginAtom, (prev) => ({ ...prev, visible: false }));
}

/** v3：修正导入数据里超过 24 点的错误时间（如"昨天 28:31"） */
function upgradeV3() {
	if (localStorage.getItem("fileHelperV3")) return;
	localStorage.setItem("fileHelperV3", "1");
	setDialogueListValue((prev) =>
		prev.map((v) =>
			v.lastMessageTime.replace(
				/(\d{1,2}):(\d{2})/,
				(whole, h: string, m: string) => (Number(h) > 23 ? `${String(Number(h) - 12).padStart(2, "0")}:${m}` : whole),
			) === v.lastMessageTime
				? v
				: {
						...v,
						lastMessageTime: v.lastMessageTime.replace(
							/(\d{1,2}):(\d{2})/,
							(whole, h: string, m: string) => (Number(h) > 23 ? `${String(Number(h) - 12).padStart(2, "0")}:${m}` : whole),
						),
					},
		),
	);
}
