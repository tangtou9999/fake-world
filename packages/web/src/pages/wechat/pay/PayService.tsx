import useScreenTopBg from "@/components/useScreenTopBg";
import { type BalanceRecord, balanceRecordsAtom } from "@/stateV2/balanceRecords";
import { setDialogueListValue } from "@/stateV2/dialogueList";
import { PAY_ID } from "@/stateV2/payService";
import { unreadCountAtom } from "@/stateV2/unreadCount";
import { useAtomValue } from "jotai";
import { type ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { centsToYuan } from "../wallet/money";
import { fmtShort, productOf } from "./payUtils";

type Ev = { key: string; ts: number; node: ReactNode };

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDT = (ts: number) => {
	const d = new Date(ts);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const bankText = (name: string, last4: string) => `${name} (${last4})`;

const Chev = () => (
	<svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
		<path d="M1 1l6 6-6 6" stroke="rgba(60,60,67,0.42)" strokeWidth="1.800" strokeLinecap="round" />
	</svg>
);

const Card = ({
	title,
	label,
	amount,
	rows,
	footers,
	onClick,
}: {
	title: string;
	label: string;
	amount: string;
	rows: [string, string][];
	footers?: { text: string; right?: string; onClick?: () => void }[];
	onClick?: () => void;
}) => (
	<div className="mx-[25px] rounded-[6px] bg-white pt-5 pb-4" onClick={onClick}>
		<div className="px-[18px] text-[17px] text-black/90 leading-[26px]">{title}</div>
		<div className="mt-[17px] text-center text-[15px] text-black/50 leading-6">{label}</div>
		<div className="mt-1 flex items-baseline justify-center leading-[52px]">
			<span className="mr-[6px] font-semibold text-[28px]">¥</span>
			<span className="font-semibold text-[41px]">{amount}</span>
		</div>
		<div
			className="mt-[10px] px-[18px] text-[15px]"
			style={{ display: "grid", gridTemplateColumns: "max-content 1fr", columnGap: 24 }}
		>
			{rows.flatMap(([k, v]) => [
				<div key={`${k}-k`} className="min-h-[29px] py-[6px] text-black/50 leading-[17px]">
					{k}
				</div>,
				<div key={`${k}-v`} className="min-h-[29px] py-[6px] text-black/90 leading-[17px]">
					{v}
				</div>,
			])}
		</div>
		{footers && (
			<div className="mt-[8px] px-[18px]">
				{footers.map((f) => (
					<div
						key={f.text}
						className="flex h-[42px] items-center justify-between border-black/10 border-t text-[15px]"
						onClick={f.onClick}
					>
						<span className="font-medium text-black/90">{f.text}</span>
						<span className="flex items-center text-black/40">
							{f.right && <span className="mr-2">{f.right}</span>}
							<Chev />
						</span>
					</div>
				))}
			</div>
		)}
	</div>
);

function buildEvents(records: BalanceRecord[], go: (id: string) => void): Ev[] {
	const evs: Ev[] = [];
	const now = Date.now();
	for (const r of records) {
		if (r.kind === "withdraw") {
			const bank = bankText(r.bankName, r.last4);
			evs.push({
				key: `${r.id}-s`,
				ts: r.timestamp,
				node: (
					<Card
						title="零钱提现发起"
						label="提现金额"
						amount={centsToYuan(r.amountCents)}
						rows={[
							["提现银行", bank],
							["提现时间", fmtDT(r.timestamp)],
							["预计到账时间", fmtDT(r.arrivalAt)],
						]}
					/>
				),
			});
			if (r.arrivalAt <= now) {
				evs.push({
					key: `${r.id}-d`,
					ts: r.arrivalAt,
					node: (
						<Card
							title="零钱提现已到账"
							label="提现金额"
							amount={centsToYuan(r.amountCents)}
							rows={[
								["提现银行", bank],
								["提现时间", fmtDT(r.timestamp)],
								["到账时间", fmtDT(r.arrivalAt)],
								["备注", "如有银行入账结果等疑问，轻触消息可查看详情和联系银行客服等"],
							]}
							footers={[{ text: "查看此银行卡余额" }, { text: "提现笔笔省", right: "领取提现免费券" }]}
						/>
					),
				});
			}
		} else if (r.direction === "out") {
			evs.push({
				key: r.id,
				ts: r.timestamp,
				node: (
					<Card
						title={`使用${r.payMethod || "零钱"}支付`}
						label="支付金额"
						amount={centsToYuan(r.amountCents)}
						rows={[
							["收款方", r.peerName],
							["商品", productOf(r)],
							["支付方式", r.payMethod || "零钱"],
							["支付时间", fmtDT(r.timestamp)],
						]}
						footers={[{ text: "查看账单详情", onClick: () => go(r.id) }]}
					/>
				),
			});
		} else {
			evs.push({
				key: r.id,
				ts: r.timestamp,
				node: (
					<Card
						title="收款到账"
						label="收款金额"
						amount={centsToYuan(r.amountCents)}
						rows={[
							["付款方", r.peerName],
							["类型", productOf(r)],
							["到账方式", "零钱"],
							["到账时间", fmtDT(r.timestamp)],
						]}
						footers={[{ text: "查看账单详情", onClick: () => go(r.id) }]}
					/>
				),
			});
		}
	}
	return evs.sort((a, b) => a.ts - b.ts);
}

const BarItem = ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
	<div className="flex h-[40px] flex-1 items-center justify-center border-black/10 border-l text-[14.5px] text-black/90 first:border-l-0" onClick={onClick}>
		{children}
	</div>
);

const PayService = () => {
	const navigate = useNavigate();
	const records = useAtomValue(balanceRecordsAtom);
	const { count } = useAtomValue(unreadCountAtom);
	useScreenTopBg("#EDEDED");

	useEffect(() => {
		setDialogueListValue((prev) =>
			prev.some((v) => v.friendId === PAY_ID && v.unreadMarkNumber)
				? prev.map((v) => (v.friendId === PAY_ID ? { ...v, unreadMarkNumber: undefined } : v))
				: prev,
		);
	}, []);

	const events = buildEvents(records, (id) => navigate(`/wechat/pay-service/bill/${id}`));

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-[#EDEDED]">
			<div className="relative flex h-11 shrink-0 items-center justify-center px-4">
				<div className="absolute left-3 flex items-center" onClick={() => navigate("/wechat")}>
					<svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
						<path d="M10 2L2 10l8 8" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
					{count > 0 && (
						<span className="ml-2 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-black/[0.12] px-1 text-[13px] text-black/80">
							{count > 99 ? "99+" : count}
						</span>
					)}
				</div>
				<div className="font-medium text-[17.5px]">微信支付</div>
				<div className="absolute right-4 flex items-center gap-5">
					<svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
						<circle cx="9.500" cy="9.500" r="7" stroke="#000" strokeWidth="1.800" />
						<path d="M15 15l5 5" stroke="#000" strokeWidth="1.800" strokeLinecap="round" />
					</svg>
					<svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true" onClick={() => navigate("/wechat/wallet")}>
						<circle cx="11" cy="11" r="3.200" stroke="#000" strokeWidth="1.700" />
						<path d="M11 1.500l1.800 2.200 2.800-.6.9 2.700 2.700.9-.6 2.800L20.800 11l-2.200 1.800.6 2.800-2.700.9-.9 2.700-2.800-.6L11 20.500l-1.800-2.200-2.800.6-.9-2.700-2.700-.9.6-2.800L1.200 11l2.200-1.800-.6-2.800 2.700-.9.9-2.700 2.800.6z" stroke="#000" strokeWidth="1.700" strokeLinejoin="round" />
					</svg>
				</div>
			</div>
			<div className="flex min-h-0 flex-1 flex-col overflow-auto pb-3">
				<div className="mt-auto" />
				{events.length === 0 && <div className="m-auto text-[14px] text-black/30">暂无支付消息</div>}
				{events.map((e, i) => (
					<div key={e.key} className="mt-3">
						{(i === 0 || e.ts - events[i - 1].ts > 5 * 60 * 1000) && (
							<div className="mb-3 pt-1 text-center text-[12px] text-black/40">{fmtShort(e.ts)}</div>
						)}
						{e.node}
					</div>
				))}
			</div>
			<div className="flex shrink-0 items-center border-black/10 border-t bg-[#F7F7F7] py-[1px]">
				<div className="flex h-[40px] w-[47px] shrink-0 items-center justify-center">
					<svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
						<circle cx="13" cy="14" r="11" stroke="#222" strokeWidth="1.600" />
						<path d="M10 3l3-2.500L16 3" stroke="#222" strokeWidth="1.400" strokeLinecap="round" strokeLinejoin="round" />
						<path d="M7.500 11h1.500M11 11h1.500M14.500 11h1.500M18 11h1M8.500 14.500h1.500M12 14.500h1.500M15.500 14.500h1.500M9 18h8" stroke="#222" strokeWidth="1.500" strokeLinecap="round" />
					</svg>
				</div>
				<BarItem onClick={() => navigate("/wechat/wallet/balance/records")}>我的账单</BarItem>
				<BarItem onClick={() => navigate("/wechat/wallet")}>支付服务</BarItem>
				<BarItem>优惠</BarItem>
			</div>
		</div>
	);
};

export default PayService;
