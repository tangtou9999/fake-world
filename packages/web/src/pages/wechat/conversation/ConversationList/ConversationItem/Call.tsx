import type { IConversationTypeCall } from "@/stateV2/conversation";
import type { IStateProfile } from "@/stateV2/profile";
import { MYSELF_ID } from "@/faker/wechat/user";
import { memo } from "react";
import CommonBlock from "./CommonBlock";

const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
const callLabel = (role: "mine" | "friend", status?: string, seconds?: number) =>
	status === "rejected" ? (role === "mine" ? "对方已拒绝" : "已拒绝") : status === "cancelled" ? (role === "mine" ? "已取消" : "对方已取消") : `通话时长 ${mmss(Math.max(1, Math.round(seconds || 30)))}`;

type Props = {
	role: IConversationTypeCall["role"];
	upperText?: string;
	senderId: IStateProfile["id"];
	callStatus: IConversationTypeCall["callStatus"];
	seconds?: number;
};

const CallIcon = ({ mirror }: { mirror?: boolean }) => (
	<svg width="21" height="15" viewBox="0 0 21 15" fill="none" aria-hidden="true" className="shrink-0" style={mirror ? { transform: "scaleX(-1)" } : undefined}>
		<rect x="1" y="1.5" width="13" height="12" rx="2.2" stroke="#1A1A1A" strokeWidth="1.6" />
		<path d="M15.5 6.2 19.6 3.6v7.8l-4.1-2.6" stroke="#1A1A1A" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
	</svg>
);

/** 视频通话记录。旧的「📹 文字」气泡仍然由文字消息负责显示 */
const CallRecord = ({ role, upperText, senderId, callStatus, seconds }: Props) => {
	const mine = senderId === MYSELF_ID;
	const label = callLabel(role, callStatus, seconds);
	return (
		<CommonBlock
			upperText={upperText}
			senderId={senderId}
			innerBlockClassName="group-[.friend]:bg-white group-[.mine]:bg-[#8CE97F] group-[.friend]:before:bg-white group-[.mine]:before:bg-[#8CE97F]"
		>
			<span className="flex items-center gap-3 whitespace-nowrap">
				{!mine && <CallIcon />}
				<span>{label}</span>
				{mine && <CallIcon mirror />}
			</span>
		</CommonBlock>
	);
};

export default memo(CallRecord);
