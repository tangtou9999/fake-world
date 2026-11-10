import type { ReactNode } from "react";
import { useAtomValue } from "jotai";
import { AUTH_ENABLED, authAtom, logout } from "./index";
import LoginPage from "./LoginPage";

const Center = ({ children }: { children: ReactNode }) => (
	<div className="flex min-h-screen items-center justify-center bg-[#EDEDED]">
		<div className="flex min-h-screen w-full max-w-[430px] flex-col items-center justify-center bg-white px-8 text-center">{children}</div>
	</div>
);

/** 没登录显示登录页；真实账号暂时只有占位页（真实聊天下一期）。 */
const AuthGate = ({ children }: { children: ReactNode }) => {
	const a = useAtomValue(authAtom);
	if (!AUTH_ENABLED) return <>{children}</>;
	if (a.status === "loading") return <Center><div className="text-black/40">加载中…</div></Center>;
	if (a.status === "out") return <LoginPage />;
	if (a.me?.role === "real") {
		return (
			<Center>
				<div className="font-medium text-[18px]">已登录 {a.me.phone}</div>
				<div className="mt-3 text-[14px] text-black/50 leading-6">真实账号的聊天功能还在开发中，开放后这里会自动出现。</div>
				<button type="button" className="mt-8 h-11 w-full rounded-[6px] bg-[#F2F2F2] text-[16px]" onClick={logout}>
					退出登录
				</button>
			</Center>
		);
	}
	return <>{children}</>;
};

export default AuthGate;
