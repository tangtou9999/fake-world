// 真实好友 ↔ 本机微信界面：真实好友就是通讯录/聊天列表里的普通好友（id 以 real- 开头），
// 和他的聊天记录以服务器为准（只增不改），实时收发走 WebSocket。
import { reflow } from "@/pages/wechat/my/settings/chatOps";
import { EConversationType, getConversationListValueSnapshot, setConversationListValue } from "@/stateV2/conversation";
import { setDialogueListValue } from "@/stateV2/dialogueList";
import { newProfile } from "@/stateV2/friendRequests";
import { hashAssetsDB } from "@/db";
import { getProfileValueSnapshot, setAllProfilesValue } from "@/stateV2/profile";
import { isMD5 } from "@/utils";
import { textToSlateChildren } from "@/wechatComponents/SlateText/emojiNames";
import dayjs from "dayjs";
import { api } from "./api";
import { API_BASE } from "./config";
import { readSession } from "./session";

type Friend = { id: number; name: string; avatar: number | null; phone: string; last: { id: number; from: number; text: string; ts: number } | null; unread: number };
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

const avatarSeen: Record<string, number> = (() => {
	try {
		return JSON.parse(localStorage.getItem("real-avatars") || "{}");
	} catch {
		return {};
	}
})();

async function toDataUrl(blob: Blob) {
	return await new Promise<string>((ok, no) => {
		const r = new FileReader();
		r.onload = () => ok(String(r.result));
		r.onerror = () => no(new Error("read"));
		r.readAsDataURL(blob);
	});
}

async function loadAvatar(f: Friend) {
	if (!f.avatar || avatarSeen[f.id] === f.avatar) return;
	try {
		const token = readSession()?.token;
		const res = await fetch(`${API_BASE}/api/real/blob/${f.avatar}`, { headers: { Authorization: `Bearer ${token}` } });
		if (!res.ok) return;
		const url = await toDataUrl(await res.blob());
		const id = realId(f.id);
		setAllProfilesValue((prev) => prev.map((p) => (p.id === id ? { ...p, avatarInfo: url } : p)));
		avatarSeen[f.id] = f.avatar;
		localStorage.setItem("real-avatars", JSON.stringify(avatarSeen));
	} catch {
		// 下次再试
	}
}

function ensureFriend(f: Friend) {
	const id = realId(f.id);
	const cur = getProfileValueSnapshot(id);
	if (!cur) {
		const p = newProfile({ nickname: f.name, wechat: f.phone, avatarInfo: "" });
		setAllProfilesValue((prev) => [...prev, { ...p, id }]);
	} else if (cur.nickname !== f.name) {
		setAllProfilesValue((prev) => prev.map((p) => (p.id === id ? { ...p, nickname: f.name } : p)));
	}
	void loadAvatar(f);
}

function updateDialogue(f: Friend, viewing: boolean) {
	const id = realId(f.id);
	setDialogueListValue((prev) => {
		const existing = prev.find((v) => v.friendId === id);
		// 真实好友一开通就出现在聊天列表里（即使还没聊过）
		const unread = viewing ? undefined : f.unread || undefined;
		const next = {
			...(existing ?? { id, friendId: id }),
			lastMessage: f.last ? preview(f.last.text) : (existing?.lastMessage ?? ""),
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

const VOICE_RE = /^\[\[voice:(\d+):(\d+)\]\]$/;
const CALL_RE = /^\[\[call:voice:(accepted|rejected|cancelled):(\d+)\]\]$/;
const preview = (t: string) => (VOICE_RE.test(t) ? "[语音]" : CALL_RE.test(t) ? "[语音通话]" : t);

const toItem = (m: Msg, me: number) => {
	const v = m.text.match(VOICE_RE);
	if (v) return { id: `r${m.id}`, type: EConversationType.voice, role: m.sender === me ? "mine" : "friend", duration: Number(v[2]), voiceBlob: v[1], isRead: true, sendTimestamp: m.ts };
	const c = m.text.match(CALL_RE);
	if (c) return { id: `r${m.id}`, type: EConversationType.call, role: m.sender === me ? "mine" : "friend", callStatus: c[1], seconds: Number(c[2]) || undefined, callKind: "voice", sendTimestamp: m.ts };
	return toText(m, me);
};
const toText = (m: Msg, me: number) => ({
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

export async function sendRealVoice(convId: string, blob: Blob, seconds: number) {
	const token = readSession()?.token;
	const res = await fetch(`${API_BASE}/api/real/voice?to=${uidOf(convId)}&dur=${seconds}`, { method: "POST", headers: { "Content-Type": blob.type.split(";")[0], Authorization: `Bearer ${token}` }, body: blob });
	if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "语音发送失败");
	await syncMessages(uidOf(convId));
	void syncAll();
}

const urlCache = new Map<string, string>();
export async function realVoiceUrl(blobId: string) {
	const hit = urlCache.get(blobId);
	if (hit) return hit;
	const token = readSession()?.token;
	const res = await fetch(`${API_BASE}/api/real/blob/${blobId}`, { headers: { Authorization: `Bearer ${token}` } });
	if (!res.ok) throw new Error("语音加载失败");
	const u = URL.createObjectURL(await res.blob());
	urlCache.set(blobId, u);
	return u;
}

async function avatarForUpload(avatarInfo: string): Promise<string | null> {
	let blob: Blob | null = null;
	if (isMD5(avatarInfo)) blob = (await hashAssetsDB.images.get(avatarInfo))?.file ?? null;
	else if (avatarInfo.startsWith("data:") || avatarInfo.startsWith("blob:") || avatarInfo.startsWith("http") || avatarInfo.startsWith("/")) blob = await (await fetch(avatarInfo)).blob();
	if (!blob) return null;
	const bmp = await createImageBitmap(blob);
	const size = 256;
	const c = document.createElement("canvas");
	c.width = c.height = size;
	const g = c.getContext("2d");
	if (!g) return null;
	const side = Math.min(bmp.width, bmp.height);
	g.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
	return c.toDataURL("image/jpeg", 0.82);
}

let profBusy = false;
/** 本机「我」的头像/昵称有变化就传到服务器，好友那边实时更新 */
export async function syncMyProfile() {
	const me = getProfileValueSnapshot("0");
	if (!me || profBusy) return;
	const key = `${me.nickname}|${me.avatarInfo}`;
	if (localStorage.getItem("real-prof-sent") === key) return;
	profBusy = true;
	try {
		const body: { nickname: string; avatar?: string } = { nickname: me.nickname };
		if (me.avatarInfo) {
			const a = await avatarForUpload(me.avatarInfo).catch(() => null);
			if (a) body.avatar = a;
		}
		await api("/api/real/profile", { method: "PUT", body });
		localStorage.setItem("real-prof-sent", key);
	} catch {
		// 下次再试
	} finally {
		profBusy = false;
	}
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
		void syncMyProfile();
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

type Signal = { type: string; from: number; callId: string; data: unknown };
let signalHandler: ((m: Signal) => void) | null = null;
export const setSignalHandler = (h: (m: Signal) => void) => {
	signalHandler = h;
};
let wsRef: WebSocket | null = null;
export function wsSend(obj: Record<string, unknown>) {
	if (wsRef?.readyState !== WebSocket.OPEN) return false;
	wsRef.send(JSON.stringify(obj));
	return true;
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
