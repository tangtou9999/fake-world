import { type BalanceRecord, balanceRecordsAtom } from "@/stateV2/balanceRecords";
import { setDialogueListValue } from "@/stateV2/dialogueList";
import { PAY_ID } from "@/stateV2/payService";
import { useAtomValue } from "jotai";
import { type ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { centsToYuan } from "../wallet/money";
import { fmtShort, productOf } from "./payUtils";
import useScreenTopBg from "@/components/useScreenTopBg";

type Ev = { key: string; ts: number; node: ReactNode };

const Row = ({ k, v }: { k: string; v: string }) => (
	<div className="flex py-[3px] text-[15px] leading-6">
		<div className="w-[92px] shrink-0 text-black/50">{k}</div>
		<div className="min-w-0 flex-1 text-black/90">{v}</div>
	</div>
);

const Card = ({
	title,
	amount,
	rows,
	onDetail,
	detail = "详情",
}: {
	title: string;
	amount: string;
	rows: [string, string][];
	onDetail?: () => void;
	detail?: string;
}) => (
	<div className="mx-4 rounded-[6px] bg-white pt-4">
		<div className="px-4 font-medium text-[17px] text-black/90">{title}</div>
		<div className="px-4 pt-3 pb-2 font-medium text-[34px] text-black leading-[44px]">{amount}</div>
		<div className="px-4 pb-3">
			{rows.map(([k, v]) => (
				<Row key={k} k={k} v={v} />
			))}
		</div>
		<button
			type="button"
			onClick={onDetail}
			className="flex h-[46px] w-full items-center justify-between border-black/10 border-t px-4 text-[15px] text-black/90"
		>
			<span>{detail}</span>
			<svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
				<path d="M1 1l6 6-6 6" stroke="rgba(60,60,67,0.42)" strokeWidth="2" strokeLinecap="round" />
			</svg>
		</button>
	</div>
);

function buildEvents(records: BalanceRecord[], go: (id: string) => void): Ev[] {
	const evs: Ev[] = [];
	const now = Date.now();
	for (const r of records) {
		if (r.kind === "withdraw") {
			evs.push({
				key: `${r.id}-s`,
				ts: r.timestamp,
				node: (
					<Card
						title="零钱提现发起"
						amount={`¥${centsToYuan(r.amountCents)}`}
						rows={[
							["提现银行", `${r.bankName}（${r.last4}）`],
							["手续费", `¥${centsToYuan(r.feeCents)}`],
							["预计到账", fmtShort(r.arrivalAt)],
						]}
						onDetail={() => go(r.id)}
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
							amount={`¥${centsToYuan(r.amountCents)}`}
							rows={[
								["到账银行卡", `${r.bankName}（${r.last4}）`],
								["到账时间", fmtShort(r.arrivalAt)],
							]}
							onDetail={() => go(r.id)}
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
						amount={`¥${centsToYuan(r.amountCents)}`}
						rows={[
							["收款方", r.peerName],
							["商品", productOf(r)],
							["支付方式", r.payMethod || "零钱"],
						]}
						onDetail={() => go(r.id)}
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
						amount={`¥${centsToYuan(r.amountCents)}`}
						rows={[
							["付款方", r.peerName],
							["类型", productOf(r)],
							["到账方式", "零钱"],
						]}
						onDetail={() => go(r.id)}
					/>
				),
			});
		}
	}
	return evs.sort((a, b) => a.ts - b.ts);
}

const BarItem = ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
	<button type="button" onClick={onClick} className="flex h-full flex-1 items-center justify-center text-[16px] text-black/90">
		{children}
	</button>
);

const PayService = () => {
	const navigate = useNavigate();
	const records = useAtomValue(balanceRecordsAtom);
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
				<button
					type="button"
					aria-label="返回"
					className="absolute left-3 flex h-8 w-8 items-center"
					onClick={() => navigate("/wechat")}
				>
					<svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
						<path d="M10 2L2 10l8 8" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				</button>
				<div className="font-medium text-[17.5px]">微信支付</div>
				<div className="absolute right-4 flex gap-[3px]">
					<i className="h-[4px] w-[4px] rounded-full bg-black" />
					<i className="h-[4px] w-[4px] rounded-full bg-black" />
					<i className="h-[4px] w-[4px] rounded-full bg-black" />
				</div>
			</div>
			<div className="flex min-h-0 flex-1 flex-col justify-end overflow-auto pb-3">
				{events.length === 0 && <div className="m-auto text-[14px] text-black/30">暂无支付消息</div>}
				{events.map((e) => (
					<div key={e.key} className="mt-4">
						<div className="mb-3 text-center text-[12px] text-black/40">{fmtShort(e.ts)}</div>
						{e.node}
					</div>
				))}
			</div>
			<div className="flex h-[56px] shrink-0 items-center border-black/10 border-t bg-[#F7F7F7]">
				<BarItem>
					<svg width="26" height="20" viewBox="0 0 26 20" fill="none" aria-hidden="true">
						<rect x="1" y="2" width="24" height="16" rx="3" stroke="#222" strokeWidth="1.6" />
						<path d="M5 7h2M9 7h2M13 7h2M17 7h2M21 7h1M7 11h12M5 14.500h16" stroke="#222" strokeWidth="1.5" strokeLinecap="round" />
					</svg>
				</BarItem>
				<BarItem onClick={() => navigate("/wechat/wallet/balance/records")}>我的账单</BarItem>
				<BarItem onClick={() => navigate("/wechat/wallet")}>支付服务</BarItem>
				<BarItem>优惠</BarItem>
			</div>
		</div>
	);
};

export default PayService;
