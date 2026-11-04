import useModeNavigate from "@/components/useModeNavigate";
import useScreenTopBg from "@/components/useScreenTopBg";
import { balanceRecordsAtom } from "@/stateV2/balanceRecords";
import { useAtomValue } from "jotai";
import { useParams } from "react-router-dom";
import { centsToYuan, formatArrival } from "./money";

function ClockIcon() {
	return (
		<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
			<circle cx="11" cy="11" r="10" fill="#1485EE" />
			<path
				d="M11 6.2V11.4l3.1 1.8"
				fill="none"
				stroke="#fff"
				strokeWidth="1.6"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

const WithdrawResult = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useModeNavigate();
	const found = useAtomValue(balanceRecordsAtom).find((item) => item.id === id);
	const record = found?.kind === "withdraw" ? found : undefined;
	useScreenTopBg("#fff");

	const done = () => navigate("/wechat/wallet/balance", { replace: true });

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-white" data-testid="withdraw-result">
			<div className="grid h-11 shrink-0 grid-cols-3 items-center px-4">
				<div />
				<div className="text-center font-medium text-[17px]">零钱提现</div>
				<div />
			</div>
			{!record ? (
				<div className="pt-24 text-center text-[15px] text-black/40">记录不存在</div>
			) : (
				<div className="flex min-h-0 flex-1 flex-col px-8 pt-7">
					<div className="grid grid-cols-[22px_1fr] gap-x-3">
						<div className="flex h-full flex-col items-center">
							<span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#07C160]" />
							<span className="my-1 min-h-6 w-px flex-1 border-[#07C160] border-l border-dashed" />
						</div>
						<div className="pb-6 text-[15px] text-black/40 leading-5">发起提现申请</div>

						<div className="flex h-full flex-col items-center">
							<ClockIcon />
							<span className="my-1 min-h-6 w-px flex-1 border-black/20 border-l border-dashed" />
						</div>
						<div className="pb-6">
							<div className="font-medium text-[16px] text-black/90 leading-[22px]">银行处理中</div>
							<div className="mt-1 text-[13px] text-black/40 leading-5">
								{formatArrival(record.arrivalAt)}
							</div>
						</div>

						<div className="flex justify-center">
							<span className="mt-1 h-2.5 w-2.5 rounded-full bg-black/15" />
						</div>
						<div className="text-[15px] text-black/40 leading-5">到账成功</div>
					</div>

					<div className="mt-6 h-px bg-black/10" />
					<div className="mt-2">
						<div className="flex items-center justify-between py-2.5 text-[15px]">
							<span className="text-black/40">提现金额</span>
							<span className="text-black/90">¥{centsToYuan(record.amountCents)}</span>
						</div>
						<div className="flex items-center justify-between py-2.5 text-[15px]">
							<span className="text-black/40">到账银行卡</span>
							<span className="text-black/90">
								{record.bankName} 尾号{record.last4}
							</span>
						</div>
						<div className="flex items-center justify-between py-2.5 text-[15px]">
							<span className="text-black/40">服务费</span>
							<span className="text-black/90">¥{centsToYuan(record.feeCents)}</span>
						</div>
					</div>
					<div className="mt-auto flex justify-center pt-8 pb-12">
						<button
							type="button"
							className="h-[46px] w-[180px] rounded-[8px] bg-[#F2F2F2] text-[17px] text-black/90"
							onClick={done}
						>
							完成
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

export default WithdrawResult;
