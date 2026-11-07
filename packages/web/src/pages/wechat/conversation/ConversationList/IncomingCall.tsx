import { callScheduleAtom, addCallRecord } from "@/stateV2/videoCall";
import { getProfileValueSnapshot } from "@/stateV2/profile";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import VideoCall from "../ConversationFooter/VideoCall";

/** 到了设定的时间，对方打视频过来：屏幕上只有「接听 / 挂断」 */
const IncomingCall = ({ conversationId }: { conversationId: string }) => {
	const [sched, setSched] = useAtom(callScheduleAtom);
	const [ringing, setRinging] = useState(false);
	const at = sched[conversationId];

	useEffect(() => {
		if (!at || ringing) return;
		const t = setTimeout(() => setRinging(true), Math.max(0, at - Date.now()));
		return () => clearTimeout(t);
	}, [at, ringing]);

	if (!ringing) return null;
	const friend = getProfileValueSnapshot(conversationId);
	return (
		<VideoCall
			conversationId={conversationId}
			incoming
			name={friend?.remark || friend?.nickname || "好友"}
			avatar={friend?.avatarInfo ?? ""}
			onEnd={(sec) => {
				setRinging(false);
				setSched((v) => Object.fromEntries(Object.entries(v).filter(([k]) => k !== conversationId)));
				addCallRecord(conversationId, "friend", sec);
			}}
		/>
	);
};
export default IncomingCall;
