import useModeNavigate from "@/components/useModeNavigate";
import useScreenTopBg from "@/components/useScreenTopBg";
import { miniFundEarnings, walletAtom } from "@/stateV2/wallet";
import { WalletSheet } from "@/components/PhoneSheets";
import { useLongPress } from "@/components/SheetKit";
import { useAtomValue } from "jotai";
import { useState } from "react";
import type { ReactNode } from "react";

const GOLD = "#F3B500";

const Chevron = ({ color = "#B2B2B2", h = 13 }: { color?: string; h?: number }) => (
	<svg width={(h * 7) / 13} height={h} viewBox="0 0 7 13" fill="none" aria-hidden="true">
		<path d="M1 1l5 5.5L1 12" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

const Pill = ({ children }: { children: ReactNode }) => <div className="mt-[2px] rounded-full bg-[#F5F5F5] px-[11px] py-[3px] text-[#707070] text-[13px] leading-[16px]">{children}</div>;

const fix = (v: string | undefined, n: number) => {
	const x = Number.parseFloat(v ?? "");
	return Number.isNaN(x) ? (v ?? "") : x.toFixed(n);
};

/** 零钱通详情页（1:1 仿微信 8.0.x 金色渐变页） */
const MiniFund = () => {
	const w = useAtomValue(walletAtom);
	const earn = miniFundEarnings(w);
	const [editing, setEditing] = useState(false);
	const lp = useLongPress(() => setEditing(true));
	const navigate = useModeNavigate();
	useScreenTopBg(GOLD);

	return (
		<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F2B800]" {...lp}>
			{editing && <WalletSheet onClose={() => setEditing(false)} />}
			<div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto pb-6 [&>*]:shrink-0">
				<svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1206 2622" aria-hidden="true">
					<rect width="1206" height="2622" fill="#F2B800" />
					<polygon points="1206,230 1050,300 870,360 690,420 600,470 560,540 1206,712" fill="#F2B200" />
					<polygon points="0,410 480,545 0,708" fill="#F2B000" />
					<polygon points="0,708 420,540 600,540 1206,712 1206,1000 0,1400" fill="#F2AB00" />
					<polygon points="0,1400 1206,1000 1206,1470 0,1470" fill="#F2B200" />
					<rect y="1470" width="1206" height="1100" fill="#F2B000" />
					<polygon points="700,1470 1206,1470 1206,2560 550,2560 560,1930" fill="#F7A900" />
					<polygon points="550,2560 1206,2560 1206,2622 550,2622" fill="#F7AD00" />
				</svg>
				<div className="flex h-11 shrink-0 items-center justify-between px-4">
					<button type="button" className="-ml-1 flex h-8 w-8 items-center bg-transparent p-0" onClick={() => navigate("/wechat/wallet")} aria-label="返回">
						<svg width="12" height="21" viewBox="0 0 12 21" fill="none" aria-hidden="true">
							<path d="M10.5 1.5 2 10.5l8.500 9" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
					</button>
					<div className="flex gap-[5px]">
						{[0, 1, 2].map((i) => (
							<i key={i} className="h-[5px] w-[5px] rounded-full bg-white" />
						))}
					</div>
				</div>

				<div className="mt-[6px] flex flex-col items-center">
					<div className="flex h-[39px] w-[39px] items-center justify-center rounded-full bg-[#FDFAF0]">
						<svg width="23" height="21" viewBox="0 0 60 54" aria-hidden="true">
							<polygon points="14,3 46,3 58,18 30,52 2,18" fill="#FFC300" />
							<g stroke="#FDFAF0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
								<path d="M3 18H57" />
								<path d="M22 3 17 18 30 50" />
								<path d="M38 3 43 18 30 50" />
							</g>
						</svg>
					</div>
					<div className="mt-[6px] font-medium text-[21px] text-white leading-[26px]">零钱通</div>
					<div className="mt-[9px] flex items-center text-[15px] text-white">
						<svg width="16" height="18" viewBox="0 0 16 18" fill="none" aria-hidden="true">
							<path d="M8 1 1.500 3.200v5.400c0 4 2.800 7 6.500 8.400 3.700-1.400 6.500-4.400 6.500-8.400V3.200Z" stroke="#fff" strokeWidth="1.300" strokeLinejoin="round" />
							<path d="m5 8.800 2.300 2.300L11.200 7" stroke="#fff" strokeWidth="1.300" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
						<span className="mx-[6px]">资金安全保障中</span>
						<Chevron color="#fff" h={11} />
					</div>
				</div>

				<div className="mx-2 mt-[17px] rounded-[14px] bg-white pt-[36px] pb-[23px]">
					<div className="text-center text-[15px] text-black/90 leading-[22px]">账户余额</div>
					<div className="mt-[8px] flex items-start justify-center text-black/90">
						<span className="mt-[6px] mr-[8px] font-bold text-[27px] leading-none">¥</span>
						<span className="font-medium text-[46px] leading-[46px]" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
							{fix(w.miniFund, 2)}
						</span>
					</div>
					<div className="mt-[2px] text-center text-[#576B95] text-[15px] leading-[22px]">资金明细</div>

					<div className="mt-[22px] flex items-start">
						<div className="flex flex-1 flex-col items-center">
							<div className="flex items-center gap-[6px] text-[#8A8A8A] text-[15px] leading-[22px]">
								7日年化收益率
								<Chevron h={11} />
							</div>
							<div className="mt-[3px] text-[26px] text-black/90 leading-[30px]">{fix(w.miniFundYield, 4)}%</div>
							<Pill>{w.miniFundName || "南方现金通货币E"}</Pill>
						</div>
						<i className="mt-[2px] h-[70px] w-px bg-black/10" />
						<div className="flex flex-1 cursor-pointer flex-col items-center" onClick={() => navigate("/wechat/wallet/mini-fund/earnings")}>
							<div className="flex items-center gap-[6px] text-[#8A8A8A] text-[15px] leading-[22px]">
								累计收益
								<Chevron h={11} />
							</div>
							<div className="mt-[3px] text-[26px] text-black/90 leading-[30px]">¥{earn.total}</div>
							<Pill>昨日 ¥{earn.yesterday}</Pill>
						</div>
					</div>

					<div className="mt-[39px] flex justify-center gap-[16px] px-4">
						<button type="button" className="h-[46px] w-[116px] rounded-[8px] bg-[#F2F2F2] font-medium text-[17px]" style={{ color: GOLD }} onClick={() => navigate("/wechat/wallet/balance/withdraw")}>
							转出
						</button>
						<button type="button" className="h-[46px] w-[116px] rounded-[8px] font-medium text-[17px] text-white" style={{ background: GOLD }}>
							转入
						</button>
					</div>
					<div className="mt-[25px] flex items-center justify-center text-[#6B6B6B] text-[16px] leading-[22px]">
						<svg width="21" height="21" viewBox="0 0 21 21" fill="none" aria-hidden="true">
							<circle cx="10.500" cy="10.500" r="9.300" stroke={GOLD} strokeWidth="1.500" />
							<path d="M10.500 5.500v5.300l3.300 2" stroke={GOLD} strokeWidth="1.500" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
						<span className="mx-[8px]">设置定时转入</span>
						<Chevron h={11} />
					</div>
				</div>

				<div className="mt-[15px] px-2 text-[15px] text-white/85 leading-[20px]">更多产品</div>
				<div className="mx-2 mt-[10px] overflow-hidden rounded-[14px] bg-white">
					<div className="flex items-center justify-between px-[16px] py-[10px]">
						<span className="flex items-center">
							<svg width="26" height="29" viewBox="0 0 40 44" aria-hidden="true">
								<path d="M21 4C32 1 39 13 36 25 34 35 28 41 20 42 26 37 26 31 22 27 18 21 18 11 21 4Z" fill="#2F86CF" />
								<path d="M17 5 16 13C11 17 11 25 15 29 18 33 20 37 20 42 11 42 5 34 7 23 8 15 12 10 17 5Z" fill="#2093D8" />
								<path d="M17 31 20 34 17 37 14 34Z" fill="#fff" />
							</svg>
							<span className="ml-[12px] font-medium text-[19px] text-black/90 leading-[24px]">理财通</span>
						</span>
						<Chevron h={12} />
					</div>
					{[
						["活期理财", fix(w.finCurrent, 2), "转出最快秒到账", "收益率"],
						["定期理财", fix(w.finFixed, 2), "追求更高收益", "最高收益率"],
					].map(([title, rate, sub, tag]) => (
						<div key={title} className="mx-[15px] border-black/10 border-t pt-[8px] pb-[11px]">
							<div className="flex items-center justify-between">
								<span className="text-[17px] text-black/90 leading-[24px]">{title}</span>
								<span className="font-light text-[#F7A64A] text-[21px] leading-[24px]">{rate}%</span>
							</div>
							<div className="flex items-center justify-between text-[#8A8A8A] text-[15px] leading-[17px]">
								<span>{sub}</span>
								<span>{tag}</span>
							</div>
						</div>
					))}
				</div>
				<div className="mt-[26px] flex items-center justify-center text-[14px] text-white">
					<span>了解零钱通</span>
					<i className="mx-[14px] h-[13px] w-px bg-white/50" />
					<span>常见问题</span>
				</div>
			</div>
		</div>
	);
};

export default MiniFund;
