import { IMAGES_CACHE, initDBImagesCacheStore } from "@/db";
import { isMD5 } from "@/utils";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const assetUrl = (value?: string) => {
	if (!value) return "";
	if (isMD5(value)) return IMAGES_CACHE.get(value) ?? "";
	return value;
};

const closeBtn =
	"absolute z-20 flex h-9 w-9 items-center justify-center text-[30px] text-white leading-none";

/** 黑底看图：左右滑、双指/双击缩放，单击退出。 */
export const MomentImageViewer = ({
	images,
	start,
	onClose,
}: {
	images: string[];
	start: number;
	onClose: () => void;
}) => {
	const [urls, setUrls] = useState<string[]>([]);
	const [index, setIndex] = useState(start);
	const [scale, setScale] = useState(1);
	const [pos, setPos] = useState({ x: 0, y: 0 });
	const [drag, setDrag] = useState(0);
	const box = useRef<HTMLDivElement>(null);
	const live = useRef({ index, scale, x: 0, y: 0 });
	live.current = { index, scale, x: pos.x, y: pos.y };
	const closeRef = useRef(onClose);
	closeRef.current = onClose;
	const skipClick = useRef(false);
	const mouseTimer = useRef(0);

	useEffect(() => {
		let on = true;
		void initDBImagesCacheStore().then(() => {
			if (on) setUrls(images.map((id) => assetUrl(id)));
		});
		return () => {
			on = false;
		};
	}, [images]);

	useEffect(() => {
		const el = box.current;
		if (!el) return;
		let mode: "tap" | "pan" | "pinch" | "swipe" = "tap";
		let startX = 0;
		let startY = 0;
		let startDist = 1;
		let baseScale = 1;
		let baseX = 0;
		let baseY = 0;
		let lastTap = 0;
		let tapTimer = 0;
		const dist = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
		const resetZoom = () => {
			setScale(1);
			setPos({ x: 0, y: 0 });
		};
		const onStart = (e: TouchEvent) => {
			if (e.touches.length >= 2) {
				mode = "pinch";
				startDist = dist(e.touches[0], e.touches[1]) || 1;
				baseScale = live.current.scale;
				window.clearTimeout(tapTimer);
				return;
			}
			mode = "tap";
			startX = e.touches[0].clientX;
			startY = e.touches[0].clientY;
			baseX = live.current.x;
			baseY = live.current.y;
			baseScale = live.current.scale;
		};
		const onMove = (e: TouchEvent) => {
			e.preventDefault();
			if (e.touches.length >= 2) {
				mode = "pinch";
				const next = Math.min(4, Math.max(1, baseScale * ((dist(e.touches[0], e.touches[1]) || 1) / startDist)));
				setScale(next);
				if (next <= 1.01) setPos({ x: 0, y: 0 });
				return;
			}
			const dx = e.touches[0].clientX - startX;
			const dy = e.touches[0].clientY - startY;
			if (baseScale > 1.02) {
				mode = "pan";
				setPos({ x: baseX + dx, y: baseY + dy });
				return;
			}
			if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
				mode = "swipe";
				setDrag(dx);
			}
		};
		const onEnd = (e: TouchEvent) => {
			if (e.touches.length === 1) {
				mode = live.current.scale > 1.02 ? "pan" : "tap";
				startX = e.touches[0].clientX;
				startY = e.touches[0].clientY;
				baseX = live.current.x;
				baseY = live.current.y;
				baseScale = live.current.scale;
				setDrag(0);
				return;
			}
			if (e.touches.length > 0) return;
			skipClick.current = true;
			const dx = (e.changedTouches[0]?.clientX ?? startX) - startX;
			const dy = (e.changedTouches[0]?.clientY ?? startY) - startY;
			if (mode === "swipe" && images.length > 1 && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
				setIndex((n) => (n + (dx < 0 ? 1 : -1) + images.length) % images.length);
				resetZoom();
			} else if (mode === "tap" && Math.abs(dx) < 8 && Math.abs(dy) < 8) {
				const now = Date.now();
				if (now - lastTap < 280) {
					window.clearTimeout(tapTimer);
					lastTap = 0;
					if (live.current.scale > 1.05) resetZoom();
					else {
						const rect = el.getBoundingClientRect();
						const cx = startX - rect.left - rect.width / 2;
						const cy = startY - rect.top - rect.height / 2;
						setScale(2.5);
						setPos({ x: -cx * 0.45, y: -cy * 0.45 });
					}
				} else {
					lastTap = now;
					tapTimer = window.setTimeout(() => closeRef.current(), 260);
				}
			}
			setDrag(0);
			mode = "tap";
		};
		el.addEventListener("touchstart", onStart, { passive: true });
		el.addEventListener("touchmove", onMove, { passive: false });
		el.addEventListener("touchend", onEnd);
		el.addEventListener("touchcancel", onEnd);
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") closeRef.current();
			if (event.key === "ArrowRight" && images.length > 1) setIndex((n) => (n + 1) % images.length);
			if (event.key === "ArrowLeft" && images.length > 1) setIndex((n) => (n - 1 + images.length) % images.length);
		};
		window.addEventListener("keydown", onKey);
		return () => {
			el.removeEventListener("touchstart", onStart);
			el.removeEventListener("touchmove", onMove);
			el.removeEventListener("touchend", onEnd);
			el.removeEventListener("touchcancel", onEnd);
			window.removeEventListener("keydown", onKey);
			window.clearTimeout(tapTimer);
		};
	}, [images.length]);

	const zoomAt = (clientX: number, clientY: number) => {
		if (scale > 1.05) {
			setScale(1);
			setPos({ x: 0, y: 0 });
			return;
		}
		const rect = box.current?.getBoundingClientRect();
		if (!rect) {
			setScale(2.5);
			return;
		}
		setScale(2.5);
		setPos({
			x: -(clientX - rect.left - rect.width / 2) * 0.45,
			y: -(clientY - rect.top - rect.height / 2) * 0.45,
		});
	};

	return createPortal(
		<div className="fixed inset-0 z-[3000] bg-black" style={{ touchAction: "none" }}>
			<button
				type="button"
				aria-label="关闭"
				className={closeBtn}
				style={{ top: "max(12px, env(safe-area-inset-top))", right: "max(12px, env(safe-area-inset-right))" }}
				onClick={onClose}
			>
				×
			</button>
			{images.length > 1 && (
				<div
					className="pointer-events-none absolute inset-x-0 z-20 text-center text-[15px] text-white/90"
					style={{ top: "max(18px, env(safe-area-inset-top))" }}
				>
					{index + 1}/{images.length}
				</div>
			)}
			<div
				ref={box}
				className="flex h-full w-full items-center justify-center overflow-hidden"
				onClick={(e) => {
					if (skipClick.current) {
						skipClick.current = false;
						return;
					}
					if (e.detail > 1) return;
					window.clearTimeout(mouseTimer.current);
					mouseTimer.current = window.setTimeout(() => closeRef.current(), 260);
				}}
				onDoubleClick={(e) => {
					window.clearTimeout(mouseTimer.current);
					zoomAt(e.clientX, e.clientY);
				}}
			>
				<img
					src={urls[index] || ""}
					alt=""
					draggable={false}
					className="max-h-full max-w-full object-contain"
					style={{ transform: `translate(${pos.x + drag}px, ${pos.y}px) scale(${scale})` }}
				/>
			</div>
		</div>,
		document.body,
	);
};

/** 全屏播放朋友圈视频。playsInline，带系统控件，关闭按钮在安全区外。 */
export const MomentVideoViewer = ({
	poster,
	file,
	onClose,
}: {
	poster: string;
	file?: string;
	onClose: () => void;
}) => {
	const ref = useRef<HTMLVideoElement>(null);
	const [src, setSrc] = useState("");
	const [posterUrl, setPosterUrl] = useState("");

	useEffect(() => {
		let on = true;
		void initDBImagesCacheStore().then(() => {
			if (!on) return;
			setPosterUrl(assetUrl(poster));
			setSrc(file ? assetUrl(file) : "");
		});
		return () => {
			on = false;
		};
	}, [poster, file]);

	useEffect(() => {
		const node = ref.current;
		if (!node || !src) return;
		const play = node.play();
		if (play) play.catch(() => undefined);
	}, [src]);

	return createPortal(
		<div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black" onClick={onClose}>
			<button
				type="button"
				aria-label="关闭"
				className={closeBtn}
				style={{ top: "max(12px, env(safe-area-inset-top))", right: "max(12px, env(safe-area-inset-right))" }}
				onClick={onClose}
			>
				×
			</button>
			{src ? (
				<video
					ref={ref}
					src={src}
					poster={posterUrl || undefined}
					controls
					playsInline
					autoPlay
					className="max-h-full max-w-full"
					onClick={(e) => e.stopPropagation()}
				/>
			) : (
				<img src={posterUrl} alt="" className="max-h-full max-w-full object-contain" />
			)}
		</div>,
		document.body,
	);
};
