import { MYSELF_ID } from "@/faker/wechat/user";
import dayjs from "dayjs";
import { atom } from "jotai";
import { atomFamily } from "jotai/utils";
import { nanoid } from "nanoid";
import atomWithStorage from "./atomWithStorage";
import { getDialogueListValueSnapshot, setDialogueListValue } from "./dialogueList";
import { type IStateProfile, getAllProfilesValueSnapshot } from "./profile";
import { mainStore } from "./store";

export interface IGroup {
	id: string;
	name: string;
	/** 群成员 id（含我自己） */
	memberIds: IStateProfile["id"][];
	ownerId: IStateProfile["id"];
	announcement?: string;
	remark?: string;
	/** 我在本群的昵称 */
	myNick?: string;
	/** 显示群成员昵称，默认开 */
	showNick?: boolean;
	/** 保存到通讯录 */
	saved?: boolean;
	/** 折叠该聊天 */
	fold?: boolean;
	/** 群聊信息页里显示的人数（想要「498」这种大群时填，空则用成员数） */
	displayCount?: number;
}

export const GROUP_PREFIX = "g_";
export const isGroupId = (id?: string) => !!id && id.startsWith(GROUP_PREFIX);

export const groupsAtom = atomWithStorage<IGroup[]>("groups", []);
export const groupAtom = atomFamily((id: string) => atom((get) => get(groupsAtom).find((g) => g.id === id)));

export const getGroup = (id: string) => mainStore.get(groupsAtom).find((g) => g.id === id);
export const updateGroup = (id: string, patch: Partial<IGroup>) =>
	mainStore.set(groupsAtom, (prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
export const groupCount = (g: IGroup) => g.displayCount ?? g.memberIds.length;

/** 群里「对方」这边下一条消息由谁发：编辑模式里选，按聊天各自记住 */
export const groupSenderAtom = atomWithStorage<Record<string, string>>("group-sender", {});

/** 给新建的「对方」消息用的发送人：已选的成员，否则第一个非我成员 */
export const currentSenderId = (conversationId: string): string | undefined => {
	const g = getGroup(conversationId);
	if (!g) return undefined;
	const others = g.memberIds.filter((m) => m !== MYSELF_ID);
	const picked = mainStore.get(groupSenderAtom)[conversationId];
	return picked && others.includes(picked) ? picked : others[0];
};

const autoName = (ids: string[]) => {
	const all = getAllProfilesValueSnapshot();
	return ids
		.filter((i) => i !== MYSELF_ID)
		.slice(0, 3)
		.map((i) => {
			const p = all.find((x) => x.id === i);
			return p?.remark || p?.nickname || "";
		})
		.filter(Boolean)
		.join("、");
};

export const createGroup = (memberIds: string[], name?: string) => {
	const ids = [MYSELF_ID, ...memberIds.filter((m) => m !== MYSELF_ID)];
	const id = `${GROUP_PREFIX}${nanoid(8)}`;
	const g: IGroup = { id, name: name?.trim() || autoName(ids) || "群聊", memberIds: ids, ownerId: MYSELF_ID, showNick: true };
	mainStore.set(groupsAtom, (prev) => [g, ...prev]);
	setDialogueListValue((prev) => {
		const pinned = prev.filter((v) => v.isPinned).length;
		return [...prev.slice(0, pinned), { id, friendId: id, lastMessage: "", lastMessageTime: dayjs().format("HH:mm") }, ...prev.slice(pinned)];
	});
	return id;
};

export const deleteGroup = (id: string) => {
	mainStore.set(groupsAtom, (prev) => prev.filter((g) => g.id !== id));
	if (getDialogueListValueSnapshot().some((v) => v.id === id)) setDialogueListValue((prev) => prev.filter((v) => v.id !== id));
};

/** 没有记录发送人的旧消息：算在第一个非我成员头上 */
export const groupDefaultSender = (conversationId: string): string | undefined => {
	const g = getGroup(conversationId);
	return g?.memberIds.find((m) => m !== MYSELF_ID);
};
