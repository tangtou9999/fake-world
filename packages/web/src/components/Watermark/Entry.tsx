import { can } from "@/auth/session";
import { watermarkOpenAtom } from "@/stateV2/watermark";
import { useAtom } from "jotai";
import { useRef, useState } from "react";
import WatermarkSettings from "./Settings";

const TAB = 30;
const defaultWidth = () => Math.min(320, Math.round(window.innerWidth * 0.66));

/**
 * 水印设置面板：停靠在右侧，左边保留一部分真实聊天页面做实时预览。
 * - 抓住面板左边缘左右拖动调宽度；
 * - 「收起」只留一个小标签，点标签再展开；
 * - 关闭按钮在面板内部右上角，避开 iPhone 左上角的触控盲区。
 * 入口是编辑模式顶部浮条里的「水印」按钮。
 */
const WatermarkEntry = () => {
	const [open, setOpen] = useAtom(watermarkOpenAtom);
	const [width, setWidth] = useState(defaultWidth);
	const [dragging, setDragging] = useState(false);
	const last = useRef(defaultWidth());
	if (!can("watermark") || !open) return null;
	const collapsed = width <= TAB + 2;

	const expand = () => setWidth(last.current > 120 ? last.current : defaultWidth());
	const collapse = () => {
		if (width > 120) last.current = width;
		setWidth(TAB);
	};

	const onDown = (e: React.PointerEvent) => {
		e.currentTarget.setPointerCapture(e.pointerId);
		setDragging(true);
	};
	const onMove = (e: React.PointerEvent) => {
		if (!dragging) return;
		setWidth(Math.max(TAB, Math.min(window.innerWidth * 0.96, window.innerWidth - e.clientX)));
	};
	const onUp = () => {
		setDragging(false);
		if (width < 120) setWidth(TAB);
		else last.current = width;
	};

	if (collapsed) {
		return (
			<button
				type="button"
				onClick={expand}
				aria-label="展开水印设置"
				className="fixed top-1/2 right-0 z-[1000] h-[72px] -translate-y-1/2 rounded-l-lg bg-[#07C160] text-[13px] text-white shadow-lg"
				style={{ width: TAB, writingMode: "vertical-rl" }}
			>
				水印设置
			</button>
		);
	}

	return (
		<div
			className="fixed top-0 right-0 bottom-0 z-[1000] flex bg-white shadow-[-6px_0_18px_rgba(0,0,0,0.18)]"
			style={{ width, transition: dragging ? "none" : "width .18s" }}
		>
			<div
				onPointerDown={onDown}
				onPointerMove={onMove}
				onPointerUp={onUp}
				onPointerCancel={onUp}
				className="flex w-[22px] shrink-0 cursor-col-resize items-center justify-center bg-[#F2F2F2]"
				style={{ touchAction: "none" }}
			>
				<div className="h-[44px] w-[4px] rounded-full bg-black/25" />
			</div>
			<div className="flex min-w-0 flex-1 flex-col">
				<div className="flex shrink-0 items-center justify-between px-3 pb-2" style={{ paddingTop: "calc(env(safe-area-inset-top) + 44px)" }}>
					<span className="font-medium text-[16px]">水印设置</span>
					<div className="flex gap-2">
						<button type="button" onClick={collapse} className="rounded-md bg-[#F2F2F2] px-3 py-[6px] text-[14px]">
							收起
						</button>
						<button type="button" onClick={() => setOpen(false)} className="rounded-md bg-[#F2F2F2] px-3 py-[6px] text-[14px]">
							关闭
						</button>
					</div>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto px-3 pb-8">
					<WatermarkSettings />
				</div>
			</div>
		</div>
	);
};

export default WatermarkEntry;
