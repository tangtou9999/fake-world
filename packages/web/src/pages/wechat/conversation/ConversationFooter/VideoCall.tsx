import { getCallVideo, putCallVideo } from "@/utils/videoStore";
import { type ChangeEvent, useEffect, useRef, useState } from "react";

type Props = { storeKey: string; name: string; avatar: string; onEnd: (seconds: number) => void };

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** 微信风格的视频通话页：先「等待对方接受」，随后接通并循环播放你选的视频。右上角「换视频」可更换。 */
const VideoCall = ({ storeKey, name, avatar, onEnd }: Props) => {
	const [phase, setPhase] = useState<"wait" | "on">("wait");
	const [sec, setSec] = useState(0);
	const [src, setSrc] = useState("");
	const [hint, setHint] = useState("");
	const [needTap, setNeedTap] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);
	const vidRef = useRef<HTMLVideoElement>(null);
	const secRef = useRef(0);
	const urlRef = useRef("");

	const setBlob = (b: Blob) => {
		if (urlRef.current) URL.revokeObjectURL(urlRef.current);
		urlRef.current = URL.createObjectURL(b);
		setSrc(urlRef.current);
	};

	useEffect(() => {
		let dead = false;
		void getCallVideo(storeKey).then((b) => {
			if (b && !dead) setBlob(b);
		});
		const t = setTimeout(() => setPhase("on"), 2500);
		return () => {
			dead = true;
			clearTimeout(t);
			if (urlRef.current) URL.revokeObjectURL(urlRef.current);
		};
	}, [storeKey]);

	useEffect(() => {
		if (phase !== "on") return;
		const t = setInterval(() => {
			secRef.current += 1;
			setSec(secRef.current);
		}, 1000);
		return () => clearInterval(t);
	}, [phase]);

	useEffect(() => {
		const v = vidRef.current;
		if (phase !== "on" || !v || !src) return;
		v.muted = false;
		v.play().catch(() => {
			v.muted = true;
			setNeedTap(true);
			void v.play().catch(() => undefined);
		});
	}, [phase, src]);

	const onTap = () => {
		if (needTap && vidRef.current) {
			vidRef.current.muted = false;
			setNeedTap(false);
		}
	};
	const pick = () => fileRef.current?.click();

	const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
		const f = e.target.files?.item(0);
		e.target.value = "";
		if (!f) return;
		if (!f.type.startsWith("video/")) return setHint("请选择视频文件");
		setBlob(f);
		const ok = await putCallVideo(storeKey, f);
		setHint(ok ? "已换成新视频，下次通话也会用它" : "视频太大，没能保存；这次通话可以用，下次需要重新选");
		setTimeout(() => setHint(""), 3000);
	};

	return (
		<div className="fixed inset-0 z-[60] select-none overflow-hidden bg-[#1F1F1F] text-white" onClick={onTap}>
			<input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={onPick} onClick={(e) => e.stopPropagation()} />
			{phase === "on" && src && (
				// biome-ignore lint/a11y/useMediaCaption: 本地视频
				<video ref={vidRef} src={src} loop playsInline className="absolute inset-0 h-full w-full object-cover" />
			)}
			{phase === "wait" ? (
				<div className="flex h-full flex-col items-center pt-[22%]">
					<img src={avatar} alt="" className="h-[96px] w-[96px] rounded-[10px] object-cover" />
					<div className="mt-4 text-[22px]">{name}</div>
					<div className="mt-2 text-[14px] text-white/60">正在等待对方接受邀请…</div>
				</div>
			) : (
				<>
					<div className="absolute top-0 right-0 left-0 bg-gradient-to-b from-black/50 to-transparent px-4 pt-[calc(env(safe-area-inset-top)+14px)] pb-6 text-center">
						<div className="text-[16px]">{name}</div>
						<div className="mt-1 text-[14px] text-white/80">{fmt(sec)}</div>
					</div>
					{!src && (
						<div className="flex h-full flex-col items-center justify-center text-center text-white/60">
							<img src={avatar} alt="" className="mb-4 h-[96px] w-[96px] rounded-[10px] object-cover" />
							<div className="text-[14px]">还没有选视频</div>
							<div className="mt-1 text-[13px]">点右上角「换视频」，选择一段视频</div>
						</div>
					)}
				</>
			)}
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					pick();
				}}
				className="absolute top-[calc(env(safe-area-inset-top)+10px)] right-3 z-10 rounded-full bg-white/15 px-3 py-1 text-[13px] text-white/80"
			>
				换视频
			</button>
			{hint && <div className="absolute top-[18%] right-0 left-0 text-center text-[13px] text-white/80">{hint}</div>}
			<div className="absolute right-0 bottom-0 left-0 flex justify-center pb-[calc(env(safe-area-inset-bottom)+36px)]">
				<button
					type="button"
					aria-label="挂断"
					onClick={(e) => {
						e.stopPropagation();
						onEnd(phase === "on" ? secRef.current : -1);
					}}
					className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[#FA5151]"
				>
					<svg viewBox="0 0 24 24" className="h-7 w-7 rotate-[135deg]" fill="#fff" aria-hidden="true">
						<path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.400 11.400 0 0 0 3.600.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.500a1 1 0 0 1 1 1c0 1.250.2 2.450.57 3.600a1 1 0 0 1-.25 1Z" />
					</svg>
				</button>
			</div>
		</div>
	);
};
export default VideoCall;
