import type { Descendant } from "slate";

export enum EConversationType {
	text = "text",
	image = "image",
	video = "video",
	voice = "voice",
	centerText = "centerText",
	transfer = "transfer",
	redPacket = "redPacket",
	/** 转账的收款记录，和发起那条是两条独立消息 */
	transferReceipt = "transferReceipt",
	redPacketAcceptedReply = "redPacketAcceptedReply",
	/** 视频通话记录：谁打的、结果、时长，可单独改、单独删 */
	call = "call",
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

export type TTransferStatus = "awaiting" | "accepted" | "rejected" | "expired" | "returned";

export interface IConversationTypeTransfer extends IConversationItemBase {
	type: EConversationType.transfer;
	originalSender: TConversationRole;
	/** returned = 已退回。旧数据里的 rejected（已退还）照常显示 */
	transferStatus: TTransferStatus;
	amount: string;
	note?: string;
	/** 群聊里这笔转账转给了哪位成员（成员 id） */
	transferTo?: string;
	/** 超时未收款自动退回的小时数。没有这个字段的旧消息不会自动改 */
	autoReturnHours?: number;
	/** 这条是某笔发起转账的配对收款/退回。发起那条没有这个字段 */
	pairOf?: string;
}

export type TRedPacketStatus = "awaiting" | "accepted" | "expired" | "returned";

export interface IConversationTypeRedPacket extends IConversationItemBase {
	type: EConversationType.redPacket;
	originalSender: TConversationRole;
	redPacketStatus: TRedPacketStatus;
	amount: string;
	note?: string;
	/** 超时未领取自动退回的小时数。没有这个字段的旧消息不会自动改 */
	autoReturnHours?: number;
}

/** 转账收款记录。不依赖发起那条也能单独存在、单独删除 */
export interface IConversationTypeTransferReceipt extends IConversationItemBase {
	type: EConversationType.transferReceipt;
	/** 对应的发起转账 id，可以没有 */
	transferId?: string;
	/** 谁收的 */
	receiver: TConversationRole;
	/** 群聊里收款的成员 id */
	receiverId?: string;
	amount?: string;
}

export interface IConversationTypeRedPacketAcceptedReply extends IConversationItemBase {
	type: EConversationType.redPacketAcceptedReply;
	redPacketId: string;
	/** 群聊：领取红包的成员 id（没有则看 receiver / 发起人） */
	claimerId?: string;
	/** 谁领的。旧数据没有这个字段时，仍按发起人推断 */
	receiver?: TConversationRole;
}

export interface IConversationTypeCall extends IConversationItemBase {
	type: EConversationType.call;
	/** rejected 已拒绝 / cancelled 已取消 / accepted 已接通 */
	callStatus: "rejected" | "cancelled" | "accepted";
	/** 接通时的通话秒数 */
	seconds?: number;
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
	/** 真实聊天的语音：服务器上音频文件的 id */
	voiceBlob?: string;
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
	| IConversationTypeTransferReceipt
	| IConversationTypeCall
	| IConversationTypeImage
	| ICoversationTypeVideo
	| IConversationTypeVoice
	| IConversationTypeRedPacket
	| IConversationTypeRedPacketAcceptedReply
	| IConversationTypePersonalCard;
