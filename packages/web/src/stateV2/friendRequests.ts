import dayjs from "dayjs";
import { nanoid } from "nanoid";
import atomWithStorage from "./atomWithStorage";
import { EConversationType, type TConversationItem, setConversationListValue } from "./conversation";
import { touchDialogue } from "./fileHelper";
import { type IStateProfile, setAllProfilesValue } from "./profile";
import { mainStore } from "./store";

export type FriendRequest = {
	id: string;
	nickname: string;
	wechat: string;
	avatarInfo: string;
	greeting: string;
	accepted?: boolean;
	/** in：别人加我；out：我加别人（默认 in） */
	direction?: "in" | "out";
	expired?: boolean;
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
	mainStore.set(friendRequestsAtom, (prev) => [
		{
			id: nanoid(6),
			nickname: p.nickname,
			wechat: p.wechat,
			avatarInfo: profile.avatarInfo,
			greeting: p.greeting || "我是我",
			accepted: true,
			direction: "out",
			timestamp: now,
		},
		...prev,
	]);
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
	mainStore.set(friendRequestsAtom, (prev) =>
		prev.map((v) => (v.id === req.id ? { ...v, accepted: true } : v)),
	);
	touchDialogue(profile.id, req.greeting);
	return profile.id;
}

const H = 3600 * 1000;
const SEED: [string, string, string, string, number, boolean?][] = [
	["王建国", "wjg_2024", "imported/c010/moments/m01_1.jpg", "我是王建国", 2],
	["Linh Trần", "linh.tran88", "imported/c013/moments/m01_1.jpg", "Xin chào, mình là Linh, bạn của anh Nam", 9],
	["刘总-装修", "liu_zhuangxiu", "imported/c009/moments/m05_1.jpg", "你好，我是做装修的刘总，之前在群里看到您，想加您认识一下，后面有越南这边的业务可以多交流合作", 20],
	["Minh Anh", "minhanh_hn", "imported/c014/moments/m05_1.jpg", "Hi, em là Minh Anh", 33],
	["阿杰", "ajie_0707", "imported/c002/moments/m02_1.jpg", "我是阿杰", 52],
	["Thu Hà", "thuha.vn", "imported/c017/moments/m05_1.jpg", "Chào anh, em muốn hỏi về dịch vụ của anh ạ", 79],
	["陈老板-建材", "chenboss", "imported/c004/moments/m03_1.jpg", "你好，我是陈老板", 100],
	["小雅", "xiaoya_vn", "imported/c016/moments/m05_1.jpg", "你好，请问是戴先生吗？我是朋友介绍来的", 130],
	["Hùng Phạm", "hungpham1990", "imported/c015/moments/m05_1.jpg", "Em là Hùng", 200, true],
];

/** 首次打开时塞一批「别人添加我」的待验证好友，可以在「新的朋友」里手动接受 */
export function seedFriendRequests() {
	if (localStorage.getItem("friendRequestsSeeded")) return;
	localStorage.setItem("friendRequestsSeeded", "1");
	const now = Date.now();
	mainStore.set(friendRequestsAtom, (prev) => [
		...SEED.map(([nickname, wechat, avatarInfo, greeting, hoursAgo, expired], i) => ({
			id: `seed${i}`,
			nickname,
			wechat,
			avatarInfo,
			greeting,
			expired,
			direction: "in" as const,
			timestamp: now - hoursAgo * H,
		})),
		...prev,
	]);
}
