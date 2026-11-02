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
			blockClassName="w-[276px] max-w-[82vw]"
			innerBlockClassName={twJoin(
				"w-full rounded px-2 pt-1.5 pb-0.5",
				redPacketStatus === "awaiting" && "bg-wechatOrange-3 before:bg-wechatOrange-3",
				(redPacketStatus === "accepted" || redPacketStatus === "expired") &&
					"bg-wechatOrange-5 before:bg-wechatOrange-5",
			)}
		>
			<div className="flex flex-col pl-1 text-white">
				<div className="flex flex-1 items-center border-white/10 border-b pb-1">
					<img src={IMAGE_MAP[redPacketStatus]} className="h-8 w-8 shrink-0 object-contain" />
					<div className="ml-2 flex min-h-8 flex-1 flex-col justify-center overflow-hidden">
						<div className="line-clamp-1 font-medium">
							{isEmpty(note) ? "恭喜发财，大吉大利" : note}
						</div>
						{showTips && <div className="font-light text-xs">{tips}</div>}
					</div>
				</div>
				<span className="pt-0.5 font-light text-xs">微信红包</span>
			</div>
		</CommonBlock>
	);
};

export default memo(RedPacket);
