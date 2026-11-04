import { h } from "@/components/HashAssets";
import useScreenTopBg from "@/components/useScreenTopBg";
import { type FriendRequest, friendRequestsAtom } from "@/stateV2/friendRequests";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavBar } from "./Shared";

const DAY = 24 * 3600 * 1000;

const Dots = () => (
	<div className="flex gap-[3px]">
		<i className="h-[4px] w-[4px] rounded-full bg-black" />
		<i className="h-[4px] w-[4px] rounded-full bg-black" />
		<i className="h-[4px] w-[4px] rounded-full bg-black" />
	</div>
);

const OutArrow = () => (
	<svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="mr-[6px]" aria-hidden="true">
		<path d="M1 11L11 1M3.500 1H11v7.500" stroke="rgba(0,0,0,0.4)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

const Row = ({ r }: { r: FriendRequest }) => {
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const out = r.direction === "out";
	const text = out ? `我: ${r.greeting}` : r.greeting;
	const long = text.length > 14;
	const pending = !out && !r.accepted && !r.expired;
	return (
		<div className="flex h-auto min-h-[58px] items-center pl-4">
			<span className="h-[39px] w-[39px] shrink-0 self-center overflow-hidden rounded-[4px] bg-[#E5E5E5]">
				{r.avatarInfo && <h.img src={r.avatarInfo} className="h-full w-full object-cover" />}
			</span>
			<div className="relative ml-3 flex min-h-[58px] min-w-0 flex-1 items-center py-[7px] pr-4 after:absolute after:right-0 after:bottom-0 after:left-0 after:h-px after:origin-bottom after:scale-y-50 after:bg-black/15 group-last:after:hidden">
				<div className="min-w-0 flex-1">
					<div className="truncate text-[17px] text-black/90 leading-6">{r.nickname}</div>
					<div className="flex text-[14px] text-black/50 leading-5">
						<span className={open || !long ? "" : "max-w-[190px] truncate"}>{text}</span>
						{long && !open && (
							<button type="button" className="ml-3 shrink-0 bg-transparent p-0 text-[#576B95]" onClick={() => setOpen(true)}>
								展开
							</button>
						)}
					</div>
				</div>
				<div className="ml-2 flex shrink-0 items-center text-[14px] text-black/40">
					{pending ? (
						<button
							type="button"
							className="h-[31px] rounded-[5px] bg-[#F2F2F2] px-[14px] text-[14px] text-black/90"
							onClick={() => navigate(`/wechat/new-friends/${r.id}`)}
						>
							查看
						</button>
					) : r.expired ? (
						"已过期"
					) : (
						<>
							{out && <OutArrow />}
							已添加
						</>
					)}
				</div>
			</div>
		</div>
	);
};

const NewFriends = () => {
	const requests = useAtomValue(friendRequestsAtom);
	useScreenTopBg("#EDEDED");
	const now = Date.now();
	const sorted = [...requests].sort((a, b) => b.timestamp - a.timestamp);
	const recent = sorted.filter((v) => now - v.timestamp < 3 * DAY);
	const older = sorted.filter((v) => now - v.timestamp >= 3 * DAY);

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-white">
			<NavBar title="新的朋友" right={<Dots />} />
			<div className="min-h-0 flex-1 overflow-auto">
				<div className="bg-[#EDEDED] px-2 pb-[9px]">
					<div className="flex h-[35px] items-center justify-center rounded-[6px] bg-white text-[16px] text-black/30">
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mr-2" aria-hidden="true">
							<circle cx="7" cy="7" r="5.500" stroke="rgba(0,0,0,0.3)" strokeWidth="1.500" />
							<path d="M11 11l3.500 3.500" stroke="rgba(0,0,0,0.3)" strokeWidth="1.500" strokeLinecap="round" />
						</svg>
						账号/手机号
					</div>
				</div>
				{requests.length === 0 && <div className="pt-24 text-center text-[15px] text-black/30">暂无新的朋友</div>}
				{(
					[
						["近三天", recent],
						["三天前", older],
					] as const
				).map(
					([label, list]) =>
						list.length > 0 && (
							<div key={label}>
								<div className="flex h-[35px] items-end px-4 pb-[5px] text-[14px] text-black/50">{label}</div>
								{list.map((r) => (
									<Row key={r.id} r={r} />
								))}
							</div>
						),
				)}
			</div>
		</div>
	);
};

export default NewFriends;
