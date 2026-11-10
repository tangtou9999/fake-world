import { importedConversations } from "@/faker/wechat/imported";
import { dequal } from "dequal/lite";
import type { SetStateAction } from "jotai";
import { focusAtom } from "jotai-optics";
import { atomFamily } from "jotai/utils";
import atomWithStorage from "../atomWithStorage";
import type { IStateProfile } from "../profile";
import { mainStore } from "../store";
import { ensureIds, ensureMoneyPairs } from "./records";
import type { TConversationItem } from "./typing";

export type TStateConversationList = TConversationItem[];

export const conversationListAtom = atomFamily((id: IStateProfile["id"]) => {
	const base = atomWithStorage<TStateConversationList>(
		`conversationList-${id}`,
		importedConversations[id] ?? [],
	);
	// 打开这个聊天时，给缺 id 的旧消息补上。其它字段不动，也不改已经有 id 的记录。
	base.onMount = (set) => {
		const ids = ensureIds(mainStore.get(base));
		const paired = ensureMoneyPairs(ids.list);
		if (ids.changed || paired.changed) set(paired.list);
	};
	return base;
});

export const getConversationListValueSnapshot = (id: IStateProfile["id"]) =>
	mainStore.get(conversationListAtom(id));
export const setConversationListValue = (
	id: IStateProfile["id"],
	params: SetStateAction<TStateConversationList>,
) => mainStore.set(conversationListAtom(id), params);

export const conversationItemReferenceAtom = atomFamily(
	(params: { friendId: IStateProfile["id"]; conversationId: TConversationItem["id"] }) =>
		focusAtom(conversationListAtom(params.friendId), (optic) =>
			optic.find((v) => v.id === params.conversationId),
		),
	dequal,
);
