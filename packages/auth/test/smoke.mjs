import assert from "node:assert/strict";
import { createApp } from "../src/server.mjs";

const { server, ensureAdmin } = createApp({ TOKEN_SECRET: "x".repeat(32), DB_PATH: ":memory:", ADMIN_PHONE: "0900000001", ADMIN_PASSWORD: "adminpass1", CORS_ORIGIN: "https://ok.example" });
await ensureAdmin();
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const call = async (path, { method = "GET", body, token } = {}) => {
	const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
	return { status: r.status, json: await r.json().catch(() => ({})) };
};

let r = await call("/api/me");
assert.equal(r.status, 401, "未登录应 401");
r = await call("/api/login", { method: "POST", body: { phone: "0900000001", password: "wrong" } });
assert.equal(r.status, 401);
r = await call("/api/login", { method: "POST", body: { phone: "0900000001", password: "adminpass1" } });
assert.equal(r.status, 200);
const admin = r.json.token;
assert.equal(r.json.me.role, "admin");
assert.ok(r.json.me.perms.editBalance, "总后台全部权限");

r = await call("/api/admin/accounts", { method: "POST", token: admin, body: { phone: "0911111111", password: "pw123456", name: "安卓", role: "story", perms: { editMode: true, chatAi: true } } });
assert.equal(r.status, 201);
const sid = r.json.account.id;
assert.deepEqual([r.json.account.perms.editMode, r.json.account.perms.editBalance], [true, false]);
r = await call("/api/admin/accounts", { method: "POST", token: admin, body: { phone: "0911111111", password: "pw123456" } });
assert.equal(r.status, 409, "手机号不能重复");

r = await call("/api/login", { method: "POST", body: { phone: "0911111111", password: "pw123456" } });
assert.equal(r.status, 200);
const sub = r.json.token;
r = await call("/api/admin/accounts", { token: sub });
assert.equal(r.status, 403, "子账号不能进后台");
r = await call("/api/admin/accounts", { method: "POST", token: sub, body: { phone: "0922222222", password: "pw123456" } });
assert.equal(r.status, 403);

r = await call(`/api/admin/accounts/${sid}`, { method: "PATCH", token: admin, body: { perms: { editBalance: true } } });
assert.deepEqual([r.json.account.perms.editBalance, r.json.account.perms.editMode], [true, false]);
r = await call("/api/me", { token: sub });
assert.equal(r.json.me.perms.editBalance, true, "权限改动立即生效");

r = await call(`/api/admin/accounts/${sid}`, { method: "PATCH", token: admin, body: { disabled: true } });
assert.equal(r.json.account.disabled, true);
r = await call("/api/me", { token: sub });
assert.equal(r.status, 401, "停用后旧 token 立刻失效");
r = await call("/api/login", { method: "POST", body: { phone: "0911111111", password: "pw123456" } });
assert.equal(r.status, 403);

await call(`/api/admin/accounts/${sid}`, { method: "PATCH", token: admin, body: { disabled: false } });
r = await call(`/api/admin/accounts/${sid}/reset-password`, { method: "POST", token: admin, body: { password: "newpass99" } });
assert.equal(r.status, 200);
r = await call("/api/login", { method: "POST", body: { phone: "0911111111", password: "pw123456" } });
assert.equal(r.status, 401, "旧密码失效");
r = await call("/api/login", { method: "POST", body: { phone: "0911111111", password: "newpass99" } });
assert.equal(r.status, 200);

const adminId = (await call("/api/me", { token: admin })).json.me.id;
r = await call(`/api/admin/accounts/${adminId}`, { method: "PATCH", token: admin, body: { disabled: true } });
assert.equal(r.status, 400, "不能停用总后台");

r = await call("/api/me", { token: `${admin.slice(0, -2)}xx` });
assert.equal(r.status, 401, "伪造 token");

for (let i = 0; i < 5; i++) await call("/api/login", { method: "POST", body: { phone: "0933333333", password: "x" } });
r = await call("/api/login", { method: "POST", body: { phone: "0933333333", password: "x" } });
assert.equal(r.status, 429, "连续失败被锁定");

const pre = await fetch(`${base}/api/me`, { method: "OPTIONS", headers: { origin: "https://ok.example" } });
assert.equal(pre.headers.get("access-control-allow-origin"), "https://ok.example");
const pre2 = await fetch(`${base}/api/me`, { method: "OPTIONS", headers: { origin: "https://evil.example" } });
assert.equal(pre2.headers.get("access-control-allow-origin"), null, "其他来源不放行");

console.log("全部通过");
server.close();
process.exit(0);
