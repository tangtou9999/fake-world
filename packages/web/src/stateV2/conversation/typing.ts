import type { Descendant } from "slate";

export enum EConversationType {
	text = "text",
	image = "image",
	video = "video",
	voice = "voice",
	centerText = "centerText",
	transfer = "transfer",
	redPacket = "redPacket",
	redPacketAcceptedReply = "redPacketAcceptedReply",
	personalCard = "personalCard",
}

export type TConversationRole = "mine" | "friend";

export interface IConversationItemBase {
	id: string;
	upperText?: string;
	sendTimestamp?: number;
	role: TConversationRole;
	/** 群聊里「对方」这条消息是谁发的（成员 id）；单聊不用 */
	senderId?: string;
}

export interface IConversationTypeText extends IConversationItemBase {
	type: EConversationType.text;
	textContent: Descendant[];
	/** 长按「翻译」后显示在气泡下方的译文 */
	translation?: string;
	referenceId?: IConversationItemBase["id"];
}

export interface IConversationTypeSingleUpperText extends IConversationItemBase {
	type: EConversationType.centerText;
	simpleContent: string;
	extraClassName?: string;
}

export interface IConversationTypeTransfer extends IConversationItemBase {
	type: EConversationType.transfer;
	originalSender: TConversationRole;
	transferStatus: "awaiting" | "accepted" | "rejected" | "expired";
	amount: string;
	note?: string;
	/** 群聊里这笔转账转给了哪位成员（成员 id） */
	transferTo?: string;
}

export interface IConversationTypeRedPacket extends IConversationItemBase {
	type: EConversationType.redPacket;
	originalSender: TConversationRole;
	redPacketStatus: "awaiting" | "accepted" | "expired";
	amount: string;
	note?: string;
}

export interface IConversationTypeRedPacketAcceptedReply extends IConversationItemBase {
	type: EConversationType.redPacketAcceptedReply;
	redPacketId: string;
	/** 群聊：领取红包的成员 id（没有则是「我」领取） */
	claimerId?: string;
}

export interface IConversationTypeImage extends IConversationItemBase {
	type: EConversationType.image;
	imageInfo: string;
}

export interface ICoversationTypeVideo extends IConversationItemBase {
	type: EConversationType.video;
	/** Poster / first-frame image hash. Legacy messages may only have this. */
	videoInfo: string;
	/** MD5 of the video file stored in IndexedDB. Absent on older poster-only messages. */
	videoFile?: string;
	/** Duration in seconds, when the file exposes it. */
	duration?: number;
}

export interface IConversationTypeVoice extends IConversationItemBase {
	type: EConversationType.voice;
	duration: number;
	isRead?: boolean;
	/** 是否显示语音转文字内容 */
	showStt?: boolean;
	/** 语音转文字内容 */
	stt?: string;
	/** 这条语音发生时的环境 / 语速 / 口气（AI 按剧情给的，播放时用） */
	scene?: string;
	pace?: string;
	tone?: string;
}

export interface IConversationTypePersonalCard extends IConversationItemBase {
	type: EConversationType.personalCard;
	avatarInfo: string;
	nickname: string;
}

export type TConversationItem =
	| IConversationTypeText
	| IConversationTypeSingleUpperText
	| IConversationTypeTransfer
	| IConversationTypeImage
	| ICoversationTypeVideo
	| IConversationTypeVoice
	| IConversationTypeRedPacket
	| IConversationTypeRedPacketAcceptedReply
	| IConversationTypePersonalCard;
