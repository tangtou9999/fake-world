import { hashAssetsDB } from "@/db";
import { getFileMD5 } from "@/utils";

/** IndexedDB can hold the file; localStorage cannot. 300MB. */
export const VIDEO_MAX_BYTES = 300 * 1024 * 1024;
export const IMAGE_MAX_BYTES = 20 * 1024 * 1024;

/** 大文件不整个读进内存算 MD5：只取头、中、尾各 1MB 加文件大小，手机上也很快 */
async function fileKey(file: File) {
	const MB = 1024 * 1024;
	if (file.size <= 8 * MB) return getFileMD5(file);
	const part = (start: number) => file.slice(start, start + MB);
	const mid = Math.floor(file.size / 2) - MB / 2;
	const sample = new File(
		[part(0), part(mid), part(file.size - MB), new TextEncoder().encode(`:${file.size}`)],
		"k",
	);
	return getFileMD5(sample);
}

export async function storeAssetFile(file: File) {
	const hash = await fileKey(file);
	await hashAssetsDB.images.put({ id: hash, file });
	return hash;
}

function waitEvent(target: EventTarget, event: string, timeoutMs = 8000) {
	return new Promise<void>((resolve, reject) => {
		const timer = window.setTimeout(() => {
			cleanup();
			reject(new Error("timeout"));
		}, timeoutMs);
		const onError = () => {
			cleanup();
			reject(new Error("无法读取视频"));
		};
		const onOk = () => {
			cleanup();
			resolve();
		};
		const cleanup = () => {
			window.clearTimeout(timer);
			target.removeEventListener(event, onOk);
			target.removeEventListener("error", onError);
		};
		target.addEventListener(event, onOk, { once: true });
		target.addEventListener("error", onError, { once: true });
	});
}

const placeholderPoster = async () => {
	const canvas = document.createElement("canvas");
	canvas.width = 360;
	canvas.height = 640;
	const g = canvas.getContext("2d");
	if (g) {
		g.fillStyle = "#222";
		g.fillRect(0, 0, canvas.width, canvas.height);
	}
	const blob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((r) => (r ? resolve(r) : reject(new Error("无法生成视频封面"))), "image/jpeg", 0.8);
	});
	return new File([blob], "poster.jpg", { type: "image/jpeg" });
};

/**
 * 首帧封面 + 时长。iPhone 上读取封面经常等不到事件（或遇到不支持的编码），
 * 所以每一步都有超时；抓不到封面就用深色占位图，视频本身照样能存、能播。
 */
export async function captureVideoPoster(file: File) {
	const url = URL.createObjectURL(file);
	const video = document.createElement("video");
	video.preload = "auto";
	video.muted = true;
	video.playsInline = true;
	video.setAttribute("playsinline", "");
	video.src = url;
	try {
		let duration = 0;
		try {
			await Promise.race([waitEvent(video, "loadeddata"), waitEvent(video, "loadedmetadata")]);
		} catch {
			// 超时/出错：下面用占位封面
		}
		duration = Number.isFinite(video.duration) ? video.duration : 0;
		if (!video.videoWidth) return { duration, poster: await placeholderPoster() };
		try {
			if (duration > 0.15) {
				video.currentTime = Math.min(0.15, duration / 2);
				await waitEvent(video, "seeked", 3000);
			}
		} catch {
			// 抓不到指定帧就用当前帧
		}
		try {
			const sourceW = video.videoWidth || 320;
			const sourceH = video.videoHeight || 180;
			const scale = Math.min(1, 720 / Math.max(sourceW, sourceH));
			const canvas = document.createElement("canvas");
			canvas.width = Math.max(1, Math.round(sourceW * scale));
			canvas.height = Math.max(1, Math.round(sourceH * scale));
			const context = canvas.getContext("2d");
			if (!context) throw new Error("no ctx");
			context.drawImage(video, 0, 0, canvas.width, canvas.height);
			const blob = await new Promise<Blob>((resolve, reject) => {
				canvas.toBlob((r) => (r ? resolve(r) : reject(new Error("no blob"))), "image/jpeg", 0.85);
			});
			return { duration, poster: new File([blob], "poster.jpg", { type: "image/jpeg" }) };
		} catch {
			return { duration, poster: await placeholderPoster() };
		}
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
