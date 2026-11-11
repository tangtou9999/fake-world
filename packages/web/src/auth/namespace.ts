// 必须在所有页面代码之前加载（main.tsx 第一个 import）。
// 子账号（剧情/真实）的本机数据全部加上账号前缀，和总账号、和别的子账号互相看不到、不会覆盖。
// 总账号用原来的存储（不加前缀），所以以前的数据都还在。
import { AUTH_ENABLED } from "./config";
import { SESSION_KEY } from "./session";

function currentPrefix() {
	if (!AUTH_ENABLED) return "";
	try {
		const raw = window.localStorage.getItem(SESSION_KEY);
		const u = raw ? (JSON.parse(raw) as { user?: { id: number; role: string } }).user : undefined;
		return u && u.role !== "admin" ? `u${u.id}:` : "";
	} catch {
		return "";
	}
}

export const NS_PREFIX = currentPrefix();
/** IndexedDB 库名后缀 */
export const DB_SUFFIX = NS_PREFIX ? `-${NS_PREFIX.slice(0, -1)}` : "";

if (NS_PREFIX) {
	const proto = Storage.prototype;
	const rawGet = proto.getItem;
	const rawSet = proto.setItem;
	const rawRemove = proto.removeItem;
	const rawKey = proto.key;
	const lengthDesc = Object.getOwnPropertyDescriptor(proto, "length");
	const isLocal = (s: Storage) => s === window.localStorage;
	const k = (key: string) => (key === SESSION_KEY ? key : NS_PREFIX + key);
	proto.getItem = function (key: string) {
		return rawGet.call(this, isLocal(this) ? k(key) : key);
	};
	proto.setItem = function (key: string, value: string) {
		return rawSet.call(this, isLocal(this) ? k(key) : key, value);
	};
	proto.removeItem = function (key: string) {
		return rawRemove.call(this, isLocal(this) ? k(key) : key);
	};
	const mine = (s: Storage) => {
		const out: string[] = [];
		const n = lengthDesc?.get ? (lengthDesc.get.call(s) as number) : 0;
		for (let i = 0; i < n; i++) {
			const key = rawKey.call(s, i);
			if (key?.startsWith(NS_PREFIX)) out.push(key.slice(NS_PREFIX.length));
		}
		return out;
	};
	proto.key = function (i: number) {
		return isLocal(this) ? (mine(this)[i] ?? null) : rawKey.call(this, i);
	};
	Object.defineProperty(proto, "length", {
		configurable: true,
		get() {
			return isLocal(this as Storage) ? mine(this as Storage).length : (lengthDesc?.get?.call(this) as number);
		},
	});
}
