import PlusCircleSVG from "@/assets/plus-circle.svg?react";
import { canBeDetected } from "@/components/NodeDetected";
import { EBottomNavBars } from "@/stateV2/bottomNavbars";
import { EMetaDataType } from "@/stateV2/detectedNode";
import { unreadCountAtom, unreadCountEffect } from "@/stateV2/unreadCount";
import BottomNavbar, { useToggleNavbarActivated } from "@/wechatComponents/BottomNavbar";
import SearchBar from "@/wechatComponents/SearchBar";
import { useAtom, useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import DialogueList from "./DialogueList";
import MultipleDeviceLogin from "./MultipleDeviceLogin";

const WechatIndex = () => {
	const { count } = useAtomValue(unreadCountAtom);
	const { t } = useTranslation();
	useToggleNavbarActivated(EBottomNavBars.WECHAT);
	useAtom(unreadCountEffect);

	return (
		<>
			<div className="grid h-11 shrink-0 grid-cols-3 items-center bg-[#EDEDED] px-4">
				<div className="flex items-center gap-1">
					<i className="h-2 w-2 rounded-full bg-black/85" />
					<i className="h-2 w-2 rounded-full bg-black/85" />
				</div>
				<canBeDetected.span
					className="flex items-center justify-center font-medium text-[17px] text-black/90"
					metaData={{
						type: EMetaDataType.UnreadCount,
						treeItemDisplayName: (d) => `顶栏 ${d.count} 个未读消息`,
					}}
				>
					{count > 0
						? t("wechatPage.main.title", {
								totalUnreadCount: count,
							})
						: t("wechatPage.main.title2")}
				</canBeDetected.span>
				<div className="flex items-center justify-end">
					<PlusCircleSVG width={24} height={24} fill="black" className="cursor-pointer" />
				</div>
			</div>
			<div className="flex flex-1 flex-col overflow-y-auto bg-white">
				<SearchBar />
				<MultipleDeviceLogin />
				<DialogueList />
			</div>
			<BottomNavbar />
		</>
	);
};

export default WechatIndex;
