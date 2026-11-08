import { h } from "@/components/HashAssets";
import { getAllProfilesValueSnapshot } from "@/stateV2/profile";
import { MYSELF_ID } from "@/faker/wechat/user";

const ROWS: Record<number, number[]> = { 1: [1], 2: [2], 3: [1, 2], 4: [2, 2], 5: [2, 3], 6: [3, 3], 7: [1, 3, 3], 8: [2, 3, 3], 9: [3, 3, 3] };

/** 群头像：最多 9 个成员头像拼成九宫格（微信的拼法） */
const GroupAvatar = ({ memberIds, className = "h-12 w-12" }: { memberIds: string[]; className?: string }) => {
	const all = getAllProfilesValueSnapshot();
	const ids = [...memberIds.filter((m) => m === MYSELF_ID), ...memberIds.filter((m) => m !== MYSELF_ID)].slice(0, 9);
	const rows = ROWS[Math.max(1, ids.length)] ?? [3, 3, 3];
	let k = 0;
	return (
		<div className={`${className} flex shrink-0 flex-col items-center justify-center gap-[2px] overflow-hidden rounded-[6px] bg-[#DEDEDE] p-[2px]`}>
			{rows.map((n, r) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: 固定排布
				<div key={r} className="flex w-full justify-center gap-[2px]">
					{Array.from({ length: n }, () => {
						const id = ids[k++];
						const p = all.find((x) => x.id === id);
						return <h.img key={id} src={p?.avatarInfo} alt="" className="bg-white object-cover" style={{ width: "calc((100% - 4px) / 3)", aspectRatio: "1 / 1" }} />;
					})}
				</div>
			))}
		</div>
	);
};
export default GroupAvatar;
