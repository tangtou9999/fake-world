import ADD_OUTLINED_SVG from "@/assets/add-outlined.svg?react";
import ALBUM_OUTLINED_SVG from "@/assets/album-outlined.svg?react";
import ARROW_OUTLINED_SVG from "@/assets/arrow-outlined.svg?react";
import CARDS_SVG from "@/assets/cards.svg?react";
import FAVORITES_SVG from "@/assets/favorites.svg?react";
import PAYLOGO_OUTLINED_SVG from "@/assets/paylogo-outlined.svg?react";
import QRCODE_OUTLINED_SVG from "@/assets/qrcode-outlined.svg?react";
import Setting_Outlined_SVG from "@/assets/setting-outlined.svg?react";
import StickerOutlinedSVG from "@/assets/sticker-outlined.svg?react";
import { h } from "@/components/HashAssets";
import { canBeDetected } from "@/components/NodeDetected";
import useModeNavigate from "@/components/useModeNavigate";
import { EBottomNavBars } from "@/stateV2/bottomNavbars";
import { EMetaDataType } from "@/stateV2/detectedNode";
import { myProfileAtom } from "@/stateV2/profile";
import BottomNavbar, { useToggleNavbarActivated } from "@/wechatComponents/BottomNavbar";
import List from "@/wechatComponents/List";
import { mobilePanelAtom } from "@/components/MobilePanel/atom";
import { useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import CircularNotchSVG from "./assets/circular-notch.svg?react";

const My = () => {
	const { avatarInfo, wechat, nickname } = useAtomValue(myProfileAtom)!;
	const navigate = useModeNavigate();
	const { t } = useTranslation();
	const setMobilePanel = useSetAtom(mobilePanelAtom);
	useToggleNavbarActivated(EBottomNavBars.MY);

	return (
		<>
			<canBeDetected.div
				className="flex cursor-pointer items-start bg-white px-5 pt-4 pb-5"
				onClick={() => {
					navigate("/wechat/my/profile-edit");
				}}
				metaData={{
					type: EMetaDataType.MyProfile,
					treeItemDisplayName: (data) => `个人信息编辑（${data.nickname}）`,
				}}
			>
				<h.img src={avatarInfo} className="h-16 w-16 shrink-0 rounded-[6px] object-cover" />
				<div className="ml-4 min-w-0 flex-1">
					<div className="truncate font-medium text-[22px] text-black/90 leading-7">{nickname}</div>
					<div className="mt-1 text-[14px] text-black/55 leading-5">
						<span>{t("wechatPage.my.wid")}: </span>
						<span>{wechat}</span>
					</div>
					<div className="mt-2 flex items-center">
						<div className="flex h-6 items-center gap-0.5 rounded-full border border-black/10 px-2 text-[13px] text-black/60">
							<ADD_OUTLINED_SVG fill="rgba(0,0,0,0.55)" className="h-3 w-3" />
							<span>{t("wechatPage.my.status")}</span>
						</div>
						<div className="ml-2 flex h-6 w-6 items-center justify-center rounded-full border border-black/10">
							<CircularNotchSVG className="h-3.5 w-3.5" fill="#707070" />
						</div>
					</div>
				</div>
				<div className="mt-5 ml-2 flex shrink-0 items-center gap-2">
					<QRCODE_OUTLINED_SVG fill="rgba(0,0,0,0.55)" className="h-5 w-5" />
					<ARROW_OUTLINED_SVG fill="rgba(0,0,0,0.3)" className="h-3 w-3" />
				</div>
			</canBeDetected.div>
			<div className="flex-1 overflow-y-auto bg-[#EDEDED]">
				<List className="mt-2">
					<List.Item
						withJump
						icon={<PAYLOGO_OUTLINED_SVG fill="#07C160" />}
						onClick={() => navigate("/wechat/service")}
					>
						{t("wechatPage.my.services")}
					</List.Item>
				</List>
				<List className="mt-2">
					<List.Item withJump icon={<FAVORITES_SVG />}>
						{t("wechatPage.my.favorites")}
					</List.Item>
					<List.Item withJump icon={<ALBUM_OUTLINED_SVG fill="#2A7FCB" />}>
						{t("wechatPage.my.moments")}
					</List.Item>
					<List.Item withJump icon={<CARDS_SVG />}>
						{t("wechatPage.my.cards")}
					</List.Item>
					<List.Item withJump icon={<StickerOutlinedSVG fill="#F3C429" />}>
						{t("wechatPage.my.stickers")}
					</List.Item>
				</List>
				<List className="mt-2">
					<List.Item
						withJump
						icon={<Setting_Outlined_SVG fill="#2A7FCB" />}
						onClick={() => setMobilePanel("tools")}
					>
						{t("wechatPage.my.settings")}
					</List.Item>
				</List>
			</div>
			<BottomNavbar />
		</>
	);
};

export default My;
