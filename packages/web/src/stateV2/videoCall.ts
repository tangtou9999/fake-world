import atomWithStorage from "./atomWithStorage";
import { EConversationType, fromLastGenerateUpperText, setConversationListValue } from "./conversation";
import { touchDialogue } from "./fileHelper";
import dayjs from "dayjs";
import { nanoid } from "nanoid";

/** 每个聊天「对方什么时候打视频过来」：聊天 id → 时间戳（毫秒）。存在手机本地。 */
export const callScheduleAtom = atomWithStorage<Record<string, number>>("call-schedule", {});

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** 通话结束后在聊天里留一条记录 */
export const addCallRecord = (conversationId: string, role: "mine" | "friend", seconds: number) => {
	const text =
		seconds < 0
			? role === "mine"
				? "已取消"
				: "对方已取消"
			: seconds === 0
				? role === "friend"
					? "已拒绝"
					: "对方已拒绝"
				: `通话时长 ${mmss(seconds)}`;
	touchDialogue(conversationId, `[视频通话] ${text}`);
	const callStatus = seconds < 0 ? "cancelled" : seconds === 0 ? "rejected" : "accepted";
	setConversationListValue(conversationId, (prev) => [
		...prev,
		{
			type: EConversationType.call,
			role,
			id: nanoid(8),
			sendTimestamp: dayjs().valueOf(),
			upperText: fromLastGenerateUpperText(prev),
			callStatus,
			seconds: seconds > 0 ? seconds : undefined,
		} as (typeof prev)[number],
	]);
};
