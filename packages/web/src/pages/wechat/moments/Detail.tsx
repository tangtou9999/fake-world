import BackFilledSVG from "@/assets/back-filled.svg?react";
import MoreFilledSVG from "@/assets/more-filled.svg?react";
import useModeNavigate from "@/components/useModeNavigate";
import { feedAtom } from "@/stateV2/moments";
import { useAtom } from "jotai";
import { useParams } from "react-router-dom";
import CommentComposer from "./CommentComposer";
import Feed from "./Feed";

const feedClassNames = {
	container: "border-none p-3 flex-1 overflow-auto",
	avatar: "h-10 w-10",
};

const MomentDetail = () => {
	const { id: feedId } = useParams();
	const [feed] = useAtom(feedAtom(feedId ?? ""))!;
	const navigate = useModeNavigate();

	if (!feed) return null;

	return (
		<>
			<div className="grid grid-cols-3 bg-[rgba(237,237,237,1)] px-4 py-2">
				<BackFilledSVG
					fill="black"
					className="h-5 w-5 cursor-pointer"
					onClick={() => navigate(-1)}
				/>
				<div className="flex items-center justify-center font-medium text-[17px]">详情</div>
				<div className="flex items-center justify-end">
					<MoreFilledSVG fill="black" className="h-5 w-5" />
				</div>
			</div>
			<Feed id={feedId ?? ""} userId={feed.userId} classNames={feedClassNames} fromDetail />
			<CommentComposer feedId={feedId ?? ""} />
		</>
	);
};

export default MomentDetail;
