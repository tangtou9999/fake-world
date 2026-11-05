import { h } from "@/components/HashAssets";
import useScreenTopBg from "@/components/useScreenTopBg";
import { acceptFriendRequest, friendRequestsAtom } from "@/stateV2/friendRequests";
import { useAtomValue } from "jotai";
import { useNavigate, useParams } from "react-router-dom";
import { GreenButton, NavBar } from "./Shared";

const RequestDetail = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const req = useAtomValue(friendRequestsAtom).find((v) => v.id === id);
	useScreenTopBg("#EDEDED");

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-[#EDEDED]">
			<NavBar title="详细资料" />
			{!req ? (
				<div className="pt-24 text-center text-black/30">该申请不存在</div>
			) : (
				<div className="min-h-0 flex-1 overflow-auto">
					<div className="flex items-center bg-white px-5 py-6">
						<span className="h-[64px] w-[64px] shrink-0 overflow-hidden rounded-[6px] bg-[#E5E5E5]">
							<h.img src={req.avatarInfo} className="h-full w-full object-cover" />
						</span>
						<div className="ml-4 min-w-0">
							<div className="truncate font-medium text-[20px]">{req.nickname}</div>
							<div className="mt-1 text-[14px] text-black/50">微信号：{req.wechat}</div>
						</div>
					</div>
					{req.phone && (
						<div className="mt-2 flex bg-white px-5 py-3 text-[16px]">
							<span className="w-[80px] text-black/90">电话</span>
							<span className="text-[#576B95]">{req.phone}</span>
						</div>
					)}
					<div className="mt-2 flex bg-white px-5 py-3 text-[16px] leading-6">
						<span className="w-[80px] shrink-0 text-black/90">留言</span>
						<span className="text-black/60">{req.greeting}</span>
					</div>
					{req.status === "pending" ? (
						<GreenButton
							onClick={() => {
								const fid = acceptFriendRequest(req);
								navigate(`/wechat/conversation/${fid}`, { replace: true });
							}}
						>
							前往验证 · 通过
						</GreenButton>
					) : (
						<div className="pt-10 text-center text-[15px] text-black/40">
							{req.status === "expired" ? "该申请已过期" : "已添加"}
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default RequestDetail;
