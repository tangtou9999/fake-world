import { css } from "@emotion/react";
import { memo } from "react";
import { useTranslation } from "react-i18next";

import List from "@/wechatComponents/List";

import GroupChatIMG from "./assets/group-chat.png";
import NewIMG from "./assets/new.png";
import OfficialIMG from "./assets/official.png";
import OnlyChatIMG from "./assets/only-chat.png";
import ServiceSVG from "./assets/service.svg?react";
import TagIMG from "./assets/tag.png";
import WecomSVG from "./assets/wecom.svg?react";

const iconClass = "mr-3 h-10 w-10 shrink-0 rounded";

const TopMenus = () => {
	const { t } = useTranslation();

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
			<List.Item textPrevClassName="ml-4" textPrev={imageIcon(NewIMG)}>
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
			<List.Item textPrevClassName="ml-4" textPrev={imageIcon(OfficialIMG)}>
				{t("wechatPage.contacts.official")}
			</List.Item>
			<List.Item textPrevClassName="ml-4" textPrev={<ServiceSVG className={iconClass} />}>
				{t("wechatPage.contacts.serviceAccount")}
			</List.Item>
			<List.Item textPrevClassName="ml-4" textPrev={<WecomSVG className={iconClass} />}>
				{t("wechatPage.contacts.wecom")}
			</List.Item>
		</List>
	);
};

export default memo(TopMenus);
