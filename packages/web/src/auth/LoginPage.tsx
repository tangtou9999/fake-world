import { useState } from "react";
import { ApiError, login } from "./index";

const LoginPage = () => {
	const [phone, setPhone] = useState("");
	const [pw, setPw] = useState("");
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState("");
	const ready = phone.trim().length >= 6 && pw.length >= 1 && !busy;

	const submit = async () => {
		if (!ready) return;
		setBusy(true);
		setErr("");
		try {
			await login(phone.trim(), pw);
		} catch (e) {
			setErr(e instanceof ApiError ? e.message : "登录失败，请重试");
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-[#EDEDED]">
			<form
				className="flex min-h-screen w-full max-w-[430px] flex-col bg-white px-8 pt-[12vh]"
				onSubmit={(e) => {
					e.preventDefault();
					void submit();
				}}
			>
				<div className="mx-auto mb-10 flex h-[72px] w-[72px] items-center justify-center rounded-[16px] bg-[#07C160]">
					<svg viewBox="0 0 24 24" width="40" height="40" fill="white" aria-hidden="true">
						<path d="M9.5 4C5.4 4 2 6.9 2 10.5c0 2 1.1 3.800 2.800 5L4 18l2.800-1.400c.8.2 1.700.4 2.700.4h.5c-.1-.4-.2-.8-.2-1.200C9.800 12.900 12.800 10 16.500 10h.400C16.300 6.600 13.200 4 9.500 4Zm-2.500 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm5 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
						<path d="M22 14.500c0-2.500-2.500-4.500-5.500-4.500S11 12 11 14.500s2.500 4.500 5.500 4.500c.6 0 1.200-.1 1.700-.2L20 19.800l-.6-1.900c1.500-.9 2.600-2.300 2.600-3.400Zm-7.300-.7a.8.8 0 1 1 0-1.600.8.8 0 0 1 0 1.600Zm3.600 0a.8.8 0 1 1 0-1.600.8.8 0 0 1 0 1.600Z" />
					</svg>
				</div>
				<div className="mb-8 text-center font-medium text-[22px]">手机号登录</div>

				<label className="flex items-center border-black/10 border-b py-3">
					<span className="w-[72px] shrink-0 text-[17px]">手机号</span>
					<input
						aria-label="手机号"
						inputMode="tel"
						autoComplete="username"
						className="min-w-0 flex-1 bg-transparent text-[17px] outline-none"
						placeholder="请输入手机号"
						value={phone}
						onChange={(e) => setPhone(e.target.value)}
					/>
				</label>
				<label className="flex items-center border-black/10 border-b py-3">
					<span className="w-[72px] shrink-0 text-[17px]">密码</span>
					<input
						aria-label="密码"
						type="password"
						autoComplete="current-password"
						className="min-w-0 flex-1 bg-transparent text-[17px] outline-none"
						placeholder="请输入密码"
						value={pw}
						onChange={(e) => setPw(e.target.value)}
					/>
				</label>

				<div className="mt-3 min-h-[20px] text-[14px] text-[#FA5151]">{err}</div>
				<button type="submit" disabled={!ready} className="mx-auto mt-6 h-[48px] w-full rounded-[6px] bg-[#07C160] text-[17px] text-white disabled:opacity-40">
					{busy ? "登录中…" : "登录"}
				</button>
				<div className="mt-6 text-center text-[13px] text-black/40">账号由管理员开通，忘记密码请联系管理员</div>
			</form>
		</div>
	);
};

export default LoginPage;
