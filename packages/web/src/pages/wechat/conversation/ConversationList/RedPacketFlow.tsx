import { MYSELF_ID } from "@/faker/wechat/user";
import { getMyProfileValueSnapshot, getProfileValueSnapshot } from "@/stateV2/profile";
import { useState } from "react";

type Props = {
	stage: "open" | "detail";
	peerId: string;
	originalSender: "mine" | "friend";
	amount: string;
	note?: string;
	/** 点「開」：真正领取，返回后切到详情页 */
	onOpen: () => void;
	onClose: () => void;
};

const Smile = () => (
	<svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
		<circle cx="11" cy="11" r="9.3" stroke="#C3A56F" strokeWidth="1.5" />
		<path d="M6.2 9.6c.3-1 1-1.4 1.8-1.4s1.5.4 1.8 1.4M12.2 9.6c.3-1 1-1.4 1.8-1.4s1.5.4 1.8 1.4" stroke="#C3A56F" strokeWidth="1.4" strokeLinecap="round" />
		<path d="M5.8 12.4h10.4c-.4 2.6-2.6 4.3-5.2 4.3s-4.8-1.7-5.2-4.3Z" stroke="#C3A56F" strokeWidth="1.4" strokeLinejoin="round" />
	</svg>
);

const RedPacketFlow = ({ stage, peerId, originalSender, amount, note, onOpen, onClose }: Props) => {
	const [spin, setSpin] = useState(false);
	const sender =
		originalSender === "friend" ? getProfileValueSnapshot(peerId) : getMyProfileValueSnapshot();
	const name = (originalSender === "friend" ? sender?.remark || sender?.nickname : sender?.nickname) || "好友";
	const text = note || "恭喜发财，大吉大利";
	const avatar = sender?.avatarInfo;
	void MYSELF_ID;

	if (stage === "open") {
		return (
			<div className="fixed inset-0 z-[9998] flex flex-col items-center bg-[#EDEDED]/80" onClick={onClose}>
				<div
					className="relative mt-[17vh] h-[59vh] w-[77%] max-w-[330px] overflow-hidden rounded-[8px] bg-[#F25544]"
					onClick={(e) => e.stopPropagation()}
				>
					{/* 上半部分深一点的红 + 封口弧线 */}
					<svg className="absolute inset-x-0 top-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
						<path d="M0 0H100V60.5Q50 68 0 60.5Z" fill="#E8503F" />
					</svg>
					<div className="relative flex flex-col items-center pt-[24%] text-[#F8DDA6]">
						<div className="flex items-center gap-2 text-[18px]">
							{avatar && <img src={avatar} alt="" className="h-6 w-6 rounded-[4px] object-cover" />}
							<span>{name}发出的红包</span>
						</div>
						<div className="mt-4 px-4 text-center font-medium text-[22px] leading-8">{text}</div>
					</div>
					<button
						type="button"
						aria-label="开"
						onClick={() => {
							setSpin(true);
							setTimeout(onOpen, 260);
						}}
						className="absolute top-[57%] left-1/2 flex h-[25%] w-[32%] -translate-x-1/2 items-center justify-center rounded-full bg-[#EBCB98] shadow-[0_4px_10px_rgba(0,0,0,0.22)]"
						style={{ aspectRatio: "1/1", height: "auto", transition: "transform .26s", transform: `translateX(-50%) rotateY(${spin ? 360 : 0}deg)` }}
					>
						<span className="font-serif text-[#4a4a4a] text-[44px] leading-none">開</span>
					</button>
				</div>
				<button type="button" aria-label="关闭" onClick={onClose} className="mt-6 flex h-10 w-10 items-center justify-center rounded-full border-[2px] border-[#C9A25E] text-[#C9A25E]">
					<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
				</button>
			</div>
		);
	}

	return (
		<div className="fixed inset-0 z-[9998] flex flex-col bg-white">
			<div className="relative w-full shrink-0 text-white" style={{ height: "max(131px, calc(env(safe-area-inset-top, 0px) + 72px))" }}>
				<svg className="absolute inset-0 h-full w-full" viewBox="0 0 402 131" preserveAspectRatio="none" aria-hidden="true">
					<path d="M0 0H402V92Q201 150 0 92Z" fill="#F25544" />
					<path d="M0 92Q201 150 402 92" fill="none" stroke="#F0CB7E" strokeWidth="1.6" />
				</svg>
				<div className="absolute inset-x-0 flex h-11 items-center justify-between px-4" style={{ top: "env(safe-area-inset-top, 0px)" }}>
					<button type="button" aria-label="返回" onClick={onClose} className="h-8 w-8">
						<svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true"><path d="M10 2L2 10l8 8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
					</button>
					<span className="tracking-[2px]">•••</span>
				</div>
			</div>
			<div className="flex flex-col items-center" style={{ marginTop: 28 }}>
				<div className="flex items-center gap-2 text-[20px] font-medium text-black/90">
					{avatar && <img src={avatar} alt="" className="h-6 w-6 rounded-[4px] object-cover" />}
					<span>{name}发出的红包</span>
				</div>
				<div className="mt-3 text-[15px] text-black/30">{text}</div>
				<div className="mt-5 flex items-baseline text-[#C3A56F]">
					<span className="font-medium text-[60px] leading-[64px] tracking-[1px]">{amount}</span>
					<span className="ml-1 text-[15px]">元</span>
				</div>
				<div className="mt-3 flex items-center text-[15px] text-[#B8975F]">
					已存入零钱，可直接转账
					<svg className="ml-1" width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true"><path d="M1.5 1.5L7 7l-5.5 5.5" stroke="#B8975F" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
				</div>
				<button type="button" onClick={onClose} className="mt-8 flex h-[47px] w-[150px] items-center justify-center gap-2 rounded-[6px] bg-[#F7F7F7] text-[15px] text-[#B8975F]">
					<Smile />
					回复表情到聊天
				</button>
			</div>
		</div>
	);
};

export default RedPacketFlow;
