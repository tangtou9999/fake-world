import RedPacketCloseIMG from "@/assets/red-packet-close.png";
import RedPacketOpenIMG from "@/assets/red-packet-open.png";
import type { IConversationTypeRedPacket } from "@/stateV2/conversation";
import type { IStateProfile } from "@/stateV2/profile";
import { get, isEmpty } from "lodash-es";
import { memo } from "react";
import { twJoin } from "tailwind-merge";
import { RED_PACKET_TEXT_NOTE_MAP } from "../consts";
import CommonBlock from "./CommonBlock";

type Props = {
	role: IConversationTypeRedPacket["role"];
	upperText: IConversationTypeRedPacket["upperText"];
	senderId: IStateProfile["id"];
	redPacketStatus: IConversationTypeRedPacket["redPacketStatus"];
	amount: IConversationTypeRedPacket["amount"];
	note: IConversationTypeRedPacket["note"];
	originalSender: IConversationTypeRedPacket["originalSender"];
};

const IMAGE_MAP: Record<IConversationTypeRedPacket["redPacketStatus"], string> = {
	awaiting: RedPacketCloseIMG,
	accepted: RedPacketOpenIMG,
	expired: RedPacketCloseIMG,
};

const RedPacket = ({ role, upperText, senderId, redPacketStatus, note, originalSender }: Props) => {
	const tips = get(RED_PACKET_TEXT_NOTE_MAP, [originalSender, role, redPacketStatus], "");

	const showTips = !isEmpty(tips);

	return (
		<CommonBlock
			upperText={upperText}
			senderId={senderId}
			blockClassName="w-auto max-w-none"
			innerBlockClassName={twJoin(
				"h-[83px] w-[243px] max-w-none rounded-[6px] p-0",
				redPacketStatus === "awaiting" && "bg-wechatOrange-3 before:bg-wechatOrange-3",
				(redPacketStatus === "accepted" || redPacketStatus === "expired") &&
					"bg-[#FACE9C] before:bg-[#FACE9C]",
			)}
		>
			<div className="relative h-full text-white">
				<div className="flex items-start px-[13px] pt-[10px]">
					<img src={IMAGE_MAP[redPacketStatus]} className="h-9 w-9 shrink-0 object-contain" />
					<div className="ml-[10px] flex h-9 min-w-0 flex-1 flex-col justify-center overflow-hidden">
						<div className="line-clamp-1 font-medium text-[17px] leading-[22px]">
							{isEmpty(note) ? "恭喜发财，大吉大利" : note}
						</div>
						{showTips && <div className="font-light text-xs">{tips}</div>}
					</div>
				</div>
				<span className="absolute bottom-[10px] left-[10px] text-[11px] text-white/80 leading-[14px]">
					红包
				</span>
			</div>
		</CommonBlock>
	);
};

export default memo(RedPacket);
