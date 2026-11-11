import { AVATAR_CATEGORIES, listAvatarUrls } from "@/library/pick";
import { storeAssetFile } from "@/utils/media";
import { useRef, useState } from "react";

/** 换头像：从素材库里挑，或者从相册选。选完立刻回调，由调用方保存。 */
const AvatarPicker = ({ current, onPick, onClose }: { current?: string; onPick: (avatar: string) => void; onClose: () => void }) => {
	const [cat, setCat] = useState(AVATAR_CATEGORIES[0].key);
	const file = useRef<HTMLInputElement>(null);
	return (
		<div className="fixed inset-0 z-[1100] flex flex-col justify-end bg-black/40" onClick={onClose}>
			<div className="flex max-h-[80%] flex-col rounded-t-[14px] bg-white pb-[env(safe-area-inset-bottom)]" onClick={(e) => e.stopPropagation()}>
				<div className="flex items-center justify-between px-4 py-3">
					<button type="button" className="text-[16px] text-black/50" onClick={onClose}>
						取消
					</button>
					<div className="font-medium text-[17px]">更换头像</div>
					<button type="button" className="text-[16px] text-[#07C160]" onClick={() => file.current?.click()}>
						相册
					</button>
				</div>
				<div className="flex gap-2 px-4 pb-2">
					{AVATAR_CATEGORIES.map((c) => (
						<button key={c.key} type="button" onClick={() => setCat(c.key)} className={`rounded-full px-3 py-1 text-[14px] ${cat === c.key ? "bg-[#07C160] text-white" : "bg-black/5"}`}>
							{c.label}
						</button>
					))}
				</div>
				<div className="grid grid-cols-4 gap-2 overflow-y-auto px-4 pb-4">
					{listAvatarUrls(cat).map((u) => (
						<button key={u} type="button" onClick={() => onPick(u)} className={`aspect-square overflow-hidden rounded-[6px] ${current === u ? "ring-2 ring-[#07C160]" : ""}`}>
							<img src={u} alt="" loading="lazy" className="h-full w-full object-cover" />
						</button>
					))}
				</div>
				<input
					ref={file}
					type="file"
					accept="image/*"
					className="hidden"
					onChange={async (e) => {
						const f = e.target.files?.[0];
						e.target.value = "";
						if (f) onPick(await storeAssetFile(f));
					}}
				/>
			</div>
		</div>
	);
};

export default AvatarPicker;
