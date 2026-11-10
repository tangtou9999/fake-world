import { mainStore } from "@/stateV2/store";
import { modeAtom } from "@/stateV2/mode";
import { atom, useAtomValue } from "jotai";

/** 构建时 VITE_AUTH=1 才开启登录；没开的话网站和以前完全一样。 */
export const AUTH_ENABLED = import.meta.env.VITE_AUTH === "1";
/** 后端地址。和网页同域部署（nginx 把 /api 转给后端）时留空即可。 */
const API_BASE = String(import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

export const PERMS = [
	{ key: "editMode", label: "编辑模式", hint: "连点 3 下进入编辑模式、电脑端的编辑面板" },
	{ key: "editBalance", label: "修改余额和账单", hint: "钱包、零钱明细、账单详情" },
	{ key: "editChat", label: "修改聊天和好友资料", hint: "改聊天记录、好友资料、好友总数" },
	{ key: "chatAi", label: "聊天 AI", hint: "私人 AI、聊天窗口里的 AI、AI 密钥页" },
	{ key: "momentsAi", label: "朋友圈 AI / 发朋友圈", hint: "朋友圈右上角相机" },
	{ key: "addFriend", label: "添加好友", hint: "添加朋友、新的朋友" },
] as const;
export type Perm = (typeof PERMS)[number]["key"];

export type Me = { id: string; phone: string; name: string; role: "admin" | "story" | "real"; disabled: boolean; perms: Record<Perm, boolean>; createdAt: number; lastLogin: number | null };
type AuthState = { status: "loading" | "out" | "in"; me?: Me };

const TOKEN_KEY = "auth-token";
const ME_KEY = "auth-me";
const read = (k: string) => {
	try {
		return localStorage.getItem(k);
	} catch {
		return null;
	}
};
const write = (k: string, v: string | null) => {
	try {
		if (v === null) localStorage.removeItem(k);
		else localStorage.setItem(k, v);
	} catch {
		/* 隐私模式等情况下存不了，当次仍可用 */
	}
};

export const authAtom = atom<AuthState>({ status: AUTH_ENABLED ? "loading" : "in" });

export const getToken = () => read(TOKEN_KEY);
export const can = (perm: Perm) => {
	if (!AUTH_ENABLED) return true;
	const s = mainStore.get(authAtom);
	return s.status === "in" && !!s.me?.perms[perm];
};
export const useCan = (perm: Perm) => {
	const s = useAtomValue(authAtom);
	return !AUTH_ENABLED || (s.status === "in" && !!s.me?.perms[perm]);
};

export class ApiError extends Error {
	constructor(
		message: string,
		public status: number,
	) {
		super(message);
	}
}

export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown; auth?: boolean }): Promise<T> {
	const token = getToken();
	let res: Response;
	try {
		res = await fetch(`${API_BASE}${path}`, {
			method: init?.method ?? "GET",
			headers: { "content-type": "application/json", ...(token && init?.auth !== false ? { authorization: `Bearer ${token}` } : {}) },
			body: init?.body === undefined ? undefined : JSON.stringify(init.body),
		});
	} catch {
		throw new ApiError("连不上服务器，请检查网络", 0);
	}
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new ApiError((data as { error?: string }).error ?? "请求失败", res.status);
	return data as T;
}

const setIn = (me: Me) => {
	write(ME_KEY, JSON.stringify(me));
	mainStore.set(authAtom, { status: "in", me });
};
const setOut = () => {
	write(TOKEN_KEY, null);
	write(ME_KEY, null);
	mainStore.set(authAtom, { status: "out" });
};

export async function login(phone: string, password: string) {
	const r = await api<{ token: string; me: Me }>("/api/login", { method: "POST", body: { phone, password }, auth: false });
	write(TOKEN_KEY, r.token);
	setIn(r.me);
}

export function logout() {
	setOut();
}

/** 向服务器确认当前登录状态。账号被停用 / token 失效会立刻退出；只是断网则先用上次保存的信息。 */
export async function refreshMe() {
	if (!AUTH_ENABLED) return;
	if (!getToken()) return setOut();
	try {
		const r = await api<{ me: Me }>("/api/me");
		setIn(r.me);
	} catch (e) {
		if (e instanceof ApiError && e.status !== 0) return setOut();
		const cached = read(ME_KEY);
		if (cached) {
			try {
				return mainStore.set(authAtom, { status: "in", me: JSON.parse(cached) as Me });
			} catch {
				/* 缓存坏了就当没登录 */
			}
		}
		setOut();
	}
}

export async function changePassword(oldPassword: string, newPassword: string) {
	const r = await api<{ token: string }>("/api/me/password", { method: "POST", body: { oldPassword, newPassword } });
	write(TOKEN_KEY, r.token);
}

/** 没有「编辑模式」权限时，强制退出编辑模式；回到前台时重新校验一次账号状态。 */
export function initAuth() {
	if (!AUTH_ENABLED) return;
	const guard = () => {
		if (mainStore.get(modeAtom) === "edit" && !can("editMode")) mainStore.set(modeAtom, "preview");
	};
	mainStore.sub(modeAtom, guard);
	mainStore.sub(authAtom, guard);
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") void refreshMe();
	});
	void refreshMe();
}
