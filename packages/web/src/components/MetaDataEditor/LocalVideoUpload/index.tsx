import HashAssets from "@/components/HashAssets";
import { formatMediaDuration, prepareVideoAsset } from "@/utils/media";
import { type ChangeEvent, useState } from "react";

export type VideoAssetValue = {
	videoFile?: string;
	videoInfo?: string;
	duration?: number;
};

type Props = {
	value?: VideoAssetValue;
	onChange?: (value: VideoAssetValue) => void;
};

const LocalVideoUpload = ({ value, onChange }: Props) => {
	const [local, setLocal] = useState<VideoAssetValue | undefined>();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const shown = local ?? value;

	const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.item(0);
		try {
			event.target.value = "";
		} catch {
			// File inputs can reject programmatic value changes.
		}
		if (!file) return;
		setBusy(true);
		setError("");
		try {
			const next = await prepareVideoAsset(file);
			setLocal(next);
			onChange?.(next);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "无法读取视频");
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex flex-col gap-2">
			<input type="file" accept="video/*" disabled={busy} onChange={handleChange} />
			<div className="text-gray-500 text-xs">
				从本机选择视频。文件和封面写入 IndexedDB，单条不超过
				50MB。发送方在上方「消息由谁发送」里选择。
			</div>
			{busy && <div className="text-xs">正在读取视频并生成封面…</div>}
			{error && <div className="text-red-500 text-xs">{error}</div>}
			{shown?.videoInfo && (
				<HashAssets
					src={shown.videoInfo}
					className="h-28 w-28 overflow-hidden object-cover"
					useAntdImageComponent
				/>
			)}
			{shown?.duration ? (
				<div className="text-xs">时长 {formatMediaDuration(shown.duration)}</div>
			) : null}
			{shown?.videoInfo && !shown.videoFile && (
				<div className="text-xs">这条是旧的封面消息，重新选择视频后可以播放。</div>
			)}
		</div>
	);
};

export default LocalVideoUpload;
