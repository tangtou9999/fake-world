import AlbumOutlinedSVG from "@/assets/album-outlined.svg?react";
import CameraOutlinedSVG from "@/assets/camera-outlined.svg?react";
import FavoritesSVG from "@/assets/favorites.svg?react";
import Transfer2OutlinedSVG from "@/assets/transfer2-outlined.svg?react";
import VideoCallOutlinedSVG from "@/assets/video-call-outlined.svg?react";
import VoiceOutlinedSVG from "@/assets/voice-outlined.svg?react";
import {
	EConversationType,
	fromLastGenerateUpperText,
	setConversationListValue,
} from "@/stateV2/conversation";
import { prepareImageAsset, prepareVideoAsset } from "@/utils/media";
import dayjs from "dayjs";
import { nanoid } from "nanoid";
import { type ChangeEvent, type ReactNode, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useConversationAPI } from "../context";

type ActionProps = {
	label: string;
	icon: ReactNode;
	onClick: () => void;
};

const Action = ({ label, icon, onClick }: ActionProps) => (
	<button type="button" className="flex flex-col items-center gap-1.5" onClick={onClick}>
		<span className="flex h-[60px] w-[60px] items-center justify-center rounded-[14px] bg-white text-black">
			{icon}
		</span>
		<span className="text-[11px] text-black/50 leading-none">{label}</span>
	</button>
);

const iconClass = "h-7 w-7";

const MorePanel = ({ onSent }: { onSent?: () => void }) => {
	const { t } = useTranslation();
	const { conversationId, scrollConversationListToBtm } = useConversationAPI();
	const albumRef = useRef<HTMLInputElement>(null);
	const cameraRef = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	const appendFile = async (file: File) => {
		setBusy(true);
		setError("");
		try {
			if (file.type.startsWith("video/")) {
				const asset = await prepareVideoAsset(file);
				setConversationListValue(conversationId, (prev) => [
					...prev,
					{
						type: EConversationType.video,
						role: "mine",
						id: nanoid(8),
						sendTimestamp: dayjs().valueOf(),
						upperText: fromLastGenerateUpperText(prev),
						...asset,
					},
				]);
			} else if (file.type.startsWith("image/")) {
				const asset = await prepareImageAsset(file);
				setConversationListValue(conversationId, (prev) => [
					...prev,
					{
						type: EConversationType.image,
						role: "mine",
						id: nanoid(8),
						sendTimestamp: dayjs().valueOf(),
						upperText: fromLastGenerateUpperText(prev),
						...asset,
					},
				]);
			} else {
				setError("请选择图片或视频");
				return;
			}
			scrollConversationListToBtm();
			onSent?.();
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "无法读取文件");
		} finally {
			setBusy(false);
		}
	};

	const onPick = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.item(0);
		event.target.value = "";
		if (file) void appendFile(file);
	};

	return (
		<div className="h-[350px] overflow-y-auto bg-[#F6F6F6] px-6 pt-6">
			<input
				ref={albumRef}
				type="file"
				accept="image/*,video/*"
				className="hidden"
				onChange={onPick}
			/>
			<input
				ref={cameraRef}
				type="file"
				accept="image/*"
				capture="environment"
				className="hidden"
				onChange={onPick}
			/>
			<div className="grid grid-cols-4 gap-x-3 gap-y-5">
				<Action
					label={t("wechatPage.chatPlus.album")}
					icon={<AlbumOutlinedSVG className={iconClass} fill="black" />}
					onClick={() => albumRef.current?.click()}
				/>
				<Action
					label={t("wechatPage.chatPlus.camera")}
					icon={<CameraOutlinedSVG className={iconClass} fill="black" />}
					onClick={() => cameraRef.current?.click()}
				/>
				<Action
					label={t("wechatPage.chatPlus.videoCall")}
					icon={<VideoCallOutlinedSVG className={iconClass} fill="black" />}
					onClick={() => undefined}
				/>
				<Action
					label={t("wechatPage.chatPlus.location")}
					icon={
						<svg
							viewBox="0 0 24 24"
							className={iconClass}
							fill="black"
							role="img"
							aria-label={t("wechatPage.chatPlus.location")}
						>
							<title>{t("wechatPage.chatPlus.location")}</title>
							<path d="M12 2.5a6.5 6.5 0 0 0-6.5 6.5c0 4.7 6.5 12.5 6.5 12.5s6.5-7.8 6.5-12.5A6.5 6.5 0 0 0 12 2.5Zm0 8.8a2.3 2.3 0 1 1 0-4.6 2.3 2.3 0 0 1 0 4.6Z" />
						</svg>
					}
					onClick={() => undefined}
				/>
				<Action
					label={t("wechatPage.chatPlus.redPacket")}
					icon={
						<svg
							viewBox="0 0 24 24"
							className={iconClass}
							role="img"
							aria-label={t("wechatPage.chatPlus.redPacket")}
						>
							<title>{t("wechatPage.chatPlus.redPacket")}</title>
							<path fill="#FA5151" d="M5 4.5h14v15H5z" />
							<path fill="#FA9D3B" d="M5 4.5h14v3.2H5z" />
							<circle cx="12" cy="12.2" r="2.1" fill="#FA9D3B" />
						</svg>
					}
					onClick={() => undefined}
				/>
				<Action
					label={t("wechatPage.chatPlus.transfer")}
					icon={<Transfer2OutlinedSVG className={iconClass} fill="black" />}
					onClick={() => undefined}
				/>
				<Action
					label={t("wechatPage.chatPlus.voiceInput")}
					icon={<VoiceOutlinedSVG className={iconClass} fill="black" />}
					onClick={() => undefined}
				/>
				<Action
					label={t("wechatPage.chatPlus.favorites")}
					icon={<FavoritesSVG className={iconClass} />}
					onClick={() => undefined}
				/>
			</div>
			{busy && <div className="mt-4 text-center text-black/45 text-xs">正在处理…</div>}
			{error && <div className="mt-4 text-center text-[#FA5151] text-xs">{error}</div>}
		</div>
	);
};

export default MorePanel;
