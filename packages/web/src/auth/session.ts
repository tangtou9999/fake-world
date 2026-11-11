import { AUTH_ENABLED } from "./config";

export type PermKey = "editMode" | "editBalance" | "editChat" | "chatAi" | "momentsAi" | "addFriend";
export const PERM_LABELS: Record<PermKey, string> = {
	editMode: "编辑模式",
	editBalance: "修改余额/账单",
	editChat: "修改聊天记录",
	chatAi: "聊天 AI / 私人 AI",
	momentsAi: "朋友圈 AI",
	addFriend: "添加好友",
};
export const PERM_KEYS = Object.keys(PERM_LABELS) as PermKey[];

export type AuthUser = {
	id: number;
	phone: string;
	name: string;
	role: "admin" | "real" | "story";
	perms: Record<PermKey, boolean>;
	disabled: boolean;
};
export type Session = { token: string; user: AuthUser; verifiedAt: number };

/** 唯一不加账号前缀的存储键 */
export const SESSION_KEY = "auth-session";

export function readSession(): Session | null {
	try {
		const raw = window.localStorage.getItem(SESSION_KEY);
		return raw ? (JSON.parse(raw) as Session) : null;
	} catch {
		return null;
	}
}
export function writeSession(s: Session | null) {
	try {
		if (s) window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
		else window.localStorage.removeItem(SESSION_KEY);
	} catch {}
}
export function logout() {
	writeSession(null);
	window.location.hash = "#/";
	window.location.reload();
}
/** 这个功能当前账号能不能用。没启用账号系统时一律放行。 */
export function can(perm: PermKey): boolean {
	if (!AUTH_ENABLED) return true;
	const s = readSession();
	if (!s) return false;
	if (s.user.role === "admin") return true;
	return !!s.user.perms?.[perm];
}
export const isAdmin = () => !AUTH_ENABLED || readSession()?.user.role === "admin";
