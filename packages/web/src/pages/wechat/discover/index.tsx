import FloatWindowOnOutlinedSVG from "@/assets/float-window-on-outlined.svg?react";
import GamesSVG from "@/assets/games.svg?react";
import MiniProgramOutlinedSVG from "@/assets/mini-program-2-outlined.svg?react";
import MomentSVG from "@/assets/moment.svg?react";
import NewsOutlinedSVG from "@/assets/news-outlined.svg?react";
import ScanOutlinedSVG from "@/assets/scan-outlined.svg?react";
import SearchLogoOutlinedSVG from "@/assets/search-logo-outlined.svg?react";
import useModeNavigate from "@/components/useModeNavigate";
import { EBottomNavBars } from "@/stateV2/bottomNavbars";
import BottomNavbar, { useToggleNavbarActivated } from "@/wechatComponents/BottomNavbar";
import List from "@/wechatComponents/List";
import { useTranslation } from "react-i18next";
import FjSVG from "./assets/fj.svg?react";
import ListenSVG from "./assets/listen.svg?react";
import SphSVG from "./assets/sph.svg?react";

const Discover = () => {
	const navigate = useModeNavigate();
	const { t } = useTranslation();
	useToggleNavbarActivated(EBottomNavBars.DISCOVER);

	return (
		<>
			<div className="flex h-11 shrink-0 items-center justify-center bg-[#EDEDED] font-medium text-[17px] text-black/90">
				{t("wechatPage.discover.title")}
			</div>
			<div className="flex flex-1 flex-col overflow-y-auto bg-[#EDEDED]">
				<List>
					<List.Item withJump icon={<MomentSVG />} onClick={() => navigate("/wechat/moments")}>
						{t("wechatPage.discover.moments")}
					</List.Item>
				</List>
				<List className="mt-2">
					<List.Item withJump icon={<SphSVG fill="#F79D3D" />}>
						{t("wechatPage.discover.channels")}
					</List.Item>
					<List.Item withJump icon={<FloatWindowOnOutlinedSVG fill="#D56F68" />}>
						{t("wechatPage.discover.live")}
					</List.Item>
				</List>
				<List className="mt-2">
					<List.Item withJump icon={<ScanOutlinedSVG fill="#2A7FCB" />}>
						{t("wechatPage.discover.scan")}
					</List.Item>
					<List.Item withJump icon={<ListenSVG />}>
						{t("wechatPage.discover.listen")}
					</List.Item>
				</List>
				<List className="mt-2">
					<List.Item withJump icon={<NewsOutlinedSVG fill="#FAB93F" />}>
						{t("wechatPage.discover.topStories")}
					</List.Item>
					<List.Item withJump icon={<SearchLogoOutlinedSVG fill="#F35967" />}>
						{t("wechatPage.discover.search")}
					</List.Item>
				</List>
				<List className="mt-2">
					<List.Item withJump icon={<FjSVG fill="#4383D3" />}>
						{t("wechatPage.discover.nearby")}
					</List.Item>
				</List>
				<List className="mt-2">
					<List.Item withJump icon={<GamesSVG />}>{t("wechatPage.discover.games")}</List.Item>
				</List>
				<List className="mt-2">
					<List.Item withJump icon={<MiniProgramOutlinedSVG fill="#6B66C3" />}>
						{t("wechatPage.discover.mp")}
					</List.Item>
				</List>
			</div>
			<BottomNavbar />
		</>
	);
};

export default Discover;
