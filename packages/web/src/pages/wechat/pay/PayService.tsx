import { type BalanceRecord, balanceRecordsAtom } from "@/stateV2/balanceRecords";
import { setDialogueListValue } from "@/stateV2/dialogueList";
import { unreadCountAtom } from "@/stateV2/unreadCount";
import { PAY_ID } from "@/stateV2/payService";
import { useAtomValue } from "jotai";
import { type ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { centsToYuan } from "../wallet/money";
import { fmtDash, fmtShort, productOf } from "./payUtils";
import useScreenTopBg from "@/components/useScreenTopBg";

type Ev = { key: string; ts: number; node: ReactNode };

const Chev = () => (
	<svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true" className="ml-2 shrink-0">
		<path d="M1 1l6 6-6 6" stroke="rgba(60,60,67,0.42)" strokeWidth="2" strokeLinecap="round" />
	</svg>
);

type CardLink = { label: string; right?: string; onClick?: () => void };

const Card = ({
	title,
	label,
	amount,
	rows,
	links = [],
}: {
	title: string;
	label: string;
	amount: string;
	rows: [string, string][];
	links?: CardLink[];
}) => (
	<div className="mx-[25px] rounded-[6px] bg-white pt-[14px]">
		<div className="px-[19px] font-medium text-[17px] text-black/90 leading-6">{title}</div>
		<div className="mt-[14px] text-center text-[15px] text-black/50">{label}</div>
		<div className="mt-[2px] flex items-baseline justify-center font-medium text-black">
			<span className="mr-[6px] text-[24px]">¥</span>
			<span className="text-[42px] leading-[52px]">{amount}</span>
		</div>
		<div className="grid gap-x-5 gap-y-[8px] px-[19px] pt-[14px] pb-[22px] text-[15px] leading-[21px]" style={{ gridTemplateColumns: "max-content 1fr" }}>
			{rows.map(([k, v]) => (
				<div key={k} className="contents">
					<div className="text-black/50">{k}</div>
					<div className="min-w-0 text-black/90">{v}</div>
				</div>
			))}
		</div>
		{links.length > 0 && (
			<div className="mx-[19px] border-black/10 border-t">
				{links.map((l) => (
					<button
						key={l.label}
						type="button"
						onClick={l.onClick}
						className="flex h-[43px] w-full items-center border-black/10 border-b text-left text-[16px] text-black/90 last:border-b-0"
					>
						<span className="flex-1">{l.label}</span>
						{l.right && <span className="text-black/45">{l.right}</span>}
						<Chev />
					</button>
				))}
			</div>
		)}
		{links.length === 0 && <div className="h-0" />}
	</div>
);

function buildEvents(records: BalanceRecord[], go: (id: string) => void): Ev[] {
	const evs: Ev[] = [];
	const now = Date.now();
	for (const r of records) {
		if (r.kind === "withdraw") {
			const bank = `${r.bankName} (${r.last4})`;
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
							["提现时间", fmtDash(r.timestamp)],
							["预计到账时间", fmtDash(r.arrivalAt)],
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
								["提现时间", fmtDash(r.timestamp)],
								["到账时间", fmtDash(r.arrivalAt)],
								["备注", "如有银行入账结果等疑问，轻触消息可查看详情和联系银行客服等"],
							]}
							links={[
								{ label: "查看此银行卡余额" },
								{ label: "提现笔笔省", right: "领取提现免费券" },
							]}
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
							["支付时间", fmtDash(r.timestamp)],
						]}
						links={[{ label: "详情", onClick: () => go(r.id) }]}
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
							["到账时间", fmtDash(r.timestamp)],
						]}
						links={[{ label: "详情", onClick: () => go(r.id) }]}
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
	const unread = useAtomValue(unreadCountAtom).count;
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
					className="absolute left-3 flex h-8 items-center"
					onClick={() => navigate("/wechat")}
				>
					<svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
						<path d="M10 2L2 10l8 8" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
					{unread > 0 && (
						<span className="ml-2 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-black/10 px-1 text-[14px] text-black/70">
							{unread}
						</span>
					)}
				</button>
				<div className="font-medium text-[17.5px]">微信支付</div>
				<div className="absolute right-4 flex items-center gap-5">
					<svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
						<circle cx="9.500" cy="9.500" r="7" stroke="#000" strokeWidth="1.8" />
						<path d="M15 15l5 5" stroke="#000" strokeWidth="1.8" strokeLinecap="round" />
					</svg>
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<circle cx="12" cy="12" r="3.200" stroke="#000" strokeWidth="1.8" />
						<path d="M12 2.500l1.800 2.300 2.800-.6 1 2.700 2.700 1-.6 2.800 2.300 1.800-2.300 1.800.6 2.800-2.700 1-1 2.700-2.800-.6L12 21.500l-1.800-2.300-2.800.6-1-2.700-2.700-1 .6-2.800L2 12l2.300-1.800-.6-2.800 2.700-1 1-2.700 2.800.6z" stroke="#000" strokeWidth="1.600" strokeLinejoin="round" />
					</svg>
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
			<div className="flex h-[48px] shrink-0 items-stretch border-black/10 border-t bg-[#F7F7F7]">
				<div className="flex w-[48px] items-center justify-center border-black/10 border-r">
					<svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
						<circle cx="13" cy="14" r="11" stroke="#222" strokeWidth="1.5" />
						<path d="M9 2.500l4-2 4 2" stroke="#222" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
						<path d="M7.500 10h1.500M11 10h1.500M14.500 10H16M18 10h1M7.500 13.500H9M11 13.500h1.500M14.500 13.500H16M18 13.500h1M9 17.500h8" stroke="#222" strokeWidth="1.500" strokeLinecap="round" />
					</svg>
				</div>
				<BarItem onClick={() => navigate("/wechat/wallet/balance/records")}>我的账单</BarItem>
				<div className="my-[6px] w-px bg-black/10" />
				<BarItem onClick={() => navigate("/wechat/wallet")}>支付服务</BarItem>
				<div className="my-[6px] w-px bg-black/10" />
				<BarItem>优惠</BarItem>
			</div>
		</div>
	);
};

export default PayService;
