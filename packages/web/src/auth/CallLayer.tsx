import { h } from "@/components/HashAssets";
import { getProfileValueSnapshot } from "@/stateV2/profile";
import { useEffect, useState } from "react";
import { acceptCall, hangup, rejectCall, toggleMute, toggleSpeaker, useCall } from "./call";

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const Btn = ({ label, color, on, onClick, children, testId }: { label: string; color: string; on?: boolean; onClick: () => void; children: React.ReactNode; testId?: string }) => (
	<div className="flex flex-col items-center">
		<button type="button" data-testid={testId} onClick={onClick} className="flex h-[68px] w-[68px] items-center justify-center rounded-full text-white" style={{ background: on ? "#fff" : color, color: on ? "#222" : "#fff" }}>
			{children}
		</button>
		<span className="mt-2 text-[13px] text-white/70">{label}</span>
	</div>
);

const Ico = ({ d }: { d: string }) => (
	<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true">
		<path d={d} />
	</svg>
);
const PHONE = "M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1Z";
const MIC = "M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11Z";
const SPK = "M3 10v4h4l5 4V6L7 10H3Zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4Z";

/** 全局的来电 / 通话中界面（仿微信语音通话），放在登录后的界面最上层 */
const CallLayer = () => {
	const c = useCall();
	const [, tick] = useState(0);
	useEffect(() => {
		if (c.phase !== "connected") return;
		const t = setInterval(() => tick((n) => n + 1), 1000);
		return () => clearInterval(t);
	}, [c.phase]);

	if (c.phase === "idle") {
		return c.note ? <div className="pointer-events-none fixed inset-x-0 top-16 z-[100] flex justify-center"><div className="rounded-[8px] bg-black/75 px-4 py-2 text-[14px] text-white">{c.note}</div></div> : null;
	}
	const p = getProfileValueSnapshot(`real-${c.peer}`);
	const status = c.phase === "incoming" ? "邀请你语音通话" : c.phase === "calling" ? "正在等待对方接受邀请" : c.phase === "connecting" ? "正在连接…" : mmss(Math.max(0, Math.round((Date.now() - c.startedAt) / 1000)));

	return (
		<div data-testid="call-layer" className="fixed inset-0 z-[100] flex flex-col items-center bg-[#2B2B2B] pt-[calc(80px+env(safe-area-inset-top))] pb-[calc(48px+env(safe-area-inset-bottom))]">
			<h.img src={p?.avatarInfo} className="h-[96px] w-[96px] rounded-[10px] object-cover" />
			<div className="mt-5 text-[24px] text-white">{p?.nickname ?? "对方"}</div>
			<div className="mt-3 text-[15px] text-white/60" data-testid="call-status">
				{status}
			</div>
			<div className="flex-1" />
			{c.phase === "incoming" ? (
				<div className="flex w-full justify-around px-10">
					<Btn label="拒绝" color="#FA5151" onClick={rejectCall} testId="call-reject">
						<span className="rotate-[135deg]"><Ico d={PHONE} /></span>
					</Btn>
					<Btn label="接听" color="#07C160" onClick={() => void acceptCall()} testId="call-accept">
						<Ico d={PHONE} />
					</Btn>
				</div>
			) : (
				<div className="flex w-full justify-around px-8">
					<Btn label={c.muted ? "麦克风已关" : "麦克风已开"} color="#4A4A4A" on={c.muted} onClick={toggleMute}>
						<Ico d={MIC} />
					</Btn>
					<Btn label="挂断" color="#FA5151" onClick={() => hangup()} testId="call-hangup">
						<span className="rotate-[135deg]"><Ico d={PHONE} /></span>
					</Btn>
					<Btn label={c.speaker ? "扬声器已开" : "扬声器已关"} color="#4A4A4A" on={c.speaker} onClick={toggleSpeaker}>
						<Ico d={SPK} />
					</Btn>
				</div>
			)}
		</div>
	);
};

export default CallLayer;
