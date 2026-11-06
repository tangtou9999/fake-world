import { useState } from "react";

type Base = { name: string; avatar: string; note: string };

/** 真实微信「拆红包」弹层（参考图7） */
export const RedPacketOpen = ({
	name,
	avatar,
	note,
	onOpen,
	onClose,
}: Base & { onOpen: () => void; onClose: () => void }) => {
	const [spin, setSpin] = useState(false);
	return (
		<div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/55" onClick={onClose}>
			<div
				className="relative w-[77vw] max-w-[320px] overflow-hidden rounded-[8px] bg-[#E8523F]"
				style={{ aspectRatio: "0.605" }}
				onClick={(e) => e.stopPropagation()}
			>
				<svg viewBox="0 0 100 165" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
					<defs>
						<linearGradient id="rp-sh" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0" stopColor="#C8402F" stopOpacity="0.45" />
							<stop offset="1" stopColor="#C8402F" stopOpacity="0" />
						</linearGradient>
					</defs>
					<path d="M0 116 Q50 134 100 116 L100 165 L0 165 Z" fill="#F55641" />
					<path d="M0 116 Q50 134 100 116 L100 121 Q50 139 0 121 Z" fill="url(#rp-sh)" />
				</svg>
				<div className="absolute inset-x-0 top-[17%] flex flex-col items-center px-4 text-[#F8D9A0]">
					<div className="flex items-center gap-2 text-[15px]">
						<img src={avatar} className="h-[22px] w-[22px] rounded-[3px] object-cover" />
						<span className="max-w-[200px] truncate">{name}发出的红包</span>
					</div>
					<div className="mt-[18px] text-center font-medium text-[21px] leading-[28px]">{note || "恭喜发财，大吉大利"}</div>
				</div>
				<button
					type="button"
					onClick={() => {
						setSpin(true);
						setTimeout(onOpen, 350);
					}}
					className="absolute left-1/2 top-[76%] flex h-[24.5%] w-auto -translate-x-1/2 items-center justify-center rounded-full bg-[#E9C98F] text-[#5B4A36] shadow-[0_2px_4px_rgba(150,50,30,0.35)]"
					style={{ aspectRatio: "1", height: "19.5%", fontFamily: '"Songti SC","STSong","Noto Serif CJK SC",serif', fontSize: 44, transition: "transform .35s", transform: `translateX(-50%) rotateY(${spin ? 360 : 0}deg)` }}
				>
					開
				</button>
			</div>
			<button
				type="button"
				onClick={onClose}
				className="mt-5 flex h-[42px] w-[42px] items-center justify-center rounded-full border border-[#D8B26A] text-[#D8B26A]"
				aria-label="关闭"
			>
				<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
					<path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
				</svg>
			</button>
		</div>
	);
};

/** 红包领取详情页（参考图8） */
export const RedPacketDetail = ({
	name,
	avatar,
	note,
	amount,
	onClose,
}: Base & { amount: string; onClose: () => void }) => (
	<div className="fixed inset-0 z-50 flex flex-col bg-white">
		<div className="relative h-[calc(env(safe-area-inset-top)+96px)] shrink-0">
			<svg viewBox="0 0 100 20" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-full w-full" aria-hidden="true">
				<path d="M0 0H100V12Q50 24 0 12Z" fill="#F45745" />
				<path d="M0 12Q50 24 100 12" fill="none" stroke="#F8CF73" strokeWidth="0.35" vectorEffect="non-scaling-stroke" />
			</svg>
			<div className="absolute inset-x-0 bottom-[34px] flex items-center justify-between px-4 text-white">
				<button type="button" onClick={onClose} aria-label="返回">
					<svg width="12" height="20" viewBox="0 0 12 20" aria-hidden="true">
						<path d="M10 2L2 10l8 8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				</button>
				<svg width="22" height="6" viewBox="0 0 22 6" aria-hidden="true">
					<circle cx="3" cy="3" r="2.5" fill="white" />
					<circle cx="11" cy="3" r="2.5" fill="white" />
					<circle cx="19" cy="3" r="2.5" fill="white" />
				</svg>
			</div>
		</div>
		<div className="flex flex-col items-center pt-[22px]">
			<div className="flex items-center gap-2">
				<img src={avatar} className="h-[24px] w-[24px] rounded-[4px] object-cover" />
				<span className="max-w-[240px] truncate font-medium text-[20px] text-black/90">{name}发出的红包</span>
			</div>
			<div className="mt-2 text-[15px] text-black/30">{note || "恭喜发财，大吉大利"}</div>
			<div className="mt-5 flex items-baseline text-[#C4A26B]">
				<span className="font-medium text-[70px] leading-[76px] tracking-tight" style={{ fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif" }}>
					{Number(amount).toFixed(2)}
				</span>
				<span className="ml-1 text-[16px]">元</span>
			</div>
			<div className="mt-2 flex items-center gap-1 text-[15px] text-[#C4A26B]">
				已存入零钱，可直接转账
				<svg width="8" height="14" viewBox="0 0 8 14" aria-hidden="true">
					<path d="M1.5 1.5L7 7l-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			</div>
			<button type="button" onClick={onClose} className="mt-7 flex h-[52px] items-center gap-2 rounded-[6px] bg-[#F7F7F7] px-5 text-[16px] text-[#C4A26B]">
				<svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
					<circle cx="13" cy="13" r="11" stroke="currentColor" strokeWidth="1.6" />
					<circle cx="9.3" cy="10.5" r="1.3" fill="currentColor" />
					<circle cx="16.7" cy="10.5" r="1.3" fill="currentColor" />
					<path d="M7.5 14.5c1 3.2 4 4.6 7 3.8 1.7-.5 3-1.8 3.5-3.8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
				</svg>
				回复表情到聊天
			</button>
		</div>
	</div>
);
