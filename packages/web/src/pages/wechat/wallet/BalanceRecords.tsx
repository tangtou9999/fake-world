import BackFilledSVG from "@/assets/back-filled.svg?react";
import useModeNavigate from "@/components/useModeNavigate";
import useScreenTopBg from "@/components/useScreenTopBg";
import { balanceRecordsAtom } from "@/stateV2/balanceRecords";
import { useAtomValue } from "jotai";
import { centsToYuan, formatRecordTime } from "./money";

const BalanceRecords = () => {
	const navigate = useModeNavigate();
	const records = useAtomValue(balanceRecordsAtom);
	useScreenTopBg("#EDEDED");

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-[#EDEDED]">
			<div className="grid h-11 shrink-0 grid-cols-3 items-center bg-[#EDEDED] px-4">
				<BackFilledSVG
					fill="black"
					className="-ml-0.5 h-6 w-6 cursor-pointer"
					onClick={() => navigate("/wechat/wallet/balance")}
				/>
				<div className="text-center font-medium text-[17px]">零钱明细</div>
			</div>
			<div className="min-h-0 flex-1 overflow-auto">
				{records.length === 0 ? (
					<div className="pt-24 text-center text-[15px] text-black/30">暂无零钱明细</div>
				) : (
					<div className="mt-2 bg-white">
						{records.map((record) => (
							<div key={record.id} className="flex items-center px-4 py-3">
								<div className="min-w-0 flex-1">
									<div className="truncate text-[16px] text-black/90">
										提现-{record.bankName}（{record.last4}）
									</div>
									<div className="mt-1 text-[12px] text-black/30">
										{formatRecordTime(record.timestamp)}
									</div>
								</div>
								<div className="ml-3 text-right">
									<div className="text-[16px] text-black/90">
										-{centsToYuan(record.amountCents + record.feeCents)}
									</div>
									<div className="mt-1 text-[12px] text-black/30">
										余额 {centsToYuan(record.balanceAfterCents)}
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

export default BalanceRecords;
