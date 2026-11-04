import { h } from "@/components/HashAssets";
import useScreenTopBg from "@/components/useScreenTopBg";
import { acceptFriendRequest, friendRequestsAtom } from "@/stateV2/friendRequests";
import { useAtom } from "jotai";
import { useNavigate } from "react-router-dom";
import { NavBar } from "./Shared";

const NewFriends = () => {
	const navigate = useNavigate();
	const [requests, setRequests] = useAtom(friendRequestsAtom);
	useScreenTopBg("#EDEDED");

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-white">
			<NavBar
				title="新的朋友"
				right={
					<button type="button" className="text-[16px] text-black/90" onClick={() => navigate("/wechat/add-friend")}>
						添加朋友
					</button>
				}
			/>
			<div className="min-h-0 flex-1 overflow-auto">
				{requests.length === 0 && <div className="pt-24 text-center text-[15px] text-black/30">暂无新的朋友</div>}
				{requests.map((r) => (
					<div key={r.id} className="flex items-center px-4 py-3">
						<span className="h-[48px] w-[48px] shrink-0 overflow-hidden rounded-[6px] bg-[#E5E5E5]">
							{r.avatarInfo && <h.img src={r.avatarInfo} className="h-full w-full object-cover" />}
						</span>
						<div className="ml-3 min-w-0 flex-1 border-black/10 border-b py-1">
							<div className="truncate text-[17px] text-black/90">{r.nickname}</div>
							<div className="truncate text-[14px] text-black/50">{r.greeting}</div>
						</div>
						{r.accepted ? (
							<span className="ml-3 text-[15px] text-black/40">已添加</span>
						) : (
							<button
								type="button"
								className="ml-3 h-8 rounded-[6px] bg-[#07C160] px-4 text-[15px] text-white"
								onClick={() => {
									const id = acceptFriendRequest(r);
									setRequests((prev) => prev.map((v) => (v.id === r.id ? { ...v, accepted: true } : v)));
									navigate(`/wechat/conversation/${id}`);
								}}
							>
								接受
							</button>
						)}
					</div>
				))}
			</div>
		</div>
	);
};

export default NewFriends;
