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
		<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden" {...lp} style={{ background: "linear-gradient(180deg,#F2B800 0%,#F2B300 22%,#F2AE00 55%,#F4AB00 100%)" }}>
			{editing && <WalletSheet onClose={() => setEditing(false)} />}
			<svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 390 800" aria-hidden="true">
				<path d="M0 150 L390 85 L390 200 L0 190Z" fill="#F2B800" opacity="0" />
				<path d="M390 70 L390 330 L230 120Z" fill="#F2B200" opacity="0.55" />
				<path d="M0 150 L120 190 L0 230Z" fill="#F2B000" opacity="0.5" />
				<path d="M0 230 L260 215 L390 330 L390 800 L0 800Z" fill="#F4AB00" opacity="0.22" />
				<path d="M60 640 L390 600 L390 800 L0 800Z" fill="#F7A900" opacity="0.3" />
			</svg>
			<div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto pb-6 [&>*]:shrink-0">
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
					<div className="flex h-[39px] w-[39px] items-center justify-center rounded-full bg-[#FEFBF2]">
						<svg width="20" height="18" viewBox="0 0 240 217" fill="#FFBF00" aria-hidden="true">
							<path d="M0 55 46 0H84L60 55Z" />
							<path d="M78 0H158L164 55H76Z" />
							<path d="M156 0H196L240 55H168Z" />
							<path d="M0 70H78L98 195Z" />
							<path d="M86 70H166L120 217Z" />
							<path d="M174 70H240L146 195Z" />
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
							<svg width="27" height="27" viewBox="-6 -6 312 312" aria-hidden="true">
								<path d="M20 32C60 40 90 30 100 2C104 40 90 70 60 90L20 90Z" fill="#2488D0" />
								<path d="M150 8C250 -5 310 90 295 150C296 190 300 225 302 240C285 228 270 220 260 215L150 150Z" fill="#2488D0" />
								<ellipse cx="152" cy="150" rx="148" ry="140" fill="#2488D0" />
								<path d="M128 -8C122 50 38 90 36 152C36 215 90 258 140 258C190 258 236 230 256 196C264 180 262 164 254 146C248 108 190 70 148 -8Z" fill="#fff" />
								<path d="M120 138L143 161L120 184L97 161Z" fill="#2488D0" />
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
