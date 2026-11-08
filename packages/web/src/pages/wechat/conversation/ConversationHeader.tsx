import BackFilledSVG from "@/assets/back-filled.svg?react";
import MoreFilledSVG from "@/assets/more-filled.svg?react";
import { canBeDetected } from "@/components/NodeDetected";
import useModeNavigate from "@/components/useModeNavigate";
import { EMetaDataType } from "@/stateV2/detectedNode";
import { groupAtom, groupCount } from "@/stateV2/group";
import { profileAtom } from "@/stateV2/profile";
import { unreadCountAtom } from "@/stateV2/unreadCount";
import { useAtomValue } from "jotai";
import { useParams } from "react-router-dom";

const ConversationHeader = () => {
	const { id } = useParams<{ id: string }>();
	const friendProfile = useAtomValue(profileAtom(id ?? ""));
	const group = useAtomValue(groupAtom(id ?? ""));
	const unreadCount = useAtomValue(unreadCountAtom);
	const navigate = useModeNavigate();

	return (
		<div className="flex h-11 shrink-0 items-center border-black/10 border-b bg-[#EDEDED] px-4">
			<div className="flex min-w-[72px] shrink-0 items-center">
				<BackFilledSVG
					fill="black"
					className="h-5 w-5 cursor-pointer"
					onClick={() => {
						navigate("/wechat");
					}}
				/>
				<canBeDetected.div
					className="ml-1 rounded-2xl bg-[rgba(0,0,0,0.15)] px-2 py-[2px] text-xs"
					metaData={{
						type: EMetaDataType.UnreadCount,
						treeItemDisplayName: "未读消息数",
					}}
				>
					{unreadCount.count}
				</canBeDetected.div>
			</div>
			<div className="flex min-w-0 flex-1 items-center justify-center font-medium text-[17px] text-black/90">
				{group ? (
					<>
						<span className="truncate">{group.name}</span>
						<span className="shrink-0">({groupCount(group)})</span>
					</>
				) : (
					<span className="truncate">{friendProfile?.remark ?? friendProfile?.nickname}</span>
				)}
			</div>
			<div className="flex min-w-[72px] shrink-0 items-center justify-end">
				<MoreFilledSVG fill="black" className="h-5 w-5" onClick={() => group && navigate(`/wechat/conversation/${id}/info`)} />
			</div>
		</div>
	);
};

export default ConversationHeader;
