import { balanceRecordsAtom } from "@/stateV2/balanceRecords";
import useScreenTopBg from "@/components/useScreenTopBg";
import { useAtomValue } from "jotai";
import { useNavigate, useParams } from "react-router-dom";
import { centsToYuan } from "../wallet/money";
import { fmtFull, orderNo, productOf } from "./payUtils";

const Row = ({ k, v }: { k: string; v: string }) => (
	<div className="flex py-[9px] text-[15px] leading-[22px]">
		<div className="w-[96px] shrink-0 text-black/50">{k}</div>
		<div className="min-w-0 flex-1 break-all text-black/90">{v}</div>
	</div>
);

const Link = ({ label }: { label: string }) => (
	<div className="flex h-[52px] items-center justify-between border-black/10 border-b px-5 text-[16px] last:border-b-0">
		<span>{label}</span>
		<svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
			<path d="M1 1l6 6-6 6" stroke="rgba(60,60,67,0.42)" strokeWidth="2" strokeLinecap="round" />
		</svg>
	</div>
);

const PayBill = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const r = useAtomValue(balanceRecordsAtom).find((v) => v.id === id);
	useScreenTopBg("#fff");

	let name = "";
	let amount = "";
	let rows: [string, string][] = [];
	if (r?.kind === "withdraw") {
		name = `${r.bankName}（${r.last4}）`;
		amount = `-${centsToYuan(r.amountCents)}`;
		rows = [
			["当前状态", Date.now() >= r.arrivalAt ? "已到账" : "提现中"],
			["提现时间", fmtFull(r.timestamp)],
			["服务费", `¥${centsToYuan(r.feeCents)}`],
			["提现银行", `${r.bankName}（${r.last4}）`],
			["交易单号", orderNo(r)],
		];
	} else if (r) {
		const out = r.direction === "out";
		name = r.peerName;
		amount = `${out ? "-" : "+"}${centsToYuan(r.amountCents)}`;
		rows = [
			["当前状态", out ? "支付成功" : "已收款"],
			[out ? "支付时间" : "到账时间", fmtFull(r.timestamp)],
			["商品", productOf(r)],
			[out ? "收款方" : "付款方", r.peerName],
			...(r.acquirer ? ([["收单机构", r.acquirer]] as [string, string][]) : []),
			[out ? "支付方式" : "到账方式", r.payMethod || "零钱"],
			["交易单号", orderNo(r)],
			["商户单号", orderNo(r, "10")],
		];
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-white">
			<div className="relative flex h-11 shrink-0 items-center justify-center px-4">
				<button
					type="button"
					aria-label="关闭"
					className="absolute left-5 flex h-8 w-8 items-center"
					onClick={() => navigate(-1)}
				>
					<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
						<path d="M3 3l12 12M15 3L3 15" stroke="#000" strokeWidth="1.7" strokeLinecap="round" />
					</svg>
				</button>
				<div className="font-medium text-[17.5px]">账单详情</div>
				<button
					type="button"
					className="absolute right-4 text-[15px] text-[#576B95]"
					onClick={() => navigate("/wechat/wallet/balance/records")}
				>
					全部账单
				</button>
			</div>
			{!r ? (
				<div className="pt-24 text-center text-black/30">账单不存在</div>
			) : (
				<div className="min-h-0 flex-1 overflow-auto">
					<div className="flex flex-col items-center pt-8">
						<div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#F6B93B] font-medium text-[22px] text-white">
							{name.slice(0, 1)}
						</div>
						<div className="mt-3 text-[16px] text-black/90">{name}</div>
						<div className="mt-1 font-medium text-[44px] leading-[56px]">{amount}</div>
					</div>
					<div className="mx-5 mt-4 border-black/10 border-t pt-2">
						{rows.map(([k, v]) => (
							<Row key={k} k={k} v={v} />
						))}
					</div>
					<div className="mt-3 h-2 bg-[#F7F7F7]" />
					<div className="px-5 pt-4 pb-1 text-[14px] text-black/50">账单服务</div>
					<Link label="对此订单有疑惑" />
					<Link label="申请电子发票" />
					<div className="py-8 text-center text-[13px] text-black/40">本服务由财付通提供</div>
				</div>
			)}
		</div>
	);
};

export default PayBill;
