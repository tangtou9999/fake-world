import { hashAssetsDB } from "@/db";
import { getFileMD5 } from "@/utils";
import { type ReactNode, useRef } from "react";

export const inputCls = "w-full rounded-[6px] bg-[#F5F5F5] px-3 py-[7px] text-[16px] outline-none";

export const Row = ({ label, children }: { label: string; children: ReactNode }) => (
	<div className="flex items-start gap-3 border-black/5 border-b py-2">
		<div className="w-[84px] shrink-0 pt-[7px] text-[14px] text-black/50">{label}</div>
		<div className="min-w-0 flex-1">{children}</div>
	</div>
);

/** 长按（触屏 550ms 或右键）触发 */
export function useLongPress(cb: () => void, ms = 550) {
	const t = useRef<ReturnType<typeof setTimeout>>();
	const stop = () => {
		if (t.current) clearTimeout(t.current);
		t.current = undefined;
	};
	return {
		onTouchStart: () => {
			stop();
			t.current = setTimeout(cb, ms);
		},
		onTouchEnd: stop,
		onTouchMove: stop,
		onTouchCancel: stop,
		onContextMenu: (e: { preventDefault: () => void }) => {
			e.preventDefault();
			cb();
		},
	};
}

export async function saveImage(file: File): Promise<string> {
	const hash = await getFileMD5(file);
	await hashAssetsDB.images.put({ id: hash, file });
	return hash;
}

/** 底部弹出面板；外层再包一层阻止冒泡，避免触发下面可点击的行 */
export const Sheet = ({
	title,
	onClose,
	onSave,
	children,
	extra,
}: {
	title: string;
	onClose: () => void;
	onSave: () => void;
	children: ReactNode;
	extra?: ReactNode;
}) => (
	<div
		onClick={(e) => e.stopPropagation()}
		onTouchStart={(e) => e.stopPropagation()}
		onTouchEnd={(e) => e.stopPropagation()}
		onTouchMove={(e) => e.stopPropagation()}
	>
		<div className="fixed inset-0 z-[1100] flex flex-col justify-end bg-black/40" onClick={onClose}>
			<div
				className="flex max-h-[90%] flex-col rounded-t-[14px] bg-white pb-[env(safe-area-inset-bottom)]"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between px-4 py-3">
					<button type="button" className="text-[16px] text-black/50" onClick={onClose}>
						取消
					</button>
					<div className="font-medium text-[16px]">{title}</div>
					<button type="button" className="text-[16px] text-[#07C160]" onClick={onSave}>
						保存
					</button>
				</div>
				<div className="min-h-0 flex-1 overflow-auto px-4 pb-3">{children}</div>
				{extra && <div className="border-black/5 border-t px-4 py-2">{extra}</div>}
			</div>
		</div>
	</div>
);
