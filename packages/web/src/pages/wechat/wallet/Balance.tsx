import BackFilledSVG from "@/assets/back-filled.svg?react";
import CoinFilledSVG from "@/assets/coin-filled.svg?react";
import { canBeDetected } from "@/components/NodeDetected";
import useModeNavigate from "@/components/useModeNavigate";
import useScreenTopBg from "@/components/useScreenTopBg";
import { EMetaDataType } from "@/stateV2/detectedNode";
import { walletAtom } from "@/stateV2/wallet";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";

const Balance = () => {
	const { balance } = useAtomValue(walletAtom);
	const navigate = useModeNavigate();
	const { t } = useTranslation();
	useScreenTopBg("#fff");

	return (
		<div className="flex flex-1 flex-col bg-white">
			<div className="flex h-11 shrink-0 items-center justify-between px-4">
				<BackFilledSVG
					fill="black"
					className="-ml-0.5 h-6 w-6 cursor-pointer"
					onClick={() => navigate("/wechat/wallet")}
				/>
				<div className="text-[17px]">{t("wechatPage.wallet.balancePage.transactions")}</div>
			</div>

			<canBeDetected.div
				className="relative flex flex-1 flex-col items-center pt-[50px]"
				metaData={{
					type: EMetaDataType.Wallet,
					treeItemDisplayName: (data) => `我的零钱余额：¥${data.balance}`,
				}}
			>
				<CoinFilledSVG className="h-[52px] w-[52px]" fill="#FFC300" />
				<div className="mt-[35px] text-[17px] text-black/90 leading-6">
					{t("wechatPage.wallet.balancePage.my")}
				</div>
				<div className="mt-[11px] flex items-start text-black/90">
					<span className="mt-[7px] mr-[9px] font-bold text-[30px] leading-none">¥</span>
					<span className="font-semibold text-[50px] leading-[56px]">{balance}</span>
				</div>
				<div className="mt-[14px] flex items-center text-[#FA9D3B]">
					<span className="text-[16px] leading-[22px]">
						{t("wechatPage.wallet.balancePage.ad")}
					</span>
					<svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="ml-1" aria-hidden="true">
						<path d="M1 1l6 6-6 6" stroke="#FA9D3B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				</div>

				<div className="absolute bottom-[167px] flex flex-col items-center gap-[15px]">
					<div className="flex h-[46.5px] w-[178px] cursor-pointer items-center justify-center rounded-[10px] bg-[#07C160] font-medium text-[17px] text-white">
						{t("wechatPage.wallet.balancePage.topUp")}
					</div>
					<div className="flex h-[46.5px] w-[178px] cursor-pointer items-center justify-center rounded-[10px] bg-[#F2F2F2] font-medium text-[17px] text-black/90">
						{t("wechatPage.wallet.balancePage.withdraw")}
					</div>
				</div>
				<div className="absolute bottom-[56px] flex flex-col items-center">
					<div className="mb-[6px] flex items-center text-[#576B95] text-[14px] leading-5">
						<span>常见问题</span>
						<i className="mx-[10px] h-[14px] w-px bg-black/10" />
						<span>账户升级服务</span>
					</div>
					<div className="text-[12px] text-black/30 leading-4">
						本服务由财付通和微众银行提供
					</div>
				</div>
			</canBeDetected.div>
		</div>
	);
};

export default Balance;
