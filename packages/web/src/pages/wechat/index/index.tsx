import PlusCircleSVG from "@/assets/plus-circle.svg?react";
import { canBeDetected } from "@/components/NodeDetected";
import { EBottomNavBars } from "@/stateV2/bottomNavbars";
import { EMetaDataType } from "@/stateV2/detectedNode";
import { unreadCountAtom, unreadCountEffect } from "@/stateV2/unreadCount";
import BottomNavbar, { useToggleNavbarActivated } from "@/wechatComponents/BottomNavbar";
import SearchBar from "@/wechatComponents/SearchBar";
import { useAtom, useAtomValue } from "jotai";
import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import DialogueList from "./DialogueList";
import MultipleDeviceLogin from "./MultipleDeviceLogin";

/** 记住消息列表滚到哪了：进聊天再返回，还在原来的位置 */
let savedHomeScroll = 0;

const WechatIndex = () => {
	const scrollRef = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		if (scrollRef.current) scrollRef.current.scrollTop = savedHomeScroll;
	}, []);
	const { count } = useAtomValue(unreadCountAtom);
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [menuOpen, setMenuOpen] = useState(false);
	useToggleNavbarActivated(EBottomNavBars.WECHAT);
	useAtom(unreadCountEffect);

	return (
		<>
			<div className="grid h-11 shrink-0 grid-cols-3 items-center bg-[#EDEDED] px-4">
				<div className="flex items-center gap-[3px] pl-[6px]">
					<i className="h-[7.5px] w-[6px] rounded-full bg-[#474E63]" />
					<i className="h-[7.5px] w-[6px] rounded-full bg-[#474E63]" />
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
					<button type="button" aria-label="更多" className="bg-transparent p-0" onClick={() => setMenuOpen((v) => !v)}>
						<PlusCircleSVG width={20} height={20} fill="black" className="mr-[2px] cursor-pointer" />
					</button>
				</div>
			</div>
			<div
				ref={scrollRef}
				onScroll={(e) => {
					savedHomeScroll = e.currentTarget.scrollTop;
				}}
				className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-x-none bg-white"
			>
				<SearchBar />
				<MultipleDeviceLogin />
				<DialogueList />
			</div>
			{menuOpen && (
				<div className="fixed inset-0 z-50" onClick={() => setMenuOpen(false)}>
					<div
						className="absolute right-3 rounded-[6px] bg-[#4C4C4C] py-1 text-white shadow-lg"
						style={{ top: "calc(max(0px, env(safe-area-inset-top) - 5px) + 48px)" }}
					>
						<div className="absolute -top-[6px] right-[14px] h-3 w-3 rotate-45 bg-[#4C4C4C]" />
						{(
							[
								["发起群聊", "/wechat/group/new"],
								["添加朋友", "/wechat/add-friend"],
								["扫一扫", "/wechat/scan-pay"],
								["收付款", "/wechat/scan-pay"],
							] as const
						).map(([label, to]) => (
							<div
								key={label}
								className="relative flex h-[52px] w-[150px] items-center px-5 text-[16px]"
								onClick={() => to && navigate(to)}
							>
								{label}
							</div>
						))}
					</div>
				</div>
			)}
			<BottomNavbar />
		</>
	);
};

export default WechatIndex;
