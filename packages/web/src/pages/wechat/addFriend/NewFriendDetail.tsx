import { h } from "@/components/HashAssets";
import useScreenTopBg from "@/components/useScreenTopBg";
import { acceptFriendRequest, friendRequestsAtom } from "@/stateV2/friendRequests";
import { useAtomValue } from "jotai";
import { useNavigate, useParams } from "react-router-dom";
import { GreenButton, NavBar } from "./Shared";

const NewFriendDetail = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const r = useAtomValue(friendRequestsAtom).find((v) => v.id === id);
	useScreenTopBg("#EDEDED");
	if (!r) return null;
	return (
		<div className="flex min-h-0 flex-1 flex-col bg-[#EDEDED]">
			<NavBar title="详细资料" />
			<div className="bg-white px-5 py-5">
				<div className="flex items-center">
					<span className="h-[64px] w-[64px] shrink-0 overflow-hidden rounded-[6px] bg-[#E5E5E5]">
						{r.avatarInfo && <h.img src={r.avatarInfo} className="h-full w-full object-cover" />}
					</span>
					<div className="ml-4 min-w-0">
						<div className="truncate font-medium text-[20px]">{r.nickname}</div>
						<div className="text-[14px] text-black/50">微信号：{r.wechat || "-"}</div>
					</div>
				</div>
			</div>
			<div className="mt-2 flex bg-white px-5 py-4 text-[16px]">
				<span className="w-[72px] shrink-0 text-black/50">留言</span>
				<span className="min-w-0 flex-1 text-black/90">{r.greeting}</span>
			</div>
			<GreenButton
				onClick={() => {
					const pid = acceptFriendRequest(r);
					navigate(`/wechat/conversation/${pid}`, { replace: true });
				}}
				disabled={!!r.accepted || !!r.expired}
			>
				{r.accepted ? "已添加" : r.expired ? "已过期" : "通过验证"}
			</GreenButton>
		</div>
	);
};

export default NewFriendDetail;
