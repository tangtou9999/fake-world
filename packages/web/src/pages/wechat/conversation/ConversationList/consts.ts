import type {
	IConversationTypeRedPacket,
	IConversationTypeTransfer,
	TConversationRole,
} from "@/stateV2/conversation";

export const TRANSFER_TEXT_NOTE_MAP: Record<
	IConversationTypeTransfer["originalSender"],
	Record<TConversationRole, Record<IConversationTypeTransfer["transferStatus"], string>>
> = {
	mine: {
		mine: {
			awaiting: "",
			accepted: "已被接收",
			rejected: "已被退还",
			returned: "已退回",
			expired: "已过期",
		},
		friend: {
			/** 我发起的转账，转账未领取状态且是好友发消息是不存在的 */
			awaiting: "该数据不合法，请重新检查！！",
			accepted: "已收款",
			rejected: "已退还",
			returned: "已退回",
			/** 我发起的转账，转账过期状态且是好友发消息是不存在的 */
			expired: "该数据不合法，请重新检查！！",
		},
	},
	friend: {
		mine: {
			/** 好友发起的转账，转账未领取状态且是我发消息是不存在的 */
			awaiting: "该数据不合法，请重新检查！！",
			accepted: "已收款",
			rejected: "已退还",
			returned: "已退回",
			/** 好友发起的转账，转账过期状态且是我发消息是不存在的 */
			expired: "该数据不合法，请重新检查！！",
		},
		friend: {
			awaiting: "请收款",
			accepted: "已收款",
			rejected: "已退还",
			returned: "已退回",
			expired: "已过期",
		},
	},
};

export const RED_PACKET_TEXT_NOTE_MAP: Record<
	IConversationTypeRedPacket["originalSender"],
	Record<TConversationRole, Record<IConversationTypeRedPacket["redPacketStatus"], string>>
> = {
	mine: {
		mine: {
			awaiting: "",
			accepted: "已被领完",
			expired: "已过期",
			returned: "已退回",
		},
		friend: {
			awaiting: "",
			accepted: "",
			expired: "",
			returned: "",
		},
	},
	friend: {
		mine: {
			awaiting: "",
			accepted: "",
			expired: "",
			returned: "",
		},
		friend: {
			awaiting: "",
			accepted: "已领取",
			expired: "已过期",
			returned: "已退回",
		},
	},
};
