import { useState } from "react";
import { loginApi } from "./api";
import { writeSession } from "./session";

/** 仿微信手机号登录页 */
const LoginPage = ({ onDone }: { onDone: () => void }) => {
	const [phone, setPhone] = useState("");
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState("");
	const ready = phone.trim().length >= 6 && password.length >= 6;

	const submit = async () => {
		if (!ready || busy) return;
		setBusy(true);
		setErr("");
		try {
			const { token, user } = await loginApi(phone.trim(), password);
			const prev = JSON.parse(window.localStorage.getItem("auth-session") || "null") as { user?: { id: number } } | null;
			writeSession({ token, user, verifiedAt: Date.now() });
			// 换了账号：整页重新加载，让本机数据切到对应账号那一套
			if (!prev || prev.user?.id !== user.id) window.location.reload();
			else onDone();
		} catch (e) {
			setErr(e instanceof Error ? e.message : "登录失败");
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex h-full min-h-screen flex-col bg-white px-8 pt-[18vh]">
			<div className="font-medium text-[26px] text-black">手机号登录</div>
			<div className="mt-2 text-[14px] text-black/40">账号由管理员开通</div>
			<div className="mt-10">
				<div className="flex items-center border-black/10 border-b py-3">
					<div className="w-[72px] shrink-0 text-[17px] text-black">手机号</div>
					<input
						className="min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-black/25"
						inputMode="tel"
						autoComplete="username"
						placeholder="请填写手机号"
						value={phone}
						onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))}
					/>
				</div>
				<div className="flex items-center border-black/10 border-b py-3">
					<div className="w-[72px] shrink-0 text-[17px] text-black">密码</div>
					<input
						className="min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-black/25"
						type="password"
						autoComplete="current-password"
						placeholder="请填写密码"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && void submit()}
					/>
				</div>
			</div>
			<div className="mt-3 min-h-[20px] text-[14px] text-[#FA5151]">{err}</div>
			<button
				type="button"
				disabled={!ready || busy}
				onClick={submit}
				className={`mx-auto mt-6 h-[48px] w-[184px] rounded-[6px] text-[17px] text-white ${ready ? "bg-[#07C160]" : "bg-[#07C160]/50"}`}
			>
				{busy ? "登录中…" : "登录"}
			</button>
		</div>
	);
};

export default LoginPage;
