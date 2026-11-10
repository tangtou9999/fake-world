import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { AUTH_ENABLED, ApiError, type Me, PERMS, type Perm, api, authAtom } from "./index";

type Perms = Record<Perm, boolean>;
const noPerms = (): Perms => Object.fromEntries(PERMS.map((p) => [p.key, false])) as Perms;
const inputCls = "w-full rounded-[6px] bg-[#F5F5F5] px-3 py-[8px] text-[16px] outline-none";

const PermSwitches = ({ perms, onChange, disabled }: { perms: Perms; onChange: (p: Perms) => void; disabled?: boolean }) => (
	<div className="divide-y divide-black/5">
		{PERMS.map((p) => (
			<label key={p.key} className="flex items-center justify-between gap-3 py-2">
				<div className="min-w-0">
					<div className="text-[15px]">{p.label}</div>
					<div className="text-[12px] text-black/40">{p.hint}</div>
				</div>
				<input type="checkbox" disabled={disabled} className="h-6 w-6 shrink-0 accent-[#07C160]" checked={!!perms[p.key]} onChange={(e) => onChange({ ...perms, [p.key]: e.target.checked })} />
			</label>
		))}
	</div>
);

const AccountCard = ({ acc, reload, setMsg }: { acc: Me; reload: () => void; setMsg: (s: string) => void }) => {
	const [open, setOpen] = useState(false);
	const isAdmin = acc.role === "admin";
	const run = async (fn: () => Promise<unknown>, ok: string) => {
		try {
			await fn();
			setMsg(ok);
			reload();
		} catch (e) {
			setMsg(e instanceof ApiError ? e.message : "操作失败");
		}
	};
	return (
		<div className="mb-3 rounded-[8px] bg-white p-3">
			<div className="flex items-center justify-between" onClick={() => setOpen(!open)}>
				<div className="min-w-0">
					<div className="truncate text-[16px]">
						{acc.name || acc.phone}
						<span className={`ml-2 rounded px-1 text-[11px] ${isAdmin ? "bg-[#07C160] text-white" : acc.role === "real" ? "bg-[#576B95] text-white" : "bg-black/10"}`}>
							{isAdmin ? "总后台" : acc.role === "real" ? "真实" : "剧情"}
						</span>
						{acc.disabled && <span className="ml-1 rounded bg-[#FA5151] px-1 text-[11px] text-white">已停用</span>}
					</div>
					<div className="text-[12px] text-black/40">
						{acc.phone} · {acc.lastLogin ? `上次登录 ${dayjs(acc.lastLogin).format("MM-DD HH:mm")}` : "还没登录过"}
					</div>
				</div>
				<div className="shrink-0 text-black/30">{open ? "收起" : "展开"}</div>
			</div>
			{open && (
				<div className="mt-3 border-black/5 border-t pt-2">
					{acc.role === "story" && (
						<PermSwitches perms={acc.perms} onChange={(p) => void run(() => api(`/api/admin/accounts/${acc.id}`, { method: "PATCH", body: { perms: p } }), "权限已保存")} />
					)}
					{acc.role === "real" && <div className="py-2 text-[13px] text-black/40">真实账号没有剧情功能权限。</div>}
					{isAdmin && <div className="py-2 text-[13px] text-black/40">总后台拥有全部权限，不能停用。</div>}
					<div className="mt-2 flex gap-2">
						<button
							type="button"
							className="h-9 flex-1 rounded-[6px] bg-[#F2F2F2] text-[14px]"
							onClick={() => {
								const pw = window.prompt(`给 ${acc.phone} 设置新密码（6 位以上）`);
								if (pw) void run(() => api(`/api/admin/accounts/${acc.id}/reset-password`, { method: "POST", body: { password: pw } }), "密码已重置，对方需要重新登录");
							}}
						>
							重置密码
						</button>
						{!isAdmin && (
							<button
								type="button"
								className={`h-9 flex-1 rounded-[6px] text-[14px] ${acc.disabled ? "bg-[#07C160] text-white" : "bg-[#FBE9E9] text-[#C62828]"}`}
								onClick={() => {
									if (!acc.disabled && !window.confirm(`停用 ${acc.phone}？对方会立刻被踢下线。`)) return;
									void run(() => api(`/api/admin/accounts/${acc.id}`, { method: "PATCH", body: { disabled: !acc.disabled } }), acc.disabled ? "已启用" : "已停用");
								}}
							>
								{acc.disabled ? "重新启用" : "停用"}
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	);
};

const AdminPage = () => {
	const a = useAtomValue(authAtom);
	const navigate = useNavigate();
	const [list, setList] = useState<Me[]>([]);
	const [msg, setMsg] = useState("");
	const [form, setForm] = useState({ phone: "", password: "", name: "", role: "story", perms: noPerms() });
	const [busy, setBusy] = useState(false);

	const reload = useCallback(() => {
		api<{ accounts: Me[] }>("/api/admin/accounts")
			.then((r) => setList(r.accounts))
			.catch((e) => setMsg(e instanceof ApiError ? e.message : "加载失败"));
	}, []);
	useEffect(reload, [reload]);
	useEffect(() => {
		if (!msg) return;
		const t = window.setTimeout(() => setMsg(""), 2500);
		return () => window.clearTimeout(t);
	}, [msg]);

	if (!AUTH_ENABLED || a.me?.role !== "admin") return <Navigate to="/" replace />;

	const create = async () => {
		setBusy(true);
		try {
			await api("/api/admin/accounts", { method: "POST", body: form });
			setMsg("已开通");
			setForm({ phone: "", password: "", name: "", role: "story", perms: noPerms() });
			reload();
		} catch (e) {
			setMsg(e instanceof ApiError ? e.message : "开通失败");
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex min-h-screen justify-center bg-[#EDEDED]">
			<div className="min-h-screen w-full max-w-[430px] bg-[#EDEDED] pb-10">
				<div className="sticky top-0 z-10 flex h-[48px] items-center justify-between bg-[#EDEDED] px-4">
					<button type="button" className="text-[16px]" onClick={() => navigate("/wechat/my/settings")}>
						返回
					</button>
					<div className="font-medium text-[17px]">总后台</div>
					<div className="w-8" />
				</div>
				{msg && <div className="pointer-events-none fixed top-16 left-1/2 z-20 -translate-x-1/2 rounded-[6px] bg-black/75 px-4 py-2 text-[14px] text-white">{msg}</div>}

				<div className="px-3">
					<div className="mb-2 px-1 text-[13px] text-black/40">开通新账号</div>
					<div className="mb-4 rounded-[8px] bg-white p-3">
						<div className="space-y-2">
							<input aria-label="新账号手机号" className={inputCls} inputMode="tel" placeholder="手机号" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
							<input aria-label="新账号密码" className={inputCls} placeholder="初始密码（6 位以上）" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
							<input aria-label="备注名" className={inputCls} placeholder="备注名（比如：安卓手机）" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
							<select aria-label="账号类型" className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
								<option value="story">剧情账号（使用现有界面，按下面的开关授权）</option>
								<option value="real">真实账号（真实聊天，开发中）</option>
							</select>
						</div>
						{form.role === "story" && (
							<div className="mt-2">
								<PermSwitches perms={form.perms} onChange={(p) => setForm({ ...form, perms: p })} />
							</div>
						)}
						<button type="button" disabled={busy || !form.phone || !form.password} className="mt-3 h-11 w-full rounded-[6px] bg-[#07C160] text-[16px] text-white disabled:opacity-40" onClick={() => void create()}>
							开通
						</button>
					</div>

					<div className="mb-2 px-1 text-[13px] text-black/40">全部账号（{list.length}）</div>
					{list.map((acc) => (
						<AccountCard key={acc.id + acc.disabled + JSON.stringify(acc.perms)} acc={acc} reload={reload} setMsg={setMsg} />
					))}
				</div>
			</div>
		</div>
	);
};

export default AdminPage;
