import { hashAssetsDB } from "@/db";
import { getFileMD5 } from "@/utils";

/** IndexedDB can hold the file; localStorage cannot. 50MB keeps a chat usable. */
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const IMAGE_MAX_BYTES = 20 * 1024 * 1024;

export async function storeAssetFile(file: File) {
	const hash = await getFileMD5(file);
	await hashAssetsDB.images.put({ id: hash, file });
	return hash;
}

function waitEvent(target: EventTarget, event: string) {
	return new Promise<void>((resolve, reject) => {
		const onError = () => {
			cleanup();
			reject(new Error("无法读取视频"));
		};
		const onOk = () => {
			cleanup();
			resolve();
		};
		const cleanup = () => {
			target.removeEventListener(event, onOk);
			target.removeEventListener("error", onError);
		};
		target.addEventListener(event, onOk, { once: true });
		target.addEventListener("error", onError, { once: true });
	});
}

/** First frame plus duration. The poster is a JPEG stored beside the video. */
export async function captureVideoPoster(file: File) {
	const url = URL.createObjectURL(file);
	const video = document.createElement("video");
	video.preload = "auto";
	video.muted = true;
	video.playsInline = true;
	video.src = url;
	try {
		await waitEvent(video, "loadeddata");
		const duration = Number.isFinite(video.duration) ? video.duration : 0;
		if (duration > 0.15) {
			video.currentTime = Math.min(0.15, duration / 2);
			await waitEvent(video, "seeked");
		}
		const sourceW = video.videoWidth || 320;
		const sourceH = video.videoHeight || 180;
		const scale = Math.min(1, 720 / Math.max(sourceW, sourceH));
		const canvas = document.createElement("canvas");
		canvas.width = Math.max(1, Math.round(sourceW * scale));
		canvas.height = Math.max(1, Math.round(sourceH * scale));
		const context = canvas.getContext("2d");
		if (!context) throw new Error("无法生成视频封面");
		context.drawImage(video, 0, 0, canvas.width, canvas.height);
		const blob = await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(result) => (result ? resolve(result) : reject(new Error("无法生成视频封面"))),
				"image/jpeg",
				0.85,
			);
		});
		const poster = new File([blob], "poster.jpg", { type: "image/jpeg" });
		return { duration, poster };
	} finally {
		URL.revokeObjectURL(url);
		video.src = "";
	}
}

export async function prepareImageAsset(file: File) {
	if (!file.type.startsWith("image/")) {
		throw new Error("请选择图片");
	}
	if (file.size > IMAGE_MAX_BYTES) {
		throw new Error(`图片不能超过 ${IMAGE_MAX_BYTES / 1024 / 1024}MB`);
	}
	return { imageInfo: await storeAssetFile(file) };
}

export async function prepareVideoAsset(file: File) {
	if (!file.type.startsWith("video/")) {
		throw new Error("请选择视频");
	}
	if (file.size > VIDEO_MAX_BYTES) {
		throw new Error(`视频不能超过 ${VIDEO_MAX_BYTES / 1024 / 1024}MB，已避免写入本地存储`);
	}
	const { duration, poster } = await captureVideoPoster(file);
	const [videoFile, videoInfo] = await Promise.all([storeAssetFile(file), storeAssetFile(poster)]);
	return { videoFile, videoInfo, duration };
}

export function formatMediaDuration(seconds?: number) {
	if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "";
	const total = Math.round(seconds);
	const minutes = Math.floor(total / 60);
	const remain = total % 60;
	return `${minutes}:${remain.toString().padStart(2, "0")}`;
}
