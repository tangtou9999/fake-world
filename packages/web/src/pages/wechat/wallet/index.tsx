import BackFilledSVG from "@/assets/back-filled.svg?react";
import CoinOutlinedSVG from "@/assets/coin-outlined.svg?react";
import PayCardsOutlinedSVG from "@/assets/pay-cards-outlined.svg?react";
import useModeNavigate from "@/components/useModeNavigate";
import { EMetaDataType } from "@/stateV2/detectedNode";
import { walletAtom } from "@/stateV2/wallet";
import List from "@/wechatComponents/List";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { WalletSheet } from "@/components/PhoneSheets";
import { useLongPress } from "@/components/SheetKit";
import { useTranslation } from "react-i18next";
import {
	BusinessIcon,
	DiamondIcon,
	FenfuIcon,
	GearIcon,
	IdCardIcon,
	KinCardIcon,
	ScoreIcon,
	ServiceCenterIcon,
} from "./WalletIcons";

const ROW = "min-h-[56.8px] pl-[1px] pr-[18.9px] text-[17px]";
const VALUE = "relative -top-[1px] text-[17px] text-black/90";

/** 与真实微信对齐的小箭头（6.3×12.3pt，距右 18.9pt，与金额间距 11pt） */
const Arrow = () => (
	<svg width="7" height="12.5" viewBox="0 0 7 12.5" fill="none" className="ml-[11px] shrink-0" aria-hidden="true">
		<path d="M1 1l5 5.250L1 11.500" stroke="rgba(60,60,67,0.3)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);
const TAG = "ml-2 text-[13px] text-[#FA9D3B]";

const Wallet = () => {
	const navigate = useModeNavigate();
	const { balance, miniFund, miniFundYield, business } = useAtomValue(walletAtom);
	const { t } = useTranslation();
	const [editing, setEditing] = useState(false);
	const lp = useLongPress(() => setEditing(true), "editBalance");

	return (
		<>
			<div className="-mt-[1.7px] grid h-11 shrink-0 grid-cols-3 items-center bg-[#EDEDED] pr-[17.5px] pl-4">
				<BackFilledSVG
					fill="black"
					className="-ml-[7px] h-[22px] w-[22px] cursor-pointer"
					onClick={() => navigate("/wechat/service")}
				/>
				<div className="-translate-x-px flex items-center justify-center font-medium text-[17.2px]">
					{t("wechatPage.wallet.title")}
				</div>
				<div className="flex items-center justify-end text-[17px]">
					{t("wechatPage.wallet.transactions")}
				</div>
			</div>
			<div className="flex flex-1 flex-col overflow-auto bg-[#EDEDED]" {...lp}>
				{editing && <WalletSheet onClose={() => setEditing(false)} />}
				<List className="border-black/10 border-t">
					<List.CanBeDetectedItem
												rightClassName={ROW}
						icon={<CoinOutlinedSVG fill="#FFC300" />}
						onClick={() => navigate("/wechat/wallet/balance")}
						extra={<><span className={VALUE}>¥{balance}</span><Arrow /></>}
						metaData={{
							type: EMetaDataType.Wallet,
							treeItemDisplayName: (data) => `零钱余额：¥${data.balance}`,
						}}
					>
						{t("wechatPage.wallet.balance")}
					</List.CanBeDetectedItem>
					<List.CanBeDetectedItem
												rightClassName={ROW}
						icon={<BusinessIcon />}
						extra={<><span className={VALUE}>¥{business ?? "0.38"}</span><Arrow /></>}
						metaData={{
							type: EMetaDataType.Wallet,
							treeItemDisplayName: (data) => `经营账户：¥${data.business ?? "0.38"}`,
						}}
					>
						经营账户
					</List.CanBeDetectedItem>
					<List.CanBeDetectedItem
												rightClassName={ROW}
						icon={<DiamondIcon />}
						extra={<><span className={VALUE}>¥{miniFund}</span><Arrow /></>}
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
					<List.Item rightClassName={ROW} extra={<Arrow />} icon={<PayCardsOutlinedSVG fill="#2A7FCB" />}>
						{t("wechatPage.wallet.cards")}
					</List.Item>
					<List.Item
						rightClassName={ROW}
						extra={<Arrow />}
						icon={<KinCardIcon />}
					>
						{t("wechatPage.wallet.relativeCard")}
					</List.Item>
				</List>
				<List className="mt-[11px] border-black/10 border-y">
					<List.Item rightClassName={`${ROW} !min-h-[56px]`} extra={<Arrow />} icon={<FenfuIcon />}>
						<span className="flex items-center">
							分付
							<span className="ml-2 text-[14px] text-[#FA9D3B]">查看可用额度</span>
						</span>
					</List.Item>
				</List>
				<List className="mt-[11px] border-black/10 border-y">
					<List.Item rightClassName={ROW} extra={<Arrow />} icon={<ScoreIcon />}>
						{t("wechatPage.wallet.payScore")}
					</List.Item>
					<List.Item rightClassName={ROW} extra={<Arrow />} icon={<GearIcon />}>
						支付设置
					</List.Item>
					<List.Item rightClassName={ROW} extra={<Arrow />} icon={<IdCardIcon />}>
						{t("wechatPage.wallet.idInfo")}
					</List.Item>
					<List.Item rightClassName={ROW} extra={<Arrow />} icon={<ServiceCenterIcon />}>
						客服中心
					</List.Item>
				</List>
			</div>
		</>
	);
};

export default Wallet;
