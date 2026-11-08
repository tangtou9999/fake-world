import type { IConversationTypeText } from "@/stateV2/conversation";
import type { IStateProfile } from "@/stateV2/profile";
import SlateText from "@/wechatComponents/SlateText";
import { slateToPlain } from "@/wechatComponents/SlateText/emojiNames";
import { MYSELF_ID } from "@/faker/wechat/user";
import { memo } from "react";
import CommonBlock from "./CommonBlock";
import TextReference from "./TextReference";

type Props = {
	conversationItemId: IConversationTypeText["id"];
	upperText: IConversationTypeText["upperText"];
	senderId: IStateProfile["id"];
	textContent: IConversationTypeText["textContent"];
	referenceId: IConversationTypeText["referenceId"];
	translation?: IConversationTypeText["translation"];
};

/** 视频通话记录：小摄像机图标 + 文字；我发起的图标在右、对方来电的图标在左 */
const CallIcon = ({ mirror }: { mirror?: boolean }) => (
	<svg width="21" height="15" viewBox="0 0 21 15" fill="none" aria-hidden="true" className="shrink-0" style={mirror ? { transform: "scaleX(-1)" } : undefined}>
		<rect x="1" y="1.5" width="13" height="12" rx="2.2" stroke="#1A1A1A" strokeWidth="1.6" />
		<path d="M15.5 6.2 19.6 3.6v7.8l-4.1-2.6" stroke="#1A1A1A" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
	</svg>
);

const Text = ({ upperText, senderId, textContent, referenceId, conversationItemId, translation }: Props) => {
	const plain = textContent.map((n) => slateToPlain(n as never)).join("");
	if (plain.startsWith("📹 ")) {
		const label = plain.slice(3);
		const mine = senderId === MYSELF_ID;
		return (
			<CommonBlock
				upperText={upperText}
				senderId={senderId}
				innerBlockClassName="group-[.friend]:bg-white group-[.mine]:bg-[#8CE97F] group-[.friend]:before:bg-white group-[.mine]:before:bg-[#8CE97F]"
			>
				<span className="flex items-center gap-3 whitespace-nowrap">
					{!mine && <CallIcon />}
					<span>{label}</span>
					{mine && <CallIcon mirror />}
				</span>
			</CommonBlock>
		);
	}
	return (
		<>
			<CommonBlock
				upperText={upperText}
				senderId={senderId}
				innerBlockClassName="group-[.friend]:bg-white group-[.mine]:bg-[#8CE97F] group-[.friend]:before:bg-white group-[.mine]:before:bg-[#8CE97F]"
			>
				<SlateText content={textContent} />
			</CommonBlock>
			{translation && (
				<div
					className="max-w-[78%] rounded-[6px] bg-white px-3 py-[10px] group-[.friend]:mr-auto group-[.friend]:ml-[52px] group-[.mine]:mr-[52px] group-[.mine]:ml-auto"
					style={{ marginTop: 4 }}
				>
					<div className="whitespace-pre-wrap break-words text-[16px] leading-[22px] text-black/90">{translation}</div>
					<div className="mt-2 flex items-center gap-1 text-[12px] text-black/40">
						<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
							<path d="M2 6.3l2.6 2.6L10 3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
						由微信提供翻译支持
					</div>
				</div>
			)}
			{referenceId && (
				<TextReference referenceId={referenceId} conversationItemId={conversationItemId} />
			)}
		</>
	);
};

export default memo(Text);
