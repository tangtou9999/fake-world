// 真实好友 ↔ 本机微信界面：真实好友就是通讯录/聊天列表里的普通好友（id 以 real- 开头），
// 和他的聊天记录以服务器为准（只增不改），实时收发走 WebSocket。
import { reflow } from "@/pages/wechat/my/settings/chatOps";
import { EConversationType, getConversationListValueSnapshot, setConversationListValue } from "@/stateV2/conversation";
import { setDialogueListValue } from "@/stateV2/dialogueList";
import { newProfile } from "@/stateV2/friendRequests";
import { getProfileValueSnapshot, setAllProfilesValue } from "@/stateV2/profile";
import { textToSlateChildren } from "@/wechatComponents/SlateText/emojiNames";
import dayjs from "dayjs";
import { api } from "./api";
import { API_BASE } from "./config";
import { readSession } from "./session";

type Friend = { id: number; name: string; phone: string; last: { id: number; from: number; text: string; ts: number } | null; unread: number };
type Msg = { id: number; sender: number; receiver: number; text: string; ts: number };

export const realId = (uid: number) => `real-${uid}`;
export const isRealConv = (id?: string) => !!id && id.startsWith("real-");
const uidOf = (id: string) => Number(id.slice(5));

const viewingId = () => {
	const m = window.location.hash.match(/\/wechat\/conversation\/(real-\d+)/);
	return m ? m[1] : "";
};
const timeLabel = (ts: number) => {
	const d = dayjs(ts);
	const today = dayjs();
	if (d.isSame(today, "day")) return d.format("HH:mm");
	if (d.isSame(today.subtract(1, "day"), "day")) return "昨天";
	return d.format("M/D");
};

function ensureFriend(f: Friend) {
	const id = realId(f.id);
	if (!getProfileValueSnapshot(id)) {
		const p = newProfile({ nickname: f.name, wechat: f.phone, avatarInfo: "" });
		setAllProfilesValue((prev) => [...prev, { ...p, id }]);
	}
}

function updateDialogue(f: Friend, viewing: boolean) {
	const id = realId(f.id);
	setDialogueListValue((prev) => {
		const existing = prev.find((v) => v.friendId === id);
		if (!f.last && !existing) return prev;
		const unread = viewing ? undefined : f.unread || undefined;
		const next = {
			...(existing ?? { id, friendId: id }),
			lastMessage: f.last ? f.last.text : (existing?.lastMessage ?? ""),
			lastMessageTime: f.last ? timeLabel(f.last.ts) : (existing?.lastMessageTime ?? ""),
			unreadMarkNumber: unread,
		};
		if (existing && existing.lastMessage === next.lastMessage && existing.lastMessageTime === next.lastMessageTime && existing.unreadMarkNumber === next.unreadMarkNumber) return prev;
		if (existing?.isPinned) return prev.map((v) => (v === existing ? next : v));
		const rest = prev.filter((v) => v !== existing);
		const pinned = rest.filter((v) => v.isPinned).length;
		return existing && existing.lastMessage === next.lastMessage ? prev.map((v) => (v === existing ? next : v)) : [...rest.slice(0, pinned), next, ...rest.slice(pinned)];
	});
}

const toItem = (m: Msg, me: number) => ({
	id: `r${m.id}`,
	type: EConversationType.text,
	role: m.sender === me ? "mine" : "friend",
	textContent: [{ type: "paragraph", children: textToSlateChildren(m.text) }],
	sendTimestamp: m.ts,
});

async function syncMessages(peerUid: number) {
	const me = readSession()?.user.id ?? 0;
	const { messages } = await api<{ messages: Msg[] }>(`/api/real/messages?peer=${peerUid}`);
	const items = reflow(messages.map((m) => toItem(m, me)) as Record<string, any>[], new Set());
	setConversationListValue(realId(peerUid), items as never);
}

let syncing = false;
let again = false;
export async function syncAll() {
	if (syncing) {
		again = true;
		return;
	}
	syncing = true;
	try {
		const { friends } = await api<{ friends: Friend[] }>("/api/real/friends");
		const watching = viewingId();
		for (const f of friends) {
			ensureFriend(f);
			const id = realId(f.id);
			const localLast = getConversationListValueSnapshot(id).at(-1)?.id;
			if (f.last && localLast !== `r${f.last.id}`) await syncMessages(f.id);
			const viewing = watching === id;
			updateDialogue(f, viewing);
			if (viewing && f.unread && f.last) void api("/api/real/read", { body: { peer: f.id, upTo: f.last.id } }).catch(() => {});
		}
	} catch {
		// 断网或服务器暂时不可用：下一轮再试
	} finally {
		syncing = false;
		if (again) {
			again = false;
			void syncAll();
		}
	}
}

export async function sendRealText(convId: string, text: string) {
	const t = text.trim();
	if (!t) return;
	await api("/api/real/messages", { body: { to: uidOf(convId), text: t } });
	await syncMessages(uidOf(convId));
	void syncAll();
}

let started = false;
export function startRealSync() {
	if (started) return;
	started = true;
	let retry = 0;
	let ws: WebSocket | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const soon = () => {
		clearTimeout(timer);
		timer = setTimeout(() => void syncAll(), 120);
	};
	const connect = () => {
		const token = readSession()?.token;
		if (!token) return;
		const base = (API_BASE || window.location.origin).replace(/^http/, "ws");
		ws = new WebSocket(`${base}/ws?token=${encodeURIComponent(token)}`);
		ws.onopen = () => {
			retry = 0;
			soon();
		};
		ws.onmessage = soon;
		ws.onclose = () => setTimeout(connect, Math.min(15000, 1000 * 2 ** retry++));
	};
	connect();
	soon();
	setInterval(() => void syncAll(), 15000);
	document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && soon());
	window.addEventListener("hashchange", soon);
}
