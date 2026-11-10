import type { IConversationTypeTransferReceipt } from "@/stateV2/conversation";
import UserName from "@/wechatComponents/User/UserName";
import { memo } from "react";
import { useConversationAPI } from "../../context";

type Props = {
	upperText?: string;
	receiver: IConversationTypeTransferReceipt["receiver"];
	receiverId?: string;
	amount?: string;
};

/** 转账的收款记录：谁收的。时间和位置跟这条消息自己的发送时间走 */
const TransferReceipt = ({ upperText, receiver, receiverId, amount }: Props) => {
	const { conversationId } = useConversationAPI();
	const who = receiver === "mine" ? "你" : receiverId ? <UserName id={receiverId} className="text-black/50" /> : <UserName id={conversationId} className="text-black/50" />;
	const yuan = amount ? ` ¥${Number.isFinite(Number(amount)) ? Number(amount).toFixed(2) : amount}` : "";

	return (
		<>
			{upperText && <div className="m-auto mt-2 mb-[17px] text-[14px] leading-5 text-black/50">{upperText}</div>}
			<div className="m-auto flex items-center text-black/50 text-xs">
				{who}
				<span>已收款{yuan}</span>
			</div>
		</>
	);
};

export default memo(TransferReceipt);
