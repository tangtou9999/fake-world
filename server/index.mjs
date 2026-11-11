// 账号服务（第一期）：登录、总后台开子账号/权限/停用/重置密码，并可顺带托管前端打包文件。
// 零依赖：只用 Node 22+ 自带的 node:sqlite / node:crypto / node:http。
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const DB_PATH = process.env.DB_PATH || "./data/accounts.db";
const STATIC_DIR = process.env.STATIC_DIR ? resolve(process.env.STATIC_DIR) : "";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
const TOKEN_DAYS = Number(process.env.TOKEN_DAYS || 30);
const SECRET = process.env.AUTH_SECRET || "";
const ADMIN_PHONE = (process.env.ADMIN_PHONE || "").trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

if (SECRET.length < 24) {
	console.error("缺少 AUTH_SECRET（至少 24 个字符的随机字符串）。例如：openssl rand -hex 32");
	process.exit(1);
}

export const PERM_KEYS = ["editMode", "editBalance", "editChat", "chatAi", "momentsAi", "addFriend"];
const ROLES = ["admin", "real", "story"];

mkdirSync(dirname(resolve(DB_PATH)), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  perms TEXT NOT NULL DEFAULT '{}',
  disabled INTEGER NOT NULL DEFAULT 0,
  token_ver INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS friends (
  a INTEGER NOT NULL,
  b INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (a, b)
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender INTEGER NOT NULL,
  receiver INTEGER NOT NULL,
  text TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_pair ON messages (sender, receiver, id);
CREATE TABLE IF NOT EXISTS reads (
  user_id INTEGER NOT NULL,
  peer INTEGER NOT NULL,
  last_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, peer)
);
CREATE TABLE IF NOT EXISTS memos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
-- 真实聊天记录只能新增：数据库层面直接禁止修改和删除，接口里也没有这类功能（管理员也一样）
CREATE TRIGGER IF NOT EXISTS messages_no_update BEFORE UPDATE ON messages BEGIN SELECT RAISE(ABORT, '聊天记录不可修改'); END;
CREATE TRIGGER IF NOT EXISTS messages_no_delete BEFORE DELETE ON messages BEGIN SELECT RAISE(ABORT, '聊天记录不可删除'); END;
`);

/* ───────── 密码 / token ───────── */
async function hashPassword(pw) {
	const salt = randomBytes(16);
	const key = await scryptAsync(pw, salt, 64);
	return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}
async function verifyPassword(pw, stored) {
	const [alg, saltHex, hashHex] = String(stored).split("$");
	if (alg !== "scrypt") return false;
	const key = await scryptAsync(pw, Buffer.from(saltHex, "hex"), 64);
	const want = Buffer.from(hashHex, "hex");
	return key.length === want.length && timingSafeEqual(key, want);
}
const b64 = (buf) => Buffer.from(buf).toString("base64url");
function signToken(user) {
	const body = b64(JSON.stringify({ uid: user.id, tv: user.token_ver, exp: Date.now() + TOKEN_DAYS * 86400_000 }));
	const sig = createHmac("sha256", SECRET).update(body).digest("base64url");
	return `${body}.${sig}`;
}
function readToken(token) {
	const [body, sig] = String(token || "").split(".");
	if (!body || !sig) return null;
	const want = createHmac("sha256", SECRET).update(body).digest("base64url");
	if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
	try {
		const p = JSON.parse(Buffer.from(body, "base64url").toString());
		return p.exp > Date.now() ? p : null;
	} catch {
		return null;
	}
}

/* ───────── 数据 ───────── */
const cleanPerms = (p) => {
	const out = {};
	for (const k of PERM_KEYS) out[k] = !!(p && p[k]);
	return out;
};
const publicUser = (u) => ({
	id: u.id,
	phone: u.phone,
	name: u.name,
	role: u.role,
	perms: u.role === "admin" ? cleanPerms(Object.fromEntries(PERM_KEYS.map((k) => [k, true]))) : cleanPerms(JSON.parse(u.perms || "{}")),
	disabled: !!u.disabled,
	createdAt: u.created_at,
});
const byId = (id) => db.prepare("SELECT * FROM users WHERE id = ?").get(id);
const byPhone = (phone) => db.prepare("SELECT * FROM users WHERE phone = ?").get(phone);
const validPhone = (s) => /^\+?\d{6,20}$/.test(String(s || ""));
const validPassword = (s) => typeof s === "string" && s.length >= 6 && s.length <= 100;

const nameOf = (u) => u.name || u.phone;
function makeFriends(x, y) {
	if (x === y) return;
	const [a, b] = x < y ? [x, y] : [y, x];
	db.prepare("INSERT OR IGNORE INTO friends (a, b, created_at) VALUES (?,?,?)").run(a, b, Date.now());
}
const areFriends = (x, y) => !!db.prepare("SELECT 1 FROM friends WHERE a = ? AND b = ?").get(Math.min(x, y), Math.max(x, y));
/** 所有子账号和总账号互为好友 */
function linkRealWithAdmins() {
	const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
	for (const r of db.prepare("SELECT id FROM users WHERE role != 'admin'").all()) for (const a of admins) makeFriends(r.id, a.id);
}

async function bootstrapAdmin() {
	const has = db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get();
	if (has) return linkRealWithAdmins();
	if (!validPhone(ADMIN_PHONE) || !validPassword(ADMIN_PASSWORD)) {
		console.error("还没有总账号：请设置环境变量 ADMIN_PHONE（手机号）和 ADMIN_PASSWORD（至少 6 位）后重启。");
		process.exit(1);
	}
	db.prepare("INSERT INTO users (phone, name, role, pass_hash, perms, created_at) VALUES (?,?,?,?,?,?)").run(ADMIN_PHONE, "总账号", "admin", await hashPassword(ADMIN_PASSWORD), "{}", Date.now());
	console.log(`已创建总账号 ${ADMIN_PHONE}`);
	linkRealWithAdmins();
}

/* ───────── 登录限频 ───────── */
const fails = new Map();
const tooMany = (key) => {
	const r = fails.get(key);
	return !!r && r.until > Date.now() && r.n >= 8;
};
const markFail = (key) => {
	const r = fails.get(key);
	if (!r || r.until < Date.now()) fails.set(key, { n: 1, until: Date.now() + 10 * 60_000 });
	else r.n++;
};

/* ───────── HTTP 小工具 ───────── */
function cors(req, res) {
	const origin = req.headers.origin;
	if (origin && (ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin))) {
		res.setHeader("Access-Control-Allow-Origin", origin);
		res.setHeader("Vary", "Origin");
		res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
		res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
	}
}
const send = (res, status, data) => {
	res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
	res.end(JSON.stringify(data));
};
const readBody = (req) =>
	new Promise((resolveBody, reject) => {
		let s = "";
		req.on("data", (c) => {
			s += c;
			if (s.length > 100_000) {
				reject(new Error("too large"));
				req.destroy();
			}
		});
		req.on("end", () => {
			try {
				resolveBody(s ? JSON.parse(s) : {});
			} catch {
				reject(new Error("bad json"));
			}
		});
	});
const clientIp = (req) => (process.env.TRUST_PROXY === "1" ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() : "") || req.socket.remoteAddress || "";

function authUser(req) {
	const h = req.headers.authorization || "";
	const p = readToken(h.startsWith("Bearer ") ? h.slice(7) : "");
	if (!p) return null;
	const u = byId(p.uid);
	if (!u || u.disabled || u.token_ver !== p.tv) return null;
	return u;
}

/* ───────── 接口 ───────── */
async function api(req, res, path) {
	const method = req.method;
	if (path === "/api/health") return send(res, 200, { ok: true });

	if (path === "/api/login" && method === "POST") {
		const { phone, password } = await readBody(req);
		const key = `${clientIp(req)}|${phone}`;
		if (tooMany(key)) return send(res, 429, { error: "尝试次数太多，请 10 分钟后再试" });
		const u = typeof phone === "string" ? byPhone(phone.trim()) : undefined;
		const ok = u ? await verifyPassword(String(password || ""), u.pass_hash) : (await hashPassword("x"), false);
		if (!u || !ok) {
			markFail(key);
			return send(res, 401, { error: "手机号或密码不对" });
		}
		if (u.disabled) return send(res, 403, { error: "该账号已被停用，请联系管理员" });
		fails.delete(key);
		return send(res, 200, { token: signToken(u), user: publicUser(u) });
	}

	const me = authUser(req);
	if (!me) return send(res, 401, { error: "登录已失效，请重新登录" });

	if (path === "/api/me" && method === "GET") return send(res, 200, { user: publicUser(me) });

	if (path === "/api/change-password" && method === "POST") {
		const { oldPassword, newPassword } = await readBody(req);
		if (!(await verifyPassword(String(oldPassword || ""), me.pass_hash))) return send(res, 400, { error: "原密码不对" });
		if (!validPassword(newPassword)) return send(res, 400, { error: "新密码至少 6 位" });
		db.prepare("UPDATE users SET pass_hash = ?, token_ver = token_ver + 1 WHERE id = ?").run(await hashPassword(newPassword), me.id);
		return send(res, 200, { token: signToken(byId(me.id)) });
	}

	if (path.startsWith("/api/real/")) {
		const url = new URL(req.url || "/", "http://x");

		if (path === "/api/real/friends" && method === "GET") {
			const rows = db.prepare("SELECT CASE WHEN a = ? THEN b ELSE a END AS pid FROM friends WHERE a = ? OR b = ?").all(me.id, me.id, me.id);
			const list = rows.map(({ pid }) => {
				const u = byId(pid);
				if (!u || u.disabled) return null;
				const last = db.prepare("SELECT id, sender, text, ts FROM messages WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?) ORDER BY id DESC LIMIT 1").get(me.id, pid, pid, me.id);
				const rd = db.prepare("SELECT last_id FROM reads WHERE user_id = ? AND peer = ?").get(me.id, pid);
				const unread = db.prepare("SELECT COUNT(*) AS n FROM messages WHERE sender = ? AND receiver = ? AND id > ?").get(pid, me.id, rd?.last_id ?? 0).n;
				return { id: pid, name: nameOf(u), phone: u.phone, role: u.role, last: last ? { id: last.id, from: last.sender, text: last.text, ts: last.ts } : null, unread };
			});
			return send(res, 200, { friends: list.filter(Boolean).sort((x, y) => (y.last?.ts ?? 0) - (x.last?.ts ?? 0)) });
		}
		if (path === "/api/real/messages" && method === "GET") {
			const peer = Number(url.searchParams.get("peer"));
			if (!areFriends(me.id, peer)) return send(res, 403, { error: "对方不是你的好友" });
			const after = Number(url.searchParams.get("after") || 0);
			const rows = db.prepare("SELECT id, sender, receiver, text, ts FROM messages WHERE id > ? AND ((sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)) ORDER BY id LIMIT 500").all(after, me.id, peer, peer, me.id);
			return send(res, 200, { messages: rows });
		}
		if (path === "/api/real/messages" && method === "POST") {
			const { to, text } = await readBody(req);
			const peer = Number(to);
			const t = typeof text === "string" ? text.trim() : "";
			if (!t || t.length > 2000) return send(res, 400, { error: "消息不能为空，最长 2000 字" });
			const target = byId(peer);
			if (!target || target.disabled || !areFriends(me.id, peer)) return send(res, 403, { error: "对方不是你的好友或已停用" });
			const ts = Date.now();
			const info = db.prepare("INSERT INTO messages (sender, receiver, text, ts) VALUES (?,?,?,?)").run(me.id, peer, t, ts);
			const message = { id: Number(info.lastInsertRowid), sender: me.id, receiver: peer, text: t, ts };
			push(peer, { type: "msg", message });
			push(me.id, { type: "msg", message });
			return send(res, 200, { message });
		}
		if (path === "/api/real/read" && method === "POST") {
			const { peer, upTo } = await readBody(req);
			db.prepare("INSERT INTO reads (user_id, peer, last_id) VALUES (?,?,?) ON CONFLICT(user_id, peer) DO UPDATE SET last_id = MAX(last_id, excluded.last_id)").run(me.id, Number(peer), Number(upTo) || 0);
			return send(res, 200, { ok: true });
		}
		if (path === "/api/real/memos" && method === "GET") return send(res, 200, { memos: db.prepare("SELECT id, text, updated_at AS updatedAt FROM memos WHERE user_id = ? ORDER BY updated_at DESC").all(me.id) });
		if (path === "/api/real/memos" && method === "POST") {
			const { text } = await readBody(req);
			if (typeof text !== "string" || text.length > 20000) return send(res, 400, { error: "备忘录太长" });
			const info = db.prepare("INSERT INTO memos (user_id, text, updated_at) VALUES (?,?,?)").run(me.id, text, Date.now());
			return send(res, 200, { id: Number(info.lastInsertRowid) });
		}
		const mm = path.match(/^\/api\/real\/memos\/(\d+)$/);
		if (mm) {
			const row = db.prepare("SELECT id FROM memos WHERE id = ? AND user_id = ?").get(Number(mm[1]), me.id);
			if (!row) return send(res, 404, { error: "备忘录不存在" });
			if (method === "PUT") {
				const { text } = await readBody(req);
				if (typeof text !== "string" || text.length > 20000) return send(res, 400, { error: "备忘录太长" });
				db.prepare("UPDATE memos SET text = ?, updated_at = ? WHERE id = ?").run(text, Date.now(), row.id);
				return send(res, 200, { ok: true });
			}
			if (method === "DELETE") {
				db.prepare("DELETE FROM memos WHERE id = ?").run(row.id);
				return send(res, 200, { ok: true });
			}
		}
		return send(res, 404, { error: "没有这个接口" });
	}

	if (path.startsWith("/api/admin/")) {
		if (me.role !== "admin") return send(res, 403, { error: "只有总账号可以操作" });

		if (path === "/api/admin/users" && method === "GET") {
			const rows = db.prepare("SELECT * FROM users ORDER BY id").all();
			return send(res, 200, { users: rows.map(publicUser) });
		}
		if (path === "/api/admin/users" && method === "POST") {
			const b = await readBody(req);
			const phone = String(b.phone || "").trim();
			if (!validPhone(phone)) return send(res, 400, { error: "手机号格式不对（6~20 位数字）" });
			if (!validPassword(b.password)) return send(res, 400, { error: "密码至少 6 位" });
			if (b.role !== "real" && b.role !== "story") return send(res, 400, { error: "账号类型只能是 real 或 story" });
			if (byPhone(phone)) return send(res, 409, { error: "这个手机号已经开过账号了" });
			const info = db.prepare("INSERT INTO users (phone, name, role, pass_hash, perms, created_at) VALUES (?,?,?,?,?,?)").run(phone, String(b.name || "").slice(0, 30), b.role, await hashPassword(b.password), JSON.stringify(cleanPerms(b.perms)), Date.now());
			linkRealWithAdmins();
			return send(res, 200, { user: publicUser(byId(Number(info.lastInsertRowid))) });
		}
		const m = path.match(/^\/api\/admin\/users\/(\d+)(\/reset-password)?$/);
		if (m) {
			const u = byId(Number(m[1]));
			if (!u) return send(res, 404, { error: "账号不存在" });
			if (m[2] && method === "POST") {
				const { password } = await readBody(req);
				if (!validPassword(password)) return send(res, 400, { error: "密码至少 6 位" });
				db.prepare("UPDATE users SET pass_hash = ?, token_ver = token_ver + 1 WHERE id = ?").run(await hashPassword(password), u.id);
				closeSockets(u.id);
				return send(res, 200, { ok: true });
			}
			if (!m[2] && method === "PATCH") {
				const b = await readBody(req);
				if (u.role === "admin" && (b.disabled !== undefined || b.perms !== undefined)) return send(res, 400, { error: "总账号不能被停用或改权限" });
				if (b.name !== undefined) db.prepare("UPDATE users SET name = ? WHERE id = ?").run(String(b.name).slice(0, 30), u.id);
				if (b.perms !== undefined && u.role !== "admin") db.prepare("UPDATE users SET perms = ? WHERE id = ?").run(JSON.stringify(cleanPerms(b.perms)), u.id);
				if (b.disabled !== undefined) {
					db.prepare("UPDATE users SET disabled = ?, token_ver = token_ver + 1 WHERE id = ?").run(b.disabled ? 1 : 0, u.id);
					closeSockets(u.id);
				}
				return send(res, 200, { user: publicUser(byId(u.id)) });
			}
		}
	}
	return send(res, 404, { error: "没有这个接口" });
}

/* ───────── 托管前端打包文件（可选） ───────── */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json" };
function serveStatic(req, res, urlPath) {
	let rel = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, "");
	if (rel.includes("..")) return send(res, 400, { error: "bad path" });
	let file = join(STATIC_DIR, rel || "index.html");
	if (!existsSync(file) || statSync(file).isDirectory()) file = join(STATIC_DIR, "index.html");
	const ext = extname(file).toLowerCase();
	const isIndex = file.endsWith("index.html");
	res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": isIndex ? "no-cache, no-store, must-revalidate" : "public, max-age=31536000, immutable" });
	res.end(readFileSync(file));
}

/* ───────── WebSocket（手写，零依赖）：只用来把新消息实时推给在线的人 ───────── */
const sockets = new Map(); // uid -> Set<socket>
function frame(opcode, payload) {
	const len = payload.length;
	const head = len < 126 ? Buffer.from([0x80 | opcode, len]) : len < 65536 ? Buffer.from([0x80 | opcode, 126, len >> 8, len & 255]) : null;
	if (!head) return null;
	return Buffer.concat([head, payload]);
}
function push(uid, obj) {
	const f = frame(0x1, Buffer.from(JSON.stringify(obj)));
	if (!f) return;
	for (const s of sockets.get(uid) ?? []) s.write(f);
}
function closeSockets(uid) {
	for (const s of sockets.get(uid) ?? []) s.end(frame(0x8, Buffer.alloc(0)) ?? undefined);
	sockets.delete(uid);
}
function onUpgrade(req, socket) {
	const url = new URL(req.url || "/", "http://x");
	const key = req.headers["sec-websocket-key"];
	const p = url.pathname === "/ws" ? readToken(url.searchParams.get("token")) : null;
	const u = p ? byId(p.uid) : null;
	if (!key || !u || u.disabled || u.token_ver !== p.tv) {
		socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
		return socket.destroy();
	}
	const accept = createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
	socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
	if (!sockets.has(u.id)) sockets.set(u.id, new Set());
	sockets.get(u.id).add(socket);
	let buf = Buffer.alloc(0);
	const drop = () => {
		sockets.get(u.id)?.delete(socket);
		clearInterval(timer);
	};
	const timer = setInterval(() => {
		const f = frame(0x9, Buffer.alloc(0));
		if (f && !socket.destroyed) socket.write(f);
	}, 30_000);
	socket.on("data", (chunk) => {
		buf = Buffer.concat([buf, chunk]);
		while (buf.length >= 2) {
			const op = buf[0] & 0x0f;
			const masked = (buf[1] & 0x80) !== 0;
			let len = buf[1] & 0x7f;
			let off = 2;
			if (len === 126) {
				if (buf.length < 4) return;
				len = buf.readUInt16BE(2);
				off = 4;
			} else if (len === 127) {
				if (buf.length < 10) return;
				len = Number(buf.readBigUInt64BE(2));
				off = 10;
			}
			if (len > 100_000) return socket.destroy();
			if (buf.length < off + (masked ? 4 : 0) + len) return;
			const mask = masked ? buf.subarray(off, off + 4) : null;
			const data = Buffer.from(buf.subarray(off + (masked ? 4 : 0), off + (masked ? 4 : 0) + len));
			if (mask) for (let i = 0; i < data.length; i++) data[i] ^= mask[i % 4];
			buf = buf.subarray(off + (masked ? 4 : 0) + len);
			if (op === 0x8) {
				socket.end(frame(0x8, Buffer.alloc(0)) ?? undefined);
				return drop();
			}
			if (op === 0x9) socket.write(frame(0xa, data) ?? Buffer.alloc(0));
		}
	});
	socket.on("close", drop);
	socket.on("error", drop);
}

await bootstrapAdmin();

const server = createServer(async (req, res) => {
	cors(req, res);
	if (req.method === "OPTIONS") {
		res.writeHead(204);
		return res.end();
	}
	const url = new URL(req.url || "/", "http://x");
	try {
		if (url.pathname.startsWith("/api/")) return await api(req, res, url.pathname);
		if (STATIC_DIR && (req.method === "GET" || req.method === "HEAD")) return serveStatic(req, res, url.pathname);
		return send(res, 404, { error: "not found" });
	} catch (e) {
		if (!res.headersSent) send(res, 400, { error: e instanceof Error && e.message === "bad json" ? "请求格式不对" : "请求失败" });
	}
});
server.on("upgrade", onUpgrade);
server.listen(PORT, HOST, () => console.log(`账号服务已启动 http://${HOST}:${PORT}${STATIC_DIR ? `（托管 ${STATIC_DIR}）` : ""}`));
