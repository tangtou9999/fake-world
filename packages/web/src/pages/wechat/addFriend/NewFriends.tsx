import { h } from "@/components/HashAssets";
import useScreenTopBg from "@/components/useScreenTopBg";
import { type FriendRequest, friendRequestsAtom } from "@/stateV2/friendRequests";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const DAY = 24 * 3600 * 1000;

const Back = ({ onClick }: { onClick: () => void }) => (
	<button type="button" aria-label="返回" className="absolute left-3 flex h-8 w-8 items-center" onClick={onClick}>
		<svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
			<path d="M10 2L2 10l8 8" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	</button>
);

const SendIcon = () => (
	<svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true" className="mr-1">
		<path d="M3 14L14 3M6 3h8v8" stroke="rgba(0,0,0,0.4)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

const Row = ({ r, onView }: { r: FriendRequest; onView: () => void }) => {
	const [open, setOpen] = useState(false);
	const long = r.greeting.length > 14;
	const subtitle = r.direction === "out" ? `我: ${r.greeting}` : r.greeting;
	return (
		<div className="flex items-start pl-4">
			<span className="mt-[11px] h-[40px] w-[40px] shrink-0 overflow-hidden rounded-[4px] bg-[#E5E5E5]">
				<h.img src={r.avatarInfo} className="h-full w-full object-cover" />
			</span>
			<div className="ml-3 flex min-h-[62px] min-w-0 flex-1 items-start border-black/10 border-b py-[11px] pr-4">
				<div className="min-w-0 flex-1">
					<div className="truncate text-[17px] text-black/90 leading-[22px]">
						{r.nickname}
						{r.phone && <sup className="ml-1 text-[10px] text-black/60">{r.phone}</sup>}
					</div>
					<div className={`flex text-[14px] text-black/50 leading-5 ${open ? "" : "items-center"}`}>
						<span className={open ? "" : "truncate"}>{subtitle}</span>
						{long && !open && (
							<button type="button" className="ml-3 shrink-0 text-[#576B95]" onClick={() => setOpen(true)}>
								展开
							</button>
						)}
					</div>
				</div>
				<div className="ml-3 flex shrink-0 items-center self-start pt-[1px] text-[15px] text-black/45">
					{r.status === "pending" ? (
						<button
							type="button"
							onClick={onView}
							className="-mt-[1px] h-[31px] rounded-[6px] bg-black/5 px-[13px] text-[16px] text-black/90"
						>
							查看
						</button>
					) : r.status === "expired" ? (
						"已过期"
					) : (
						<>
							{r.direction === "out" && <SendIcon />}
							已添加
						</>
					)}
				</div>
			</div>
		</div>
	);
};

const NewFriends = () => {
	const navigate = useNavigate();
	const requests = useAtomValue(friendRequestsAtom);
	useScreenTopBg("#EDEDED");
	const sorted = [...requests].sort((a, b) => b.timestamp - a.timestamp);
	const recent = sorted.filter((r) => Date.now() - r.timestamp < 3 * DAY);
	const older = sorted.filter((r) => Date.now() - r.timestamp >= 3 * DAY);

	const Section = ({ title, list }: { title: string; list: FriendRequest[] }) =>
		list.length === 0 ? null : (
			<div>
				<div className="px-4 pt-[14px] pb-[6px] text-[14px] text-black/50">{title}</div>
				{list.map((r) => (
					<Row key={r.id} r={r} onView={() => navigate(`/wechat/new-friends/${r.id}`)} />
				))}
			</div>
		);

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-white">
			<div className="relative flex h-11 shrink-0 items-center justify-center bg-[#EDEDED] px-4">
				<Back onClick={() => navigate("/wechat")} />
				<div className="font-medium text-[17.5px]">新的朋友</div>
				<button
					type="button"
					aria-label="添加朋友"
					className="absolute right-4 flex gap-[3px]"
					onClick={() => navigate("/wechat/add-friend")}
				>
					<i className="h-[4px] w-[4px] rounded-full bg-black" />
					<i className="h-[4px] w-[4px] rounded-full bg-black" />
					<i className="h-[4px] w-[4px] rounded-full bg-black" />
				</button>
			</div>
			<div className="shrink-0 bg-[#EDEDED] px-2 pb-2">
				<div className="flex h-[36px] items-center justify-center rounded-[6px] bg-white text-[16px] text-black/30">
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mr-2" aria-hidden="true">
						<circle cx="7" cy="7" r="5.5" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" />
						<path d="M11 11l4 4" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" strokeLinecap="round" />
					</svg>
					账号/手机号
				</div>
			</div>
			<div className="min-h-0 flex-1 overflow-auto">
				{requests.length === 0 && <div className="pt-24 text-center text-[15px] text-black/30">暂无新的朋友</div>}
				<Section title="近三天" list={recent} />
				<Section title="三天前" list={older} />
			</div>
		</div>
	);
};

export default NewFriends;
