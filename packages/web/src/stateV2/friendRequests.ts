import dayjs from "dayjs";
import { nanoid } from "nanoid";
import atomWithStorage from "./atomWithStorage";
import { EConversationType, type TConversationItem, setConversationListValue } from "./conversation";
import { touchDialogue } from "./fileHelper";
import { type IStateProfile, setAllProfilesValue } from "./profile";
import { mainStore } from "./store";

export type FriendRequest = {
	id: string;
	/** in：别人加我；out：我加别人 */
	direction: "in" | "out";
	status: "pending" | "added" | "expired";
	nickname: string;
	wechat: string;
	phone?: string;
	avatarInfo: string;
	greeting: string;
	timestamp: number;
};

const H = 3600 * 1000;
const av = (path: string) => `${import.meta.env.BASE_URL}imported/${path}`;
const mk = (
	id: string,
	hoursAgo: number,
	direction: FriendRequest["direction"],
	status: FriendRequest["status"],
	nickname: string,
	greeting: string,
	avatar: string,
	phone?: string,
): FriendRequest => ({
	id,
	direction,
	status,
	nickname,
	greeting,
	phone,
	wechat: `wxid_${id}`,
	avatarInfo: av(avatar),
	timestamp: Date.now() - hoursAgo * H,
});

const SEED_REQUESTS: FriendRequest[] = [
	mk("r01", 3, "in", "pending", "王", "我是王", "c010/thumb2.jpg"),
	mk("r02", 9, "in", "pending", "A0张经理", "你好，看到你发的信息，想了解一下", "c009/thumb1.jpg", "18796969891"),
	mk("r03", 20, "in", "pending", "Linh Trần", "Xin chào, mình là Linh, bạn của anh Minh", "c013/thumb3.jpg"),
	mk("r04", 30, "in", "pending", "李想", "我是李想，朋友推荐的", "c010/thumb4.jpg"),
	mk("r05", 44, "in", "pending", "Hoàng Mai Nail", "Chào anh, em muốn hỏi về dịch vụ ạ", "c014/thumb2.jpg", "0912345678"),
	mk("r06", 60, "in", "pending", "陈老师", "我是陈老师，之前在群里聊过", "c003/thumb2.jpg"),
	mk("r07", 70, "in", "pending", "小周", "在吗，加一下", "c012/thumb1.jpg"),
	mk("r08", 100, "in", "added", "Tuấn 河内", "你好，我是Tuấn", "c009/thumb3.jpg"),
	mk("r09", 130, "in", "expired", "刘总-新课推荐", "新课推荐：《AI建模+3D打印》限时优惠，欢迎了解", "c015/thumb2.jpg"),
	mk("r10", 150, "out", "added", "Nguyen Thi Hoa", "我是戴先生", "c016/thumb1.jpg"),
];

export const friendRequestsAtom = atomWithStorage<FriendRequest[]>(
	"wechat-friend-requests-v2",
	SEED_REQUESTS,
);

const text = (s: string) => [{ type: "paragraph", children: [{ text: s }] }] as never;

const letterAvatar = (name: string) =>
	`data:image/svg+xml;utf8,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#B9BEC6"/><text x="48" y="64" text-anchor="middle" font-size="46" fill="#fff" font-family="sans-serif">${(name.trim()[0] || "?").replace(/[<>&]/g, "")}</text></svg>`,
	)}`;

export function newProfile(p: { nickname: string; wechat: string; avatarInfo: string; extra?: Partial<IStateProfile> }): IStateProfile {
	return {
		...p.extra,
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
export const IMAGE_NOTE_LINK = "添加到备注";

/** 我添加别人：对方已通过 */
export function addFriendByMe(p: {
	nickname: string;
	wechat: string;
	avatarInfo: string;
	greeting: string;
	firstReply?: string;
	/** 性别、地区、个性签名、备注、标签等资料 */
	extra?: Partial<IStateProfile>;
}) {
	const profile = newProfile(p);
	setAllProfilesValue((prev) => [...prev, profile]);
	const now = Date.now();
	mainStore.set(friendRequestsAtom, (prev) => [
		{
			id: nanoid(6),
			direction: "out",
			status: "added",
			nickname: p.nickname,
			wechat: p.wechat,
			avatarInfo: profile.avatarInfo,
			greeting: p.greeting || "我是我",
			timestamp: now,
		},
		...prev,
	]);
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
	mainStore.set(friendRequestsAtom, (prev) =>
		prev.map((v) => (v.id === req.id ? { ...v, status: "added" } : v)),
	);
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
