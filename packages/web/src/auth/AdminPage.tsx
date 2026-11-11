import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "./config";
import { api } from "./api";
import { readSession } from "./session";
import { type AuthUser, PERM_KEYS, PERM_LABELS, type PermKey, isAdmin } from "./session";

const ROLE_LABEL = { admin: "总账号", real: "子账号", story: "子账号" } as const;
const inputCls = "w-full rounded-[6px] bg-[#F5F5F5] px-3 py-[8px] text-[16px] outline-none";

const Avatar = ({ id }: { id?: number | null }) => {
	const [src, setSrc] = useState("");
	useEffect(() => {
		if (!id) {
			setSrc("");
			return;
		}
		let url = "";
		fetch(`${API_BASE}/api/real/blob/${id}`, { headers: { Authorization: `Bearer ${readSession()?.token}` } })
			.then((r) => (r.ok ? r.blob() : null))
			.then((b) => {
				if (b) {
					url = URL.createObjectURL(b);
					setSrc(url);
				}
			})
			.catch(() => {});
		return () => {
			if (url) URL.revokeObjectURL(url);
		};
	}, [id]);
	return src ? <img src={src} alt="" className="mr-3 h-10 w-10 shrink-0 rounded-[6px] object-cover" /> : <div className="mr-3 h-10 w-10 shrink-0 rounded-[6px] bg-black/10" />;
};

const Switch = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
	<label className="flex items-center justify-between py-[7px] text-[15px]">
		<span>{label}</span>
		<input type="checkbox" className="h-[22px] w-[40px] cursor-pointer accent-[#07C160]" checked={on} onChange={(e) => onChange(e.target.checked)} />
	</label>
);

const AdminPage = () => {
	const [users, setUsers] = useState<AuthUser[]>([]);
	const [err, setErr] = useState("");
	const [form, setForm] = useState({ phone: "", password: "", name: "", role: "story" as "story" | "real", perms: {} as Partial<Record<PermKey, boolean>> });
	const [open, setOpen] = useState<number | null>(null);

	const load = useCallback(async () => {
		try {
			setUsers((await api<{ users: AuthUser[] }>("/api/admin/users")).users);
		} catch (e) {
			setErr(e instanceof Error ? e.message : "加载失败");
		}
	}, []);
	useEffect(() => {
		void load();
	}, [load]);

	const run = async (fn: () => Promise<unknown>) => {
		setErr("");
		try {
			await fn();
			await load();
		} catch (e) {
			setErr(e instanceof Error ? e.message : "操作失败");
		}
	};

	if (!isAdmin()) return <div className="p-8 text-center text-black/50">只有总账号可以进入后台</div>;

	return (
		<div className="h-full overflow-y-auto overscroll-contain bg-[#EDEDED] pb-[calc(40px+env(safe-area-inset-bottom))]" style={{ WebkitOverflowScrolling: "touch" }}>
			<div className="sticky top-0 z-10 flex h-[48px] items-center bg-[#EDEDED] px-4">
				<button type="button" className="text-[16px]" onClick={() => window.history.back()}>
					‹ 返回
				</button>
				<div className="flex-1 text-center font-medium text-[17px]">总后台</div>
				<div className="w-[50px]" />
			</div>
			{err && <div className="mx-4 mb-2 rounded-[6px] bg-[#FA5151]/10 px-3 py-2 text-[14px] text-[#FA5151]">{err}</div>}

			<div className="px-4 pt-2 pb-1 text-[13px] text-black/40">新建账号</div>
			<div className="mx-4 rounded-[8px] bg-white p-3">
				<div className="space-y-2">
					<input className={inputCls} placeholder="手机号" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^\d+]/g, "") })} />
					<input className={inputCls} placeholder="初始密码（至少 6 位）" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
					<input className={inputCls} placeholder="备注名（比如：安卓手机）" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
				</div>
				{(
					<div className="mt-2 border-black/5 border-t pt-1">
						{PERM_KEYS.map((k) => (
							<Switch key={k} label={PERM_LABELS[k]} on={!!form.perms[k]} onChange={(v) => setForm({ ...form, perms: { ...form.perms, [k]: v } })} />
						))}
					</div>
				)}
				<button
					type="button"
					className="mt-3 h-10 w-full rounded-[6px] bg-[#07C160] text-[16px] text-white"
					onClick={() =>
						run(async () => {
							await api("/api/admin/users", { body: form });
							setForm({ phone: "", password: "", name: "", role: form.role, perms: {} });
						})
					}
				>
					开通账号
				</button>
			</div>

			<div className="px-4 pt-4 pb-1 text-[13px] text-black/40">账号列表（{users.length}）</div>
			<div className="mx-4 overflow-hidden rounded-[8px] bg-white">
				{users.map((u) => (
					<div key={u.id} className="border-black/5 border-b last:border-b-0">
						<button type="button" className="flex w-full items-center justify-between px-3 py-3 text-left" onClick={() => setOpen(open === u.id ? null : u.id)}>
							<Avatar id={u.avatar} />
							<div className="min-w-0 flex-1">
								<div className="truncate text-[16px]">
									{u.nickname || u.name || u.phone}
									{u.disabled && <span className="ml-2 rounded bg-black/10 px-1 text-[12px] text-black/50">已停用</span>}
								</div>
								<div className="text-[13px] text-black/40">
									{u.phone} · {ROLE_LABEL[u.role]}
									{u.nickname && u.name && u.nickname !== u.name ? ` · 备注：${u.name}` : ""}
								</div>
							</div>
							<span className="ml-2 shrink-0 rounded-full bg-[#07C160]/10 px-3 py-1 text-[13px] text-[#07C160]">{open === u.id ? "收起 ⌃" : "权限 ⌄"}</span>
						</button>
						{open === u.id && (
							<div className="bg-[#FAFAFA] px-3 pb-3">
								{u.role !== "admin" &&
									PERM_KEYS.map((k) => (
										<Switch key={k} label={PERM_LABELS[k]} on={u.perms[k]} onChange={(v) => run(() => api(`/api/admin/users/${u.id}`, { method: "PATCH", body: { perms: { ...u.perms, [k]: v } } }))} />
									))}
								{u.role === "admin" ? (
									<div className="py-2 text-[13px] text-black/40">总账号拥有全部权限，不能被停用。</div>
								) : (
									<div className="mt-2 flex gap-2">
										<button
											type="button"
											className="h-9 flex-1 rounded-[6px] border border-black/15 text-[14px]"
											onClick={() => {
												const pw = window.prompt(`给「${u.name || u.phone}」设置新密码（至少 6 位）`);
												if (pw) void run(() => api(`/api/admin/users/${u.id}/reset-password`, { body: { password: pw } }));
											}}
										>
											重置密码
										</button>
										<button
											type="button"
											className={`h-9 flex-1 rounded-[6px] border text-[14px] ${u.disabled ? "border-[#07C160] text-[#07C160]" : "border-[#FA5151] text-[#FA5151]"}`}
											onClick={() => run(() => api(`/api/admin/users/${u.id}`, { method: "PATCH", body: { disabled: !u.disabled } }))}
										>
											{u.disabled ? "恢复使用" : "停用账号"}
										</button>
									</div>
								)}
							</div>
						)}
					</div>
				))}
			</div>
			<div className="px-4 pt-3 text-[12px] text-black/30">停用或重置密码后，对方已登录的设备会立刻失效。权限改动在对方下次打开 App 时生效。</div>
		</div>
	);
};

export default AdminPage;
