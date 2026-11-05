import { css } from "@emotion/react";
import { friendRequestsAtom } from "@/stateV2/friendRequests";
import { useAtomValue } from "jotai";
import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import List from "@/wechatComponents/List";

import { OfficialIcon, ServiceIcon, WecomIcon } from "./ContactIcons";
import GroupChatIMG from "./assets/group-chat.png";
import NewIMG from "./assets/new.png";
import OnlyChatIMG from "./assets/only-chat.png";
import TagIMG from "./assets/tag.png";

const iconClass = "mr-3 h-10 w-10 shrink-0 rounded";

const TopMenus = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const pending = useAtomValue(friendRequestsAtom).filter((v) => v.direction === "in" && v.status === "pending").length;

	const imageIcon = (src: string) => (
		<div
			className={`${iconClass} bg-cover bg-repeat-round`}
			css={css`
				background-image: url(${src});
			`}
		/>
	);

	return (
		<List className="relative after:absolute after:right-0 after:bottom-0 after:left-0 after:h-px after:origin-bottom after:scale-y-50 after:bg-black/10">
			<List.Item
				textPrevClassName="ml-4"
				textPrev={imageIcon(NewIMG)}
				onClick={() => navigate("/wechat/new-friends")}
				extra={
					pending > 0 ? (
						<span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FA5151] px-1 text-[12px] text-white">
							{pending}
						</span>
					) : undefined
				}
			>
				{t("wechatPage.contacts.new")}
			</List.Item>
			<List.Item textPrevClassName="ml-4" textPrev={imageIcon(OnlyChatIMG)}>
				{t("wechatPage.contacts.chatsOnly")}
			</List.Item>
			<List.Item textPrevClassName="ml-4" textPrev={imageIcon(GroupChatIMG)}>
				{t("wechatPage.contacts.group")}
			</List.Item>
			<List.Item textPrevClassName="ml-4" textPrev={imageIcon(TagIMG)}>
				{t("wechatPage.contacts.tags")}
			</List.Item>
			<List.Item textPrevClassName="ml-4" textPrev={<OfficialIcon className={iconClass} />}>
				{t("wechatPage.contacts.official")}
			</List.Item>
			<List.Item textPrevClassName="ml-4" textPrev={<ServiceIcon className={iconClass} />}>
				{t("wechatPage.contacts.serviceAccount")}
			</List.Item>
			<List.Item textPrevClassName="ml-4" textPrev={<WecomIcon className={iconClass} />}>
				{t("wechatPage.contacts.wecom")}
			</List.Item>
		</List>
	);
};

export default memo(TopMenus);
