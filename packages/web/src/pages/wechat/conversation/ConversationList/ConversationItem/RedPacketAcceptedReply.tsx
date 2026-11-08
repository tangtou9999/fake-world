import RedPacketCloseIMG from "@/assets/red-packet-close.png";
import {
	type IConversationTypeRedPacket,
	type IConversationTypeRedPacketAcceptedReply,
	conversationListAtom,
} from "@/stateV2/conversation";
import { groupDefaultSender, isGroupId } from "@/stateV2/group";
import UserName from "@/wechatComponents/User/UserName";
import { useAtom } from "jotai";
import { memo } from "react";
import { useConversationAPI } from "../../context";

type Props = {
	redPacketId: IConversationTypeRedPacketAcceptedReply["redPacketId"];
	upperText: IConversationTypeRedPacketAcceptedReply["upperText"];
	id: IConversationTypeRedPacketAcceptedReply["id"];
};

const RedPacketAcceptedReply = ({ redPacketId, upperText, id }: Props) => {
	const { conversationId } = useConversationAPI();
	const [conversationList, setConversationList] = useAtom(conversationListAtom(conversationId));
	const redPacket = conversationList.find((v) => v.id === redPacketId);

	if (!redPacket) {
		setConversationList((prev) => prev.filter((v) => v.id !== id));
		return null;
	}

	const { originalSender } = redPacket as IConversationTypeRedPacket;
	// 群聊里「对方」是发红包的那位成员，不是群本身（群没有个人资料，直接用会崩溃）
	const peerId = isGroupId(conversationId)
		? ((redPacket as { senderId?: string }).senderId ?? groupDefaultSender(conversationId) ?? conversationId)
		: conversationId;
	const left =
		originalSender === "friend" ? "你" : <UserName id={peerId} className="text-black/50" />;
	const right =
		originalSender === "friend" ? <UserName id={peerId} className="text-black/50" /> : "你";

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
