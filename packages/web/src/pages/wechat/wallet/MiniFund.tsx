import useModeNavigate from "@/components/useModeNavigate";
import useScreenTopBg from "@/components/useScreenTopBg";
import { walletAtom } from "@/stateV2/wallet";
import { useAtomValue } from "jotai";
import type { ReactNode } from "react";

const GOLD = "#F3B500";

const Chevron = ({ color = "#B2B2B2", h = 13 }: { color?: string; h?: number }) => (
	<svg width={(h * 7) / 13} height={h} viewBox="0 0 7 13" fill="none" aria-hidden="true">
		<path d="M1 1l5 5.5L1 12" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

const Pill = ({ children }: { children: ReactNode }) => <div className="mt-[8px] rounded-full bg-[#F4F4F4] px-[11px] py-[4px] text-[#6B6B6B] text-[13px] leading-[18px]">{children}</div>;

const fix = (v: string | undefined, n: number) => {
	const x = Number.parseFloat(v ?? "");
	return Number.isNaN(x) ? (v ?? "") : x.toFixed(n);
};

/** 零钱通详情页（1:1 仿微信 8.0.x 金色渐变页） */
const MiniFund = () => {
	const w = useAtomValue(walletAtom);
	const navigate = useModeNavigate();
	useScreenTopBg(GOLD);

	return (
		<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden" style={{ background: "linear-gradient(170deg,#F4B800 0%,#F3AE00 45%,#F5A300 100%)" }}>
			<svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 390 800" aria-hidden="true">
				<path d="M0 120 L390 230 L390 330 L0 190Z" fill="#fff" opacity="0.05" />
				<path d="M0 360 L260 520 L0 560Z" fill="#000" opacity="0.025" />
				<path d="M200 800 L390 560 L390 800Z" fill="#fff" opacity="0.05" />
			</svg>
			<div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto pb-6">
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

				<div className="mt-[14px] flex flex-col items-center">
					<div className="flex h-[39px] w-[39px] items-center justify-center rounded-full bg-[#FDFAF0]">
						<svg width="22" height="19" viewBox="0 0 66 58" fill="none" stroke={GOLD} strokeWidth="5.5" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
							<path d="M15.700 5H50.100L62.700 18.500L32.900 54L3.300 18.500Z" />
							<path d="M3.300 18.500H62.700M25.600 5L19.600 18.500M40.200 5L46.200 18.500M19.600 18.500L32.900 54M46.200 18.500L32.900 54" />
						</svg>
					</div>
					<div className="mt-[7px] font-medium text-[20px] text-white leading-[26px]">零钱通</div>
					<div className="mt-[11px] flex items-center text-[15px] text-white">
						<svg width="16" height="18" viewBox="0 0 16 18" fill="none" aria-hidden="true">
							<path d="M8 1 1.500 3.200v5.400c0 4 2.800 7 6.500 8.400 3.700-1.400 6.500-4.400 6.500-8.400V3.200Z" stroke="#fff" strokeWidth="1.300" strokeLinejoin="round" />
							<path d="m5 8.800 2.300 2.300L11.200 7" stroke="#fff" strokeWidth="1.300" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
						<span className="mx-[6px]">资金安全保障中</span>
						<Chevron color="#fff" h={11} />
					</div>
				</div>

				<div className="mx-2 mt-[30px] rounded-[14px] bg-white pt-[39px] pb-[27px]">
					<div className="text-center text-[15px] text-black/90">账户余额</div>
					<div className="mt-[18px] flex items-start justify-center text-black/90">
						<span className="mt-[9px] mr-[7px] font-bold text-[24px] leading-none">¥</span>
						<span className="font-medium text-[46px] leading-[54px]" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
							{fix(w.miniFund, 2)}
						</span>
					</div>
					<div className="mt-[10px] text-center text-[#576B95] text-[15px]">资金明细</div>

					<div className="mt-[44px] flex items-start">
						<div className="flex flex-1 flex-col items-center">
							<div className="flex items-center gap-[6px] text-[#8A8A8A] text-[15px]">
								7日年化收益率
								<Chevron h={11} />
							</div>
							<div className="mt-[9px] text-[31px] text-black/90 leading-[38px]">{fix(w.miniFundYield, 4)}%</div>
							<Pill>{w.miniFundName || "南方现金通货币E"}</Pill>
						</div>
						<i className="mt-[6px] h-[68px] w-px bg-black/10" />
						<div className="flex flex-1 flex-col items-center">
							<div className="flex items-center gap-[6px] text-[#8A8A8A] text-[15px]">
								累计收益
								<Chevron h={11} />
							</div>
							<div className="mt-[9px] text-[31px] text-black/90 leading-[38px]">¥{fix(w.miniFundTotal, 2)}</div>
							<Pill>昨日 ¥{fix(w.miniFundYesterday, 2)}</Pill>
						</div>
					</div>

					<div className="mt-[38px] flex justify-center gap-[16px] px-4">
						<button type="button" className="h-[46px] w-[116px] rounded-[8px] bg-[#F2F2F2] font-medium text-[17px]" style={{ color: GOLD }} onClick={() => navigate("/wechat/wallet/balance/withdraw")}>
							转出
						</button>
						<button type="button" className="h-[46px] w-[116px] rounded-[8px] font-medium text-[17px] text-white" style={{ background: GOLD }}>
							转入
						</button>
					</div>
					<div className="mt-[22px] flex items-center justify-center text-[#6B6B6B] text-[16px]">
						<svg width="21" height="21" viewBox="0 0 21 21" fill="none" aria-hidden="true">
							<circle cx="10.500" cy="10.500" r="9.300" stroke={GOLD} strokeWidth="1.500" />
							<path d="M10.500 5.500v5.300l3.300 2" stroke={GOLD} strokeWidth="1.500" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
						<span className="mx-[8px]">设置定时转入</span>
						<Chevron h={11} />
					</div>
				</div>

				<div className="mt-[18px] px-2 text-[15px] text-white/85">更多产品</div>
				<div className="mx-2 mt-[8px] rounded-[14px] bg-white px-[8px] pt-[6px] pb-[4px]">
					<div className="flex items-center justify-between px-[1px] py-[12px]">
						<span className="flex items-center">
							<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
								<circle cx="13" cy="13" r="12" fill="#1E88E5" />
								<circle cx="13" cy="13" r="5.500" fill="#fff" />
								<circle cx="13" cy="13" r="2.600" fill="#1E88E5" />
							</svg>
							<span className="ml-[14px] font-medium text-[19px] text-black/90">理财通</span>
						</span>
						<Chevron h={12} />
					</div>
					<div className="border-black/10 border-t py-[13px]">
						<div className="flex items-center justify-between">
							<span className="text-[17px] text-black/90">活期理财</span>
							<span className="text-[#F29B2E] text-[22px]">{fix(w.finCurrent, 2)}%</span>
						</div>
						<div className="mt-[3px] flex items-center justify-between text-[#8A8A8A] text-[15px]">
							<span>转出最快秒到账</span>
							<span>收益率</span>
						</div>
					</div>
					<div className="border-black/10 border-t py-[13px]">
						<div className="flex items-center justify-between">
							<span className="text-[17px] text-black/90">定期理财</span>
							<span className="text-[#F29B2E] text-[22px]">{fix(w.finFixed, 2)}%</span>
						</div>
						<div className="mt-[3px] flex items-center justify-between text-[#8A8A8A] text-[15px]">
							<span>追求更高收益</span>
							<span>最高收益率</span>
						</div>
					</div>
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
