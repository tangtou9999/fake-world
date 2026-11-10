import { MYSELF_ID } from "@/faker/wechat/user";
import { EConversationType, type TConversationItem } from "@/stateV2/conversation";
import { normalizeUpperText } from "@/stateV2/conversation/helpers";
import { groupDefaultSender } from "@/stateV2/group";
import { memo } from "react";
import { useParams } from "react-router-dom";
import CenterText from "./CenterText";
import Image from "./Image";
import PersonalCard from "./PersonalCard";
import CallRecord from "./Call";
import RedPacket from "./RedPacket";
import RedPacketAcceptedReply from "./RedPacketAcceptedReply";
import Text from "./Text";
import Transfer from "./Transfer";
import TransferReceipt from "./TransferReceipt";
import Voice from "./Voice";

type Props = {
	data: TConversationItem;
};

const ConversationItem = ({ data }: Props) => {
	const { type, role, id: conversationItemId } = data;
	const upperText = normalizeUpperText(data.upperText, data.sendTimestamp);
	const { id } = useParams<{ id: string }>();
	const senderId = role === "friend" ? ((data as { senderId?: string }).senderId ?? groupDefaultSender(id!) ?? id!) : MYSELF_ID;

	switch (type) {
		case EConversationType.text:
			return (
				<Text
					conversationItemId={conversationItemId}
					upperText={upperText}
					senderId={senderId}
					textContent={data.textContent}
					translation={data.translation}
					referenceId={data.referenceId}
				/>
			);
		case EConversationType.centerText:
			return (
				<CenterText
					upperText={upperText}
					simpleContent={data.simpleContent}
					extraClassName={data.extraClassName}
				/>
			);
		case EConversationType.transfer:
			return (
				<Transfer
					role={role}
					upperText={upperText}
					senderId={senderId}
					amount={data.amount}
					note={data.note}
					transferStatus={data.transferStatus}
					originalSender={data.originalSender}
					transferTo={data.transferTo}
				/>
			);
		case EConversationType.transferReceipt:
			return (
				<TransferReceipt
					upperText={upperText}
					receiver={data.receiver}
					receiverId={data.receiverId}
					amount={data.amount}
				/>
			);
		case EConversationType.call:
			return (
				<CallRecord
					role={role}
					upperText={upperText}
					senderId={senderId}
					callStatus={data.callStatus}
					seconds={data.seconds}
				/>
			);
		case EConversationType.redPacket:
			return (
				<RedPacket
					role={role}
					upperText={upperText}
					senderId={senderId}
					amount={data.amount}
					note={data.note}
					redPacketStatus={data.redPacketStatus}
					originalSender={data.originalSender}
				/>
			);
		case EConversationType.image:
			return (
				<Image role={role} imageInfo={data.imageInfo} upperText={upperText} senderId={senderId} />
			);
		case EConversationType.video:
			return (
				<Image
					role={role}
					imageInfo={data.videoInfo}
					videoFile={data.videoFile}
					duration={data.duration}
					upperText={upperText}
					senderId={senderId}
					isVideo
				/>
			);
		case EConversationType.voice:
			return (
				<Voice
					id={data.id}
					senderId={senderId}
					upperText={upperText}
					duration={data.duration}
					isRead={data.isRead}
					role={role}
					showStt={data.showStt}
					stt={data.stt}
				/>
			);
		case EConversationType.redPacketAcceptedReply:
			return (
				<RedPacketAcceptedReply redPacketId={data.redPacketId} upperText={upperText} claimerId={data.claimerId} receiver={data.receiver} />
			);
		case EConversationType.personalCard:
			return (
				<PersonalCard
					avatarInfo={data.avatarInfo}
					nickname={data.nickname}
					senderId={senderId}
					upperText={upperText}
				/>
			);
		default:
			return null;
	}
};

export default memo(ConversationItem);
