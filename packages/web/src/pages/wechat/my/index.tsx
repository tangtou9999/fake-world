import ADD_OUTLINED_SVG from "@/assets/add-outlined.svg?react";
import ALBUM_OUTLINED_SVG from "@/assets/album-outlined.svg?react";
import FAVORITES_SVG from "@/assets/favorites.svg?react";
import PAYLOGO_OUTLINED_SVG from "@/assets/paylogo-outlined.svg?react";
import QRCODE_OUTLINED_SVG from "@/assets/qrcode-outlined.svg?react";
import Setting_Outlined_SVG from "@/assets/setting-outlined.svg?react";
import StickerOutlinedSVG from "@/assets/sticker-outlined.svg?react";
import { h } from "@/components/HashAssets";
import { canBeDetected } from "@/components/NodeDetected";
import useModeNavigate from "@/components/useModeNavigate";
import useScreenTopBg from "@/components/useScreenTopBg";
import { EBottomNavBars } from "@/stateV2/bottomNavbars";
import { EMetaDataType } from "@/stateV2/detectedNode";
import { dialogueListAtom } from "@/stateV2/dialogueList";
import { myProfileAtom, profileAtom } from "@/stateV2/profile";
import BottomNavbar, { useToggleNavbarActivated } from "@/wechatComponents/BottomNavbar";
import List, { Chevron } from "@/wechatComponents/List";
import { mobilePanelAtom } from "@/components/MobilePanel/atom";
import useMode from "@/components/useMode";
import { message } from "antd";
import { useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";

const WorksIcon = () => (
	<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<rect x="9.5" y="2.5" width="11.5" height="11.5" rx="2.3" fill="#FFD7A6" />
		<rect x="7" y="5" width="11.5" height="11.5" rx="2.3" fill="#C6E6FF" />
		<rect x="3.2" y="8.2" width="12" height="12" rx="2.3" fill="#fff" stroke="#36B0F4" strokeWidth="1.7" />
	</svg>
);

const ShopIcon = () => (
	<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<path d="M4 9.5 5.6 4h12.8L20 9.5" stroke="#F0735F" strokeWidth="1.6" strokeLinejoin="round" />
		<path
			d="M4 9.5c0 1.7 1.3 3 2.7 3s2.6-1.3 2.6-3c0 1.7 1.3 3 2.7 3s2.6-1.3 2.6-3c0 1.7 1.3 3 2.7 3S20 11.2 20 9.5"
			stroke="#F0735F"
			strokeWidth="1.6"
		/>
		<path d="M5.5 12.5V20h13v-7.5" stroke="#F0735F" strokeWidth="1.6" strokeLinejoin="round" />
	</svg>
);

const FriendDot = ({ id }: { id: string }) => {
	const profile = useAtomValue(profileAtom(id));
	if (!profile) return null;
	return (
		<h.img
			src={profile.avatarInfo}
			className="-ml-1 h-4 w-4 rounded-full border border-white object-cover first:ml-0"
		/>
	);
};

const My = () => {
	const { avatarInfo, wechat, nickname } = useAtomValue(myProfileAtom)!;
	const navigate = useModeNavigate();
	const { t } = useTranslation();
	const setMobilePanel = useSetAtom(mobilePanelAtom);
	const { setMode } = useMode();
	const friendIds = useAtomValue(dialogueListAtom)
		.slice(0, 3)
		.map((v) => v.friendId);
	useToggleNavbarActivated(EBottomNavBars.MY);
	useScreenTopBg("#fff");

	return (
		<>
			<canBeDetected.div
				className="flex cursor-pointer items-start bg-white pt-[66px] pr-4 pb-[32px] pl-[27px]"
				onClick={() => {
					navigate("/wechat/my/profile-edit");
				}}
				metaData={{
					type: EMetaDataType.MyProfile,
					treeItemDisplayName: (data) => `个人信息编辑（${data.nickname}）`,
				}}
			>
				<h.img src={avatarInfo} className="h-16 w-16 shrink-0 rounded-[6px] object-cover" />
				<div className="ml-[18px] min-w-0 flex-1">
					<div className="truncate font-semibold text-[20px] text-black/90 leading-7">{nickname}</div>
					<div className="mt-1.5 text-[15px] text-black/50 leading-5">
						<span>{t("wechatPage.my.wid")}: </span>
						<span>{wechat}</span>
					</div>
					<div className="mt-2.5 flex items-center">
						<div className="flex h-[22px] items-center gap-0.5 rounded-full border border-black/10 px-2 text-[13px] text-black/60">
							<ADD_OUTLINED_SVG fill="rgba(0,0,0,0.55)" className="h-3 w-3" />
							<span>{t("wechatPage.my.status")}</span>
						</div>
						<div className="ml-2 flex h-[22px] items-center rounded-full border border-black/10 pr-2 pl-1.5 text-[13px] text-black/60">
							<span className="flex items-center">
								{friendIds.map((id) => (
									<FriendDot key={id} id={id} />
								))}
							</span>
							<span className="ml-1">{t("wechatPage.my.friendsStatus", { num: 12 })}</span>
							<i className="ml-1 h-1.5 w-1.5 rounded-full bg-[#FA5151]" />
						</div>
					</div>
				</div>
				<div className="mt-1 ml-2 flex shrink-0 flex-col items-end gap-[14px]">
					<QRCODE_OUTLINED_SVG fill="rgba(60,60,67,0.45)" className="mr-1 h-5 w-5" />
					<Chevron className="ml-0" />
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
					<List.Item withJump icon={<WorksIcon />}>
						{t("wechatPage.my.works")}
					</List.Item>
					<List.Item
						withJump
						icon={<ShopIcon />}
						extra={
							<>
								<span className="ml-3 text-right text-[12px] text-black/50 leading-[16px]">
									[官方补贴 700.1元]
									<br />
									小天鹅轻享洗衣机
								</span>
								<i className="ml-1.5 h-2 w-2 shrink-0 rounded-full bg-[#FA5151]" />
							</>
						}
					>
						{t("wechatPage.my.shopCards")}
					</List.Item>
					<List.Item withJump icon={<StickerOutlinedSVG fill="#F3C429" />}>
						{t("wechatPage.my.stickers")}
					</List.Item>
				</List>
				<List className="mt-2">
					<List.Item
						withJump
						icon={<Setting_Outlined_SVG fill="#2A7FCB" />}
						onClick={() => {
							setMobilePanel(null);
							setMode("edit");
							message.info("已进入编辑模式：点页面上任意内容就能修改", 2.5);
						}}
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
