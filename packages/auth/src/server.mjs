// 账号与权限服务。零第三方依赖：node:http + node:sqlite + node:crypto。
// 环境变量见 README.md。
import { createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export const PERM_KEYS = ["editMode", "editBalance", "editChat", "chatAi", "momentsAi", "addFriend"];
const TOKEN_TTL_MS = 30 * 24 * 3600 * 1000;

export function createApp(env = process.env) {
	const SECRET = env.TOKEN_SECRET;
	if (!SECRET || SECRET.length < 24) throw new Error("请设置 TOKEN_SECRET（至少 24 位随机字符串）");
	const DB_PATH = env.DB_PATH || "./data/auth.db";
	const ORIGINS = (env.CORS_ORIGIN || "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	const TRUST_PROXY = env.TRUST_PROXY === "1";

	if (DB_PATH !== ":memory:") mkdirSync(dirname(DB_PATH), { recursive: true });
	const db = new DatabaseSync(DB_PATH);
	db.exec(`
		PRAGMA journal_mode = WAL;
		CREATE TABLE IF NOT EXISTS accounts (
			id TEXT PRIMARY KEY,
			phone TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL DEFAULT '',
			role TEXT NOT NULL,
			pass_hash TEXT NOT NULL,
			disabled INTEGER NOT NULL DEFAULT 0,
			perms TEXT NOT NULL DEFAULT '{}',
			token_ver INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL,
			last_login INTEGER
		);
	`);

	/* ───── 工具 ───── */
	const hashPassword = async (pw) => {
		const salt = randomBytes(16);
		const key = await scryptAsync(pw, salt, 64);
		return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
	};
	const verifyPassword = async (pw, stored) => {
		const [alg, saltHex, keyHex] = String(stored).split("$");
		if (alg !== "scrypt") return false;
		const key = await scryptAsync(pw, Buffer.from(saltHex, "hex"), 64);
		const want = Buffer.from(keyHex, "hex");
		return key.length === want.length && timingSafeEqual(key, want);
	};
	const b64 = (buf) => Buffer.from(buf).toString("base64url");
	const sign = (body) => b64(createHmac("sha256", SECRET).update(body).digest());
	const issueToken = (acc) => {
		const body = b64(JSON.stringify({ id: acc.id, ver: acc.token_ver, exp: Date.now() + TOKEN_TTL_MS }));
		return `${body}.${sign(body)}`;
	};
	const readToken = (token) => {
		const [body, sig] = String(token || "").split(".");
		if (!body || !sig) return null;
		const want = sign(body);
		if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
		try {
			const p = JSON.parse(Buffer.from(body, "base64url").toString());
			return p.exp > Date.now() ? p : null;
		} catch {
			return null;
		}
	};
	const normPhone = (p) => String(p ?? "").replace(/[\s-]/g, "");
	const validPhone = (p) => /^\+?\d{6,15}$/.test(p);
	const cleanPerms = (raw) => {
		const out = {};
		for (const k of PERM_KEYS) out[k] = !!(raw && raw[k]);
		return out;
	};
	const publicAcc = (a) => ({
		id: a.id,
		phone: a.phone,
		name: a.name,
		role: a.role,
		disabled: !!a.disabled,
		// 总后台默认拥有全部权限
		perms: a.role === "admin" ? Object.fromEntries(PERM_KEYS.map((k) => [k, true])) : cleanPerms(JSON.parse(a.perms || "{}")),
		createdAt: a.created_at,
		lastLogin: a.last_login ?? null,
	});
	const getById = (id) => db.prepare("SELECT * FROM accounts WHERE id = ?").get(id);
	const getByPhone = (phone) => db.prepare("SELECT * FROM accounts WHERE phone = ?").get(phone);

	/* ───── 首个总后台 ───── */
	const ensureAdmin = async () => {
		const phone = normPhone(env.ADMIN_PHONE);
		if (!phone || !env.ADMIN_PASSWORD) return;
		if (!validPhone(phone)) throw new Error("ADMIN_PHONE 格式不对");
		if (db.prepare("SELECT 1 FROM accounts WHERE role = 'admin'").get()) return;
		db.prepare("INSERT INTO accounts (id, phone, name, role, pass_hash, perms, created_at) VALUES (?, ?, ?, 'admin', ?, '{}', ?)").run(
			randomUUID(),
			phone,
			"总后台",
			await hashPassword(env.ADMIN_PASSWORD),
			Date.now(),
		);
		console.log(`已创建总后台账号 ${phone}（之后可以把环境变量里的 ADMIN_PASSWORD 删掉）`);
	};

	/* ───── 登录限频 ───── */
	const fails = new Map(); // key -> { n, until }
	const ipHits = new Map(); // ip -> number[]
	const locked = (key) => (fails.get(key)?.until ?? 0) > Date.now();
	const noteFail = (key) => {
		const f = fails.get(key) ?? { n: 0, until: 0 };
		f.n += 1;
		if (f.n >= 5) {
			f.until = Date.now() + 15 * 60 * 1000;
			f.n = 0;
		}
		fails.set(key, f);
	};
	const ipLimited = (ip) => {
		const now = Date.now();
		const arr = (ipHits.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
		arr.push(now);
		ipHits.set(ip, arr);
		return arr.length > 40;
	};
	setInterval(() => {
		const now = Date.now();
		for (const [k, v] of fails) if (v.until < now && v.n === 0) fails.delete(k);
		for (const [k, v] of ipHits) if (!v.some((t) => now - t < 10 * 60 * 1000)) ipHits.delete(k);
	}, 10 * 60 * 1000).unref();

	/* ───── HTTP ───── */
	const send = (res, code, data, extra = {}) => {
		res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra });
		res.end(JSON.stringify(data));
	};
	const readBody = (req) =>
		new Promise((resolve, reject) => {
			let size = 0;
			const chunks = [];
			req.on("data", (c) => {
				size += c.length;
				if (size > 10_000) {
					reject(Object.assign(new Error("请求太大"), { status: 413 }));
					req.destroy();
				} else chunks.push(c);
			});
			req.on("end", () => {
				try {
					resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {});
				} catch {
					reject(Object.assign(new Error("请求格式不对"), { status: 400 }));
				}
			});
			req.on("error", reject);
		});
	const clientIp = (req) =>
		(TRUST_PROXY ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() : "") || req.socket.remoteAddress || "?";
	const authed = (req) => {
		const h = String(req.headers.authorization || "");
		const p = readToken(h.startsWith("Bearer ") ? h.slice(7) : "");
		if (!p) return null;
		const acc = getById(p.id);
		if (!acc || acc.disabled || acc.token_ver !== p.ver) return null;
		return acc;
	};

	const handler = async (req, res) => {
		const origin = req.headers.origin;
		const cors = {};
		if (origin && ORIGINS.includes(origin)) {
			cors["access-control-allow-origin"] = origin;
			cors.vary = "Origin";
			cors["access-control-allow-headers"] = "authorization, content-type";
			cors["access-control-allow-methods"] = "GET, POST, PATCH, OPTIONS";
		}
		if (req.method === "OPTIONS") {
			res.writeHead(204, cors);
			return res.end();
		}
		const S = (code, data) => send(res, code, data, cors);
		const url = new URL(req.url || "/", "http://x");
		const path = url.pathname.replace(/\/+$/, "") || "/";
		try {
			if (path === "/api/health") return S(200, { ok: true });

			if (path === "/api/login" && req.method === "POST") {
				const ip = clientIp(req);
				if (ipLimited(ip)) return S(429, { error: "尝试太频繁，请稍后再试" });
				const b = await readBody(req);
				const phone = normPhone(b.phone);
				const key = `${ip}|${phone}`;
				if (locked(key)) return S(429, { error: "密码错误次数太多，请 15 分钟后再试" });
				const acc = validPhone(phone) ? getByPhone(phone) : null;
				// 账号不存在时也做一次哈希，避免通过耗时判断账号是否存在
				const ok = acc ? await verifyPassword(String(b.password ?? ""), acc.pass_hash) : (await verifyPassword("x", "scrypt$00$00"), false);
				if (!acc || !ok) {
					noteFail(key);
					return S(401, { error: "手机号或密码不对" });
				}
				if (acc.disabled) return S(403, { error: "该账号已被停用，请联系管理员" });
				fails.delete(key);
				db.prepare("UPDATE accounts SET last_login = ? WHERE id = ?").run(Date.now(), acc.id);
				return S(200, { token: issueToken(acc), me: publicAcc(acc) });
			}

			const me = authed(req);
			if (!me) return S(401, { error: "未登录或登录已失效" });

			if (path === "/api/me" && req.method === "GET") return S(200, { me: publicAcc(me) });

			if (path === "/api/me/password" && req.method === "POST") {
				const b = await readBody(req);
				if (!(await verifyPassword(String(b.oldPassword ?? ""), me.pass_hash))) return S(400, { error: "原密码不对" });
				const np = String(b.newPassword ?? "");
				if (np.length < 6 || np.length > 64) return S(400, { error: "新密码需要 6~64 位" });
				db.prepare("UPDATE accounts SET pass_hash = ?, token_ver = token_ver + 1 WHERE id = ?").run(await hashPassword(np), me.id);
				return S(200, { token: issueToken(getById(me.id)) });
			}

			if (path.startsWith("/api/admin/")) {
				if (me.role !== "admin") return S(403, { error: "没有权限" });

				if (path === "/api/admin/accounts" && req.method === "GET") {
					const rows = db.prepare("SELECT * FROM accounts ORDER BY created_at DESC").all();
					return S(200, { accounts: rows.map(publicAcc), permKeys: PERM_KEYS });
				}
				if (path === "/api/admin/accounts" && req.method === "POST") {
					const b = await readBody(req);
					const phone = normPhone(b.phone);
					const role = b.role === "real" ? "real" : "story"; // 只能开子账号，不能再开总后台
					const pw = String(b.password ?? "");
					if (!validPhone(phone)) return S(400, { error: "手机号格式不对" });
					if (pw.length < 6 || pw.length > 64) return S(400, { error: "密码需要 6~64 位" });
					if (getByPhone(phone)) return S(409, { error: "这个手机号已经开通过了" });
					const id = randomUUID();
					db.prepare("INSERT INTO accounts (id, phone, name, role, pass_hash, perms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
						id,
						phone,
						String(b.name ?? "").slice(0, 30),
						role,
						await hashPassword(pw),
						JSON.stringify(cleanPerms(b.perms)),
						Date.now(),
					);
					return S(201, { account: publicAcc(getById(id)) });
				}
				const m = path.match(/^\/api\/admin\/accounts\/([\w-]+)(\/reset-password)?$/);
				if (m) {
					const target = getById(m[1]);
					if (!target) return S(404, { error: "账号不存在" });
					if (m[2] && req.method === "POST") {
						const b = await readBody(req);
						const pw = String(b.password ?? "");
						if (pw.length < 6 || pw.length > 64) return S(400, { error: "密码需要 6~64 位" });
						db.prepare("UPDATE accounts SET pass_hash = ?, token_ver = token_ver + 1 WHERE id = ?").run(await hashPassword(pw), target.id);
						return S(200, { ok: true });
					}
					if (!m[2] && req.method === "PATCH") {
						const b = await readBody(req);
						if (target.role === "admin" && (b.disabled !== undefined || b.perms !== undefined)) {
							return S(400, { error: "总后台账号不能被停用或改权限" });
						}
						if (b.name !== undefined) db.prepare("UPDATE accounts SET name = ? WHERE id = ?").run(String(b.name).slice(0, 30), target.id);
						if (b.perms !== undefined) db.prepare("UPDATE accounts SET perms = ? WHERE id = ?").run(JSON.stringify(cleanPerms(b.perms)), target.id);
						if (b.disabled !== undefined) {
							// 停用立刻生效：token_ver +1，旧 token 全部作废
							db.prepare("UPDATE accounts SET disabled = ?, token_ver = token_ver + 1 WHERE id = ?").run(b.disabled ? 1 : 0, target.id);
						}
						return S(200, { account: publicAcc(getById(target.id)) });
					}
				}
			}
			return S(404, { error: "没有这个接口" });
		} catch (e) {
			const status = e?.status || 500;
			if (status === 500) console.error(e);
			return S(status, { error: status === 500 ? "服务器出错了" : e.message });
		}
	};

	return { server: createServer(handler), db, ensureAdmin };
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const { server, ensureAdmin } = createApp();
	await ensureAdmin();
	const port = Number(process.env.PORT || 8787);
	server.listen(port, process.env.HOST || "127.0.0.1", () => console.log(`auth 服务已启动：端口 ${port}`));
}
