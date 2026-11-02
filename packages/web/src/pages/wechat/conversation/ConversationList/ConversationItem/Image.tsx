import PlayFilledSVG from "@/assets/play-filled.svg?react";
import { h } from "@/components/HashAssets";
import { IMAGES_CACHE, initDBImagesCacheStore } from "@/db";
import type { IConversationTypeImage, ICoversationTypeVideo } from "@/stateV2/conversation";
import { getModeValueSnapshot } from "@/stateV2/mode";
import type { IStateProfile } from "@/stateV2/profile";
import { isMD5 } from "@/utils";
import { formatMediaDuration } from "@/utils/media";
import { type MouseEvent, memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import CommonBlock from "./CommonBlock";

type Props = {
	imageInfo: IConversationTypeImage["imageInfo"];
	upperText: IConversationTypeImage["upperText"];
	senderId: IStateProfile["id"];
	role: IConversationTypeImage["role"];
	isVideo?: boolean;
	videoFile?: ICoversationTypeVideo["videoFile"];
	duration?: ICoversationTypeVideo["duration"];
};

const MAX_EDGE = 168;
const MIN_EDGE = 72;

function fitEdge(width: number, height: number) {
	if (!width || !height) return { width: 120, height: 160 };
	const scale = MAX_EDGE / Math.max(width, height);
	let nextW = Math.round(width * scale);
	let nextH = Math.round(height * scale);
	const longEdge = Math.max(nextW, nextH);
	if (longEdge < MIN_EDGE) {
		const bump = MIN_EDGE / longEdge;
		nextW = Math.round(nextW * bump);
		nextH = Math.round(nextH * bump);
	}
	return {
		width: Math.min(MAX_EDGE, Math.max(48, nextW)),
		height: Math.min(MAX_EDGE, Math.max(48, nextH)),
	};
}

function resolveAsset(value?: string) {
	if (!value) return "";
	if (isMD5(value)) return IMAGES_CACHE.get(value) ?? "";
	return value;
}

const Image = ({ imageInfo, upperText, senderId, isVideo, videoFile, duration }: Props) => {
	const [box, setBox] = useState({ width: 120, height: 160 });
	const [posterSrc, setPosterSrc] = useState("");
	const [videoSrc, setVideoSrc] = useState("");
	const [open, setOpen] = useState(false);
	const durationLabel = isVideo ? formatMediaDuration(duration) : "";

	useEffect(() => {
		let cancelled = false;
		const measure = (src: string) => {
			if (!src || cancelled) return;
			setPosterSrc(src);
			const img = new window.Image();
			img.onload = () => {
				if (!cancelled) setBox(fitEdge(img.naturalWidth, img.naturalHeight));
			};
			img.src = src;
		};
		if (isMD5(imageInfo)) {
			initDBImagesCacheStore().then(() => {
				if (!cancelled) measure(resolveAsset(imageInfo));
			});
		} else {
			measure(imageInfo);
		}
		return () => {
			cancelled = true;
		};
	}, [imageInfo]);

	useEffect(() => {
		let cancelled = false;
		if (!videoFile) {
			setVideoSrc("");
			return;
		}
		if (isMD5(videoFile)) {
			initDBImagesCacheStore().then(() => {
				if (!cancelled) setVideoSrc(resolveAsset(videoFile));
			});
		} else {
			setVideoSrc(videoFile);
		}
		return () => {
			cancelled = true;
		};
	}, [videoFile]);

	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open]);

	const openViewer = (event: MouseEvent) => {
		if (getModeValueSnapshot() === "edit") return;
		event.stopPropagation();
		setOpen(true);
	};

	return (
		<CommonBlock
			upperText={upperText}
			senderId={senderId}
			innerBlockClassName="before:hidden bg-transparent p-0"
		>
			<button
				type="button"
				className="relative block cursor-pointer overflow-hidden rounded-[4px] border-0 bg-black/5 p-0 outline-none focus:outline-none"
				style={{ width: box.width, height: box.height }}
				onClick={openViewer}
			>
				<h.img src={imageInfo} className="h-full w-full object-cover object-center" />
				{isVideo && (
					<>
						<span className="pointer-events-none absolute inset-0 flex items-center justify-center">
							<span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35">
								<PlayFilledSVG fill="white" width={22} height={22} className="ml-0.5" />
							</span>
						</span>
						{durationLabel && (
							<span className="pointer-events-none absolute right-1.5 bottom-1 text-[11px] text-white leading-none [text-shadow:0_1px_2px_rgba(0,0,0,.65)]">
								{durationLabel}
							</span>
						)}
					</>
				)}
			</button>
			{open &&
				createPortal(
					<div
						className="fixed inset-0 z-[3000] flex items-center justify-center bg-black"
						onClick={() => setOpen(false)}
					>
						<button
							type="button"
							className="absolute top-4 right-4 z-10 px-2 text-3xl text-white leading-none"
							onClick={() => setOpen(false)}
						>
							×
						</button>
						{isVideo && videoSrc ? (
							<video
								src={videoSrc}
								poster={posterSrc || undefined}
								controls
								autoPlay
								playsInline
								className="max-h-full max-w-full"
								onClick={(event) => event.stopPropagation()}
							>
								<track kind="captions" />
							</video>
						) : (
							<img
								src={posterSrc || resolveAsset(imageInfo)}
								className="max-h-full max-w-full object-contain"
								alt=""
							/>
						)}
					</div>,
					document.body,
				)}
		</CommonBlock>
	);
};

export default memo(Image);
