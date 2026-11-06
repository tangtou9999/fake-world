import type { IConversationTypeText } from "@/stateV2/conversation";
import type { IStateProfile } from "@/stateV2/profile";
import SlateText from "@/wechatComponents/SlateText";
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

const Text = ({ upperText, senderId, textContent, referenceId, conversationItemId, translation }: Props) => {
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
