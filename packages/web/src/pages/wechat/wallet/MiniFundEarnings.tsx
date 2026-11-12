import { WalletSheet } from "@/components/PhoneSheets";
import { useLongPress } from "@/components/SheetKit";
import useModeNavigate from "@/components/useModeNavigate";
import useScreenTopBg from "@/components/useScreenTopBg";
import { miniFundDaily, miniFundEarnings, walletAtom } from "@/stateV2/wallet";
import dayjs from "dayjs";
import { useAtomValue } from "jotai";
import { useMemo, useState } from "react";

const YELLOW = "#EFB800";
const RANGES = [
	{ key: "7", label: "近7天", days: 7 },
	{ key: "30", label: "近30天", days: 30 },
	{ key: "90", label: "近3个月", days: 90 },
	{ key: "365", label: "近1年", days: 365 },
	{ key: "all", label: "全部", days: 100000 },
] as const;

const yuan = (c: number) => (c / 100).toFixed(2);

/** 累计收益页：顶部累计 / 昨日；下面可以切换时间范围看这段时间收了多少，并列出每天的收益明细。 */
const MiniFundEarnings = () => {
	const w = useAtomValue(walletAtom);
	const navigate = useModeNavigate();
	const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("30");
	const [editing, setEditing] = useState(false);
	const lp = useLongPress(() => setEditing(true));
	useScreenTopBg(YELLOW);

	const earn = miniFundEarnings(w);
	const daily = useMemo(() => miniFundDaily(w), [w.miniFund, w.miniFundYield, w.miniFundSince, w.miniFundTotal, w.miniFundYesterday]);
	const days = RANGES.find((r) => r.key === range)?.days ?? 30;
	const picked = daily.slice(0, days);
	const sum = picked.reduce((a, b) => a + b.cents, 0);
	const noYesterday = Number.parseFloat(earn.yesterday) === 0;

	const groups: { month: string; rows: typeof picked }[] = [];
	for (const r of picked.slice(0, 400)) {
		const m = dayjs(r.date).format("YYYY年M月");
		const g = groups.at(-1);
		if (g && g.month === m) g.rows.push(r);
		else groups.push({ month: m, rows: [r] });
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-[#EDEDED]" {...lp}>
			{editing && <WalletSheet onClose={() => setEditing(false)} />}
			<div className="flex min-h-0 flex-1 flex-col overflow-y-auto [&>*]:shrink-0">
				<div className="px-[21px] pb-[23px]" style={{ background: YELLOW }}>
					<div className="flex h-11 items-center justify-between">
						<button type="button" className="-ml-1 flex h-8 w-8 items-center bg-transparent p-0" onClick={() => navigate("/wechat/wallet/mini-fund")} aria-label="关闭">
							<svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
								<path d="M1 1l13 13M14 1 1 14" stroke="#fff" strokeOpacity="0.85" strokeWidth="1.6" strokeLinecap="round" />
							</svg>
						</button>
						<div className="flex gap-[5px]">
							{[0, 1, 2].map((i) => (
								<i key={i} className="h-[5px] w-[5px] rounded-full bg-white" />
							))}
						</div>
					</div>
					<div className="mt-[16px] text-center font-light text-[15px] text-white/70 leading-[22px]">累计收益</div>
					<div className="mt-[7px] flex items-start justify-center text-white">
						<span className="mt-[6px] mr-[7px] font-bold text-[22px] leading-none">¥</span>
						<span className="font-medium text-[42px] leading-[44px]">{earn.total}</span>
					</div>
					<div className="mt-[14px] text-center font-light text-[16px] text-white/70 leading-[22px]">昨日 ¥{earn.yesterday}</div>
					{noYesterday && (
						<div className="mt-[22px] flex h-[37px] items-center justify-center rounded-[6px] bg-white/20 text-[14px] text-white">
							<span>昨日无收益是因为零钱通余额过低。了解收益规则</span>
							<svg width="6" height="11" viewBox="0 0 7 13" fill="none" className="ml-[6px]" aria-hidden="true">
								<path d="M1 1l5 5.500L1 12" stroke="#fff" strokeWidth="1.500" strokeLinecap="round" strokeLinejoin="round" />
							</svg>
						</div>
					)}
				</div>

				<div className="flex gap-[8px] overflow-x-auto bg-white px-4 py-[12px]" style={{ scrollbarWidth: "none" }}>
					{RANGES.map((r) => (
						<button key={r.key} type="button" onClick={() => setRange(r.key)} className={`shrink-0 rounded-full px-[14px] py-[5px] text-[14px] ${range === r.key ? "bg-[#FFF3CC] text-[#C88A00]" : "bg-[#F5F5F5] text-black/60"}`}>
							{r.label}
						</button>
					))}
				</div>
				<div className="flex items-baseline justify-between border-black/5 border-t bg-white px-4 pt-[2px] pb-[14px]">
					<span className="text-[14px] text-black/50">{RANGES.find((r) => r.key === range)?.label}收益</span>
					<span className="font-medium text-[22px] text-black/90">+{yuan(sum)}</span>
				</div>

				<div className="px-4 pt-[14px] pb-[6px] text-[13px] text-black/40">收益明细</div>
				{groups.length === 0 && <div className="py-10 text-center text-[14px] text-black/30">还没有收益记录</div>}
				{groups.map((g) => (
					<div key={g.month}>
						<div className="bg-[#EDEDED] px-4 py-[6px] text-[13px] text-black/50">{g.month}</div>
						<div className="bg-white">
							{g.rows.map((r) => (
								<div key={r.date.getTime()} className="mx-4 flex items-center justify-between border-black/5 border-b py-[13px] last:border-b-0">
									<span className="text-[16px] text-black/90">{dayjs(r.date).format("M月D日")}</span>
									<span className={`text-[16px] ${r.cents > 0 ? "text-[#F29B2E]" : "text-black/40"}`}>+{yuan(r.cents)}</span>
								</div>
							))}
						</div>
					</div>
				))}
				<div className="h-8" />
			</div>
		</div>
	);
};

export default MiniFundEarnings;
