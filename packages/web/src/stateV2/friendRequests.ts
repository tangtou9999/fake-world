import dayjs from "dayjs";
import { nanoid } from "nanoid";
import atomWithStorage from "./atomWithStorage";
import { EConversationType, type TConversationItem, setConversationListValue } from "./conversation";
import { touchDialogue } from "./fileHelper";
import { type IStateProfile, setAllProfilesValue } from "./profile";

export type FriendRequest = {
	id: string;
	nickname: string;
	wechat: string;
	avatarInfo: string;
	greeting: string;
	accepted?: boolean;
	timestamp: number;
};

export const friendRequestsAtom = atomWithStorage<FriendRequest[]>("wechat-friend-requests", []);

const text = (s: string) => [{ type: "paragraph", children: [{ text: s }] }] as never;

const letterAvatar = (name: string) =>
	`data:image/svg+xml;utf8,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#B9BEC6"/><text x="48" y="64" text-anchor="middle" font-size="46" fill="#fff" font-family="sans-serif">${(name.trim()[0] || "?").replace(/[<>&]/g, "")}</text></svg>`,
	)}`;

function newProfile(p: { nickname: string; wechat: string; avatarInfo: string }): IStateProfile {
	return {
		id: `friend-${nanoid(6)}`,
		nickname: p.nickname,
		wechat: p.wechat || p.nickname,
		avatarInfo: p.avatarInfo || letterAvatar(p.nickname),
		privacy: "all",
		momentsPrivacy: "all",
		thumbnailInfo: [],
		momentsBackgroundLike: false,
	};
}

export const CENTER_LINK = "使用常用打招呼内容";

/** 我添加别人：对方已通过 */
export function addFriendByMe(p: {
	nickname: string;
	wechat: string;
	avatarInfo: string;
	greeting: string;
	firstReply?: string;
}) {
	const profile = newProfile(p);
	setAllProfilesValue((prev) => [...prev, profile]);
	const now = Date.now();
	const items: TConversationItem[] = [
		{
			id: nanoid(8),
			type: EConversationType.text,
			role: "mine",
			textContent: text(p.greeting || "我是我"),
			upperText: dayjs(now).format("HH:mm"),
			sendTimestamp: now,
		},
		{
			id: nanoid(8),
			type: EConversationType.centerText,
			role: "friend",
			simpleContent: "以上是打招呼的消息",
			sendTimestamp: now,
		},
		{
			id: nanoid(8),
			type: EConversationType.text,
			role: "friend",
			textContent: text("我通过了你的朋友验证请求，现在我们可以开始聊天了"),
			sendTimestamp: now,
		},
	];
	if (p.firstReply) {
		items.push({
			id: nanoid(8),
			type: EConversationType.text,
			role: "friend",
			textContent: text(p.firstReply),
			sendTimestamp: now,
		});
	}
	setConversationListValue(profile.id, items);
	touchDialogue(profile.id, p.firstReply || "我通过了你的朋友验证请求，现在我们可以开始聊天了");
	return profile.id;
}

/** 别人添加我：接受后生成聊天 */
export function acceptFriendRequest(req: FriendRequest) {
	const profile = newProfile(req);
	setAllProfilesValue((prev) => [...prev, profile]);
	const now = Date.now();
	setConversationListValue(profile.id, [
		{
			id: nanoid(8),
			type: EConversationType.text,
			role: "friend",
			textContent: text(req.greeting),
			upperText: dayjs(now).format("HH:mm"),
			sendTimestamp: now,
		},
		{
			id: nanoid(8),
			type: EConversationType.centerText,
			role: "friend",
			simpleContent: `你已添加了${req.nickname}，以上是打招呼的消息，${CENTER_LINK}介绍自己。`,
			sendTimestamp: now,
		},
	]);
	touchDialogue(profile.id, req.greeting);
	return profile.id;
}
