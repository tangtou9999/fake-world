import BackFilledSVG from "@/assets/back-filled.svg?react";
import SearchOutlinedSVG from "@/assets/search-outlined.svg?react";
import useScreenTopBg from "@/components/useScreenTopBg";
import { groupsAtom } from "@/stateV2/group";
import GroupAvatar from "@/wechatComponents/GroupAvatar";
import { useAtomValue } from "jotai";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

/** 通讯录「群聊」：当前所有群，点进聊天，按群名搜索。 */
const GroupList = () => {
	useScreenTopBg("#EDEDED");
	const navigate = useNavigate();
	const groups = useAtomValue(groupsAtom);
	const [q, setQ] = useState("");
	const key = q.trim().toLowerCase();
	const shown = useMemo(
		() => groups.filter((g) => !key || (g.remark || g.name).toLowerCase().includes(key)).slice().sort((a, b) => (a.remark || a.name).localeCompare(b.remark || b.name, "zh")),
		[groups, key],
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-white">
			<div className="grid h-11 shrink-0 grid-cols-3 items-center bg-[#EDEDED] px-4">
				<button type="button" aria-label="返回" className="flex h-8 w-8 items-center" onClick={() => navigate(-1)}>
					<BackFilledSVG fill="black" className="h-5 w-5" />
				</button>
				<div className="text-center font-medium text-[17px] text-black/90">群聊</div>
				<div />
			</div>
			<div className="shrink-0 bg-[#EDEDED] px-3 pb-2">
				<div className="flex h-[35px] items-center rounded-[6px] bg-white px-2">
					<SearchOutlinedSVG width={18} height={18} fill="rgba(0,0,0,0.3)" />
					<input
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder="搜索"
						aria-label="搜索群聊"
						className="ml-1 min-w-0 flex-1 bg-transparent text-[16px] outline-none"
					/>
				</div>
			</div>
			<div className="min-h-0 flex-1 overflow-auto">
				{shown.map((g) => (
					<button
						key={g.id}
						type="button"
						onClick={() => navigate(`/wechat/conversation/${g.id}`)}
						className="flex w-full items-center bg-white pl-4 text-left"
					>
						<GroupAvatar memberIds={g.memberIds} className="h-10 w-10" />
						<span className="ml-3 flex min-h-[56px] min-w-0 flex-1 items-center border-black/10 border-b pr-4 text-[17px] text-black/90">
							<span className="truncate">{g.remark || g.name}</span>
						</span>
					</button>
				))}
				<div className="py-6 text-center text-[14px] text-black/35">{shown.length}个群聊</div>
			</div>
		</div>
	);
};

export default GroupList;
