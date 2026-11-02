import { css } from "@emotion/react";
import { memo } from "react";
import { useTranslation } from "react-i18next";

import List from "@/wechatComponents/List";

import GroupChatIMG from "./assets/group-chat.png";
import NewIMG from "./assets/new.png";
import OfficialIMG from "./assets/official.png";
import OnlyChatIMG from "./assets/only-chat.png";
import TagIMG from "./assets/tag.png";

const TopMenus = () => {
	const { t } = useTranslation();

	return (
		<List className="relative after:absolute after:right-0 after:bottom-0 after:left-0 after:h-[1px] after:origin-top-left after:scale-y-50 after:border-black/10 after:border-t">
			<List.Item
				textPrevClassName="ml-4"
				textPrev={
					<div
						className="mr-3 h-10 w-10 rounded bg-cover bg-repeat-round"
						css={css`
              background-image: url(${NewIMG});
            `}
					/>
				}
			>
				{t("wechatPage.contacts.new")}
			</List.Item>
			<List.Item
				textPrevClassName="ml-4"
				textPrev={
					<div
						className="mr-3 h-10 w-10 rounded bg-cover bg-repeat-round"
						css={css`
              background-image: url(${OnlyChatIMG});
            `}
					/>
				}
			>
				{t("wechatPage.contacts.chatsOnly")}
			</List.Item>
			<List.Item
				textPrevClassName="ml-4"
				textPrev={
					<div
						className="mr-3 h-10 w-10 rounded bg-cover bg-repeat-round"
						css={css`
              background-image: url(${GroupChatIMG});
            `}
					/>
				}
			>
				{t("wechatPage.contacts.group")}
			</List.Item>
			<List.Item
				textPrevClassName="ml-4"
				textPrev={
					<div
						className="mr-3 h-10 w-10 rounded bg-cover bg-repeat-round"
						css={css`
              background-image: url(${TagIMG});
            `}
					/>
				}
			>
				{t("wechatPage.contacts.tags")}
			</List.Item>
			<List.Item
				textPrevClassName="ml-4"
				textPrev={
					<div
						className="mr-3 h-10 w-10 rounded bg-cover bg-repeat-round"
						css={css`
              background-image: url(${OfficialIMG});
            `}
					/>
				}
			>
				{t("wechatPage.contacts.official")}
			</List.Item>
			<List.Item textPrevClassName="ml-4" textPrev={<div className="mr-3 flex h-10 w-10 items-center justify-center rounded bg-[#18b8e8] text-white"><svg viewBox="0 0 36 36" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 10h10l5 8-5 8H5l5-8zM21 10h10l-5 8 5 8H21l5-8z"/></svg></div>}>服务号</List.Item>
			<List.Item textPrevClassName="ml-4" textPrev={<div className="mr-3 flex h-10 w-10 items-center justify-center rounded bg-[#2888d9] text-white"><svg viewBox="0 0 36 36" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 8h19a6 6 0 0 1 6 6v6a6 6 0 0 1-6 6h-7l-7 5v-5H5a4 4 0 0 1-4-4v-10a4 4 0 0 1 4-4z"/><circle cx="12" cy="17" r="1" fill="currentColor"/><circle cx="18" cy="17" r="1" fill="currentColor"/><circle cx="24" cy="17" r="1" fill="currentColor"/></svg></div>}>企业微信联系人</List.Item>
		</List>
	);
};

export default memo(TopMenus);
