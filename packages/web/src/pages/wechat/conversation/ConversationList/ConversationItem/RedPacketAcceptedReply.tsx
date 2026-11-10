import RedPacketCloseIMG from "@/assets/red-packet-close.png";
import {
	type IConversationTypeRedPacket,
	type IConversationTypeRedPacketAcceptedReply,
	conversationListAtom,
} from "@/stateV2/conversation";
import UserName from "@/wechatComponents/User/UserName";
import { useAtom } from "jotai";
import { memo } from "react";
import { groupDefaultSender, isGroupId } from "@/stateV2/group";
import { useConversationAPI } from "../../context";

type Props = {
	redPacketId: IConversationTypeRedPacketAcceptedReply["redPacketId"];
	upperText: IConversationTypeRedPacketAcceptedReply["upperText"];
	claimerId?: string;
	receiver?: IConversationTypeRedPacketAcceptedReply["receiver"];
};

const RedPacketAcceptedReply = ({ redPacketId, upperText, claimerId, receiver }: Props) => {
	const { conversationId } = useConversationAPI();
	const [conversationList] = useAtom(conversationListAtom(conversationId));
	const redPacket = conversationList.find((v) => v.id === redPacketId) as IConversationTypeRedPacket | undefined;

	// 收款记录单独存在：发起那条被删了也不要把这条清掉
	const peerId = isGroupId(conversationId)
		? ((redPacket as { senderId?: string } | undefined)?.senderId ?? groupDefaultSender(conversationId) ?? conversationId)
		: conversationId;
	const who = receiver ?? (redPacket ? (redPacket.originalSender === "friend" ? "mine" : "friend") : undefined);
	const left = claimerId ? (
		<UserName id={claimerId} className="text-black/50" />
	) : who === "mine" ? (
		"你"
	) : who === "friend" ? (
		<UserName id={peerId} className="text-black/50" />
	) : (
		"有人"
	);
	const right =
		claimerId && claimerId === peerId
			? "自己"
			: redPacket
				? redPacket.originalSender === "friend"
					? <UserName id={peerId} className="text-black/50" />
					: "你"
				: who === "mine"
					? <UserName id={peerId} className="text-black/50" />
					: "你";

	return (
		<>
			{upperText && <div className={"m-auto mt-2 mb-[17px] text-[14px] leading-5 text-black/50"}>{upperText}</div>}
			<div className="m-auto flex items-center text-black/50 text-xs">
				<img src={RedPacketCloseIMG} className="w-4" />
				<div className="ml-2">
					{left}
					<span>领取了</span>
					{right}的<span className="text-wechatOrange-3">红包</span>
				</div>
			</div>
		</>
	);
};

export default memo(RedPacketAcceptedReply);
