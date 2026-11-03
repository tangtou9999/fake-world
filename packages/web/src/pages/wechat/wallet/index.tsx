import BackFilledSVG from "@/assets/back-filled.svg?react";
import CoinOutlinedSVG from "@/assets/coin-outlined.svg?react";
import PayCardsOutlinedSVG from "@/assets/pay-cards-outlined.svg?react";
import PayMiniFundOutlinedSVG from "@/assets/pay-mini-fund-outlined.svg?react";
import PayRelativeCardsSVG from "@/assets/pay-relative-cards.svg?react";
import useModeNavigate from "@/components/useModeNavigate";
import { EMetaDataType } from "@/stateV2/detectedNode";
import { walletAtom } from "@/stateV2/wallet";
import List from "@/wechatComponents/List";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { BusinessIcon, FenfuIcon, GearIcon, IdCardIcon, ServiceCenterIcon } from "./WalletIcons";
import ZFF_SVG from "./assets/zff.svg?react";

const ROW = "min-h-[57px] text-[17px]";
const VALUE = "text-[16px] text-black/90";
const TAG = "ml-2 text-[13px] text-[#FA9D3B]";

const Wallet = () => {
	const navigate = useModeNavigate();
	const { balance, miniFund, miniFundYield, business } = useAtomValue(walletAtom);
	const { t } = useTranslation();

	return (
		<>
			<div className="grid h-11 shrink-0 grid-cols-3 items-center bg-[#EDEDED] px-4">
				<BackFilledSVG
					fill="black"
					className="-ml-0.5 h-6 w-6 cursor-pointer"
					onClick={() => navigate("/wechat/service")}
				/>
				<div className="flex items-center justify-center font-medium text-[17.5px]">
					{t("wechatPage.wallet.title")}
				</div>
				<div className="flex items-center justify-end text-[17px]">
					{t("wechatPage.wallet.transactions")}
				</div>
			</div>
			<div className="flex flex-1 flex-col overflow-auto bg-[#EDEDED]">
				<List className="border-black/10 border-t">
					<List.CanBeDetectedItem
						withJump
						rightClassName={ROW}
						icon={<CoinOutlinedSVG fill="#FFC300" />}
						onClick={() => navigate("/wechat/wallet/balance")}
						extra={<span className={VALUE}>¥{balance}</span>}
						metaData={{
							type: EMetaDataType.Wallet,
							treeItemDisplayName: (data) => `零钱余额：¥${data.balance}`,
						}}
					>
						{t("wechatPage.wallet.balance")}
					</List.CanBeDetectedItem>
					<List.CanBeDetectedItem
						withJump
						rightClassName={ROW}
						icon={<BusinessIcon />}
						extra={<span className={VALUE}>¥{business ?? "0.38"}</span>}
						metaData={{
							type: EMetaDataType.Wallet,
							treeItemDisplayName: (data) => `经营账户：¥${data.business ?? "0.38"}`,
						}}
					>
						经营账户
					</List.CanBeDetectedItem>
					<List.CanBeDetectedItem
						withJump
						rightClassName={ROW}
						icon={<PayMiniFundOutlinedSVG fill="#FFC300" />}
						extra={<span className={VALUE}>¥{miniFund}</span>}
						metaData={{
							type: EMetaDataType.Wallet,
							treeItemDisplayName: (data) => `零钱通余额：¥${data.miniFund}`,
						}}
					>
						<span className="flex items-center">
							{t("wechatPage.wallet.mf")}
							<span className={TAG}>
								{t("wechatPage.wallet.yield")}
								{miniFundYield}%
							</span>
						</span>
					</List.CanBeDetectedItem>
					<List.Item withJump rightClassName={ROW} icon={<PayCardsOutlinedSVG fill="#2A7FCB" />}>
						{t("wechatPage.wallet.cards")}
					</List.Item>
					<List.Item
						withJump
						rightClassName={ROW}
						icon={<PayRelativeCardsSVG className="h-6 w-6" fill="#FA9D3B" />}
					>
						{t("wechatPage.wallet.relativeCard")}
					</List.Item>
				</List>
				<List className="mt-[11px] border-black/10 border-y">
					<List.Item withJump rightClassName={ROW} icon={<FenfuIcon />}>
						<span className="flex items-center">
							分付
							<span className="ml-2 text-[14px] text-[#FA9D3B]">查看可用额度</span>
						</span>
					</List.Item>
				</List>
				<List className="mt-[11px] border-black/10 border-y">
					<List.Item withJump rightClassName={ROW} icon={<ZFF_SVG fill="#07C160" />}>
						{t("wechatPage.wallet.payScore")}
					</List.Item>
					<List.Item withJump rightClassName={ROW} icon={<GearIcon />}>
						支付设置
					</List.Item>
					<List.Item withJump rightClassName={ROW} icon={<IdCardIcon />}>
						{t("wechatPage.wallet.idInfo")}
					</List.Item>
					<List.Item withJump rightClassName={ROW} icon={<ServiceCenterIcon />}>
						客服中心
					</List.Item>
				</List>
			</div>
		</>
	);
};

export default Wallet;
