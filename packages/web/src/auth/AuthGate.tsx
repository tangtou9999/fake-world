import { type ReactNode, useEffect, useState } from "react";
import { modeAtom } from "@/stateV2/mode";
import { mainStore } from "@/stateV2/store";
import { ApiError, meApi } from "./api";
import { AUTH_ENABLED } from "./config";
import LoginPage from "./LoginPage";
import RealApp from "./RealApp";
import { can, readSession, writeSession } from "./session";

const OFFLINE_GRACE = 3 * 86400_000;

/** 没登录就显示登录页；真实子账号只看落地页；剧情账号和总账号进原来的界面。 */
const AuthGate = ({ children }: { children: ReactNode }) => {
	const [state, setState] = useState<"checking" | "login" | "ok" | "offline">(() => (!AUTH_ENABLED ? "ok" : readSession() ? "checking" : "login"));

	useEffect(() => {
		if (!AUTH_ENABLED) return;
		const s = readSession();
		if (!s) return setState("login");
		meApi(s.token)
			.then(({ user }) => {
				writeSession({ token: s.token, user, verifiedAt: Date.now() });
				setState("ok");
			})
			.catch((e) => {
				if (e instanceof ApiError && e.status === 0 && Date.now() - s.verifiedAt < OFFLINE_GRACE) return setState("ok");
				if (e instanceof ApiError && e.status === 0) return setState("offline");
				writeSession(null);
				setState("login");
			});
	}, []);

	// 没有「编辑模式」权限的账号：不管从哪里打开，都立刻退回预览模式
	useEffect(() => {
		if (!AUTH_ENABLED) return;
		const force = () => {
			if (!can("editMode") && mainStore.get(modeAtom) === "edit") mainStore.set(modeAtom, "preview");
		};
		force();
		return mainStore.sub(modeAtom, force);
	}, []);

	if (!AUTH_ENABLED || state === "ok") {
		if (AUTH_ENABLED && readSession()?.user.role === "real") return <RealApp standalone />;
		return <>{children}</>;
	}
	if (state === "checking") return <div className="min-h-screen bg-white" />;
	if (state === "offline")
		return (
			<div className="flex min-h-screen flex-col items-center justify-center bg-white px-8 text-center">
				<div className="text-[16px]">连不上服务器，需要联网验证账号</div>
				<button type="button" className="mt-6 h-11 w-[140px] rounded-[6px] bg-[#07C160] text-[16px] text-white" onClick={() => window.location.reload()}>
					重试
				</button>
			</div>
		);
	return <LoginPage onDone={() => setState("ok")} />;
};

export default AuthGate;
