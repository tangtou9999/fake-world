import { API_BASE } from "./config";
import { type AuthUser, readSession } from "./session";

export class ApiError extends Error {
	constructor(
		message: string,
		public status: number,
	) {
		super(message);
	}
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
	const token = init.token ?? readSession()?.token;
	let res: Response;
	try {
		res = await fetch(`${API_BASE}${path}`, {
			method: init.method ?? (init.body ? "POST" : "GET"),
			headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
			body: init.body ? JSON.stringify(init.body) : undefined,
		});
	} catch {
		throw new ApiError("连不上服务器，请检查网络", 0);
	}
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new ApiError((data as { error?: string }).error ?? "请求失败", res.status);
	return data as T;
}

export const loginApi = (phone: string, password: string) => api<{ token: string; user: AuthUser }>("/api/login", { body: { phone, password } });
export const meApi = (token?: string) => api<{ user: AuthUser }>("/api/me", { token });
