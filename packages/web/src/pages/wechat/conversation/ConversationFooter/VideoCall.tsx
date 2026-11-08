import { RINGTONE_KEY, callKey, getCallVideo } from "@/utils/videoStore";
import { useEffect, useRef, useState } from "react";

type Props = {
	conversationId: string;
	name: string;
	avatar: string;
	/** true：对方打过来（只有接听按钮）；false：我打出去（先显示我这边的视频，等对方接受） */
	incoming: boolean;
	/** seconds：通话时长；-1 表示没接通就挂断；0 且来电表示拒接 */
	onEnd: (seconds: number) => void;
};

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const VideoCall = ({ conversationId, name, avatar, incoming, onEnd }: Props) => {
	const [phase, setPhase] = useState<"wait" | "ring" | "on">(incoming ? "ring" : "wait");
	const [sec, setSec] = useState(0);
	const [meSrc, setMeSrc] = useState("");
	const [frSrc, setFrSrc] = useState("");
	const [needTap, setNeedTap] = useState(false);
	const meRef = useRef<HTMLVideoElement>(null);
	const frRef = useRef<HTMLVideoElement>(null);
	const secRef = useRef(0);
	const urls = useRef<string[]>([]);

	useEffect(() => {
		let dead = false;
		const load = async (slot: "me" | "friend", set: (u: string) => void) => {
			const b = await getCallVideo(callKey(slot, conversationId));
			if (b && !dead) {
				const u = URL.createObjectURL(b);
				urls.current.push(u);
				set(u);
			}
		};
		void load("me", setMeSrc);
		void load("friend", setFrSrc);
		const t = incoming ? undefined : setTimeout(() => setPhase("on"), 3000);
		return () => {
			dead = true;
			if (t) clearTimeout(t);
			for (const u of urls.current) URL.revokeObjectURL(u);
		};
	}, [conversationId, incoming]);

	useEffect(() => {
		if (phase !== "on") return;
		const t = setInterval(() => {
			secRef.current += 1;
			setSec(secRef.current);
		}, 1000);
		return () => clearInterval(t);
	}, [phase]);

	// 等待 / 通话中：我这边的视频一直在播（静音，我自己的画面）；对方视频在接通后播放（带声音）
	useEffect(() => {
		const v = meRef.current;
		if (!v || !meSrc) return;
		v.muted = true;
		void v.play().catch(() => undefined);
	}, [meSrc, phase]);
	useEffect(() => {
		const v = frRef.current;
		if (phase !== "on" || !v || !frSrc) return;
		v.muted = false;
		v.play().catch(() => {
			v.muted = true;
			setNeedTap(true);
			void v.play().catch(() => undefined);
		});
	}, [phase, frSrc]);

	// 来电铃声：设置里上传的本地音频，响铃阶段循环播放，接听/挂断即停
	useEffect(() => {
		if (!incoming || phase !== "ring") return;
		let a: HTMLAudioElement | null = null;
		let url = "";
		let dead = false;
		void getCallVideo(RINGTONE_KEY).then((b) => {
			if (!b || dead) return;
			url = URL.createObjectURL(b);
			a = new Audio(url);
			a.loop = true;
			void a.play().catch(() => undefined);
		});
		return () => {
			dead = true;
			a?.pause();
			if (url) URL.revokeObjectURL(url);
		};
	}, [incoming, phase]);

	const hang = () => onEnd(phase === "on" ? secRef.current : incoming ? 0 : -1);
	const answer = () => {
		setPhase("on");
	};

	const meVideo = (cls: string) => (
		// biome-ignore lint/a11y/useMediaCaption: 本地视频
		<video ref={meRef} src={meSrc} loop playsInline muted className={cls} />
	);

	return (
		<div
			className="fixed inset-0 z-[9999] select-none overflow-hidden bg-[#1F1F1F] text-white"
			onClick={() => {
				if (needTap && frRef.current) {
					frRef.current.muted = false;
					setNeedTap(false);
				}
			}}
		>
			{/* 我打出去、还没接通：整屏是我这边的视频 */}
			{phase === "wait" && meSrc && meVideo("absolute inset-0 h-full w-full object-cover")}
			{/* 接通：整屏是对方的视频，我这边缩成右上角小窗 */}
			{phase === "on" && (
				<>
					{frSrc ? (
						// biome-ignore lint/a11y/useMediaCaption: 本地视频
						<video ref={frRef} src={frSrc} loop playsInline className="absolute inset-0 h-full w-full object-cover" />
					) : (
						<div className="flex h-full flex-col items-center justify-center text-white/60">
							<img src={avatar} alt="" className="mb-4 h-[96px] w-[96px] rounded-[10px] object-cover" />
							<div className="text-[13px]">还没上传「对方那边」的视频</div>
							<div className="mt-1 text-[12px]">聊天页连点三下屏幕 → 视频</div>
						</div>
					)}
					{meSrc && <div className="absolute top-[calc(env(safe-area-inset-top)+56px)] right-3 h-[160px] w-[100px] overflow-hidden rounded-[8px] bg-black shadow-lg">{meVideo("h-full w-full object-cover")}</div>}
				</>
			)}
			{phase === "ring" && (
				<div className="flex h-full flex-col items-center pt-[22%]">
					<img src={avatar} alt="" className="h-[96px] w-[96px] rounded-[10px] object-cover" />
					<div className="mt-4 text-[22px]">{name}</div>
					<div className="mt-2 text-[14px] text-white/60">邀请你视频通话</div>
				</div>
			)}
			{phase === "wait" && (
				<div className="absolute top-0 right-0 left-0 bg-gradient-to-b from-black/60 to-transparent px-4 pt-[calc(env(safe-area-inset-top)+14px)] pb-8 text-center">
					<div className="text-[16px]">{name}</div>
					<div className="mt-1 text-[14px] text-white/80">正在等待对方接受邀请…</div>
				</div>
			)}
			{phase === "on" && (
				<div className="absolute top-0 right-0 left-0 bg-gradient-to-b from-black/50 to-transparent px-4 pt-[calc(env(safe-area-inset-top)+14px)] pb-6 text-center">
					<div className="text-[16px]">{name}</div>
					<div className="mt-1 text-[14px] text-white/80">{fmt(sec)}</div>
				</div>
			)}
			{phase === "wait" && !meSrc && (
				<div className="flex h-full flex-col items-center pt-[30%] text-center text-white/60">
					<img src={avatar} alt="" className="mb-4 h-[96px] w-[96px] rounded-[10px] object-cover" />
					<div className="text-[13px]">还没上传「我这边」的视频</div>
					<div className="mt-1 text-[12px]">聊天页连点三下屏幕 → 视频</div>
				</div>
			)}
			<div className="absolute right-0 bottom-0 left-0 flex justify-center gap-[72px] pb-[calc(env(safe-area-inset-bottom)+36px)]">
				<button type="button" aria-label="挂断" onClick={hang} className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[#FA5151]">
					<svg viewBox="0 0 24 24" className="h-7 w-7 rotate-[135deg]" fill="#fff" aria-hidden="true">
						<path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.400 11.400 0 0 0 3.600.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.500a1 1 0 0 1 1 1c0 1.250.2 2.450.57 3.600a1 1 0 0 1-.25 1Z" />
					</svg>
				</button>
				{phase === "ring" && (
					<button type="button" aria-label="接听" onClick={answer} className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[#07C160]">
						<svg viewBox="0 0 24 24" className="h-7 w-7" fill="#fff" aria-hidden="true">
							<path d="M3.700 6.200h10.500a1.800 1.800 0 0 1 1.800 1.800v8a1.800 1.800 0 0 1-1.800 1.800H3.700A1.800 1.800 0 0 1 2 16V8a1.800 1.800 0 0 1 1.700-1.800Zm13.300 4 5-3v9.600l-5-3Z" />
						</svg>
					</button>
				)}
			</div>
		</div>
	);
};
export default VideoCall;
