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

// iOS 微信 8.0.x 的「+」面板：62pt 白色圆角方块，下方 12pt 灰色文字
const Action = ({ label, icon, onClick }: ActionProps) => (
	<button type="button" className="flex w-[62px] flex-col items-center" onClick={onClick}>
		<span className="flex h-[62px] w-[62px] items-center justify-center rounded-[15px] bg-white text-[#4C4C4C]">
			{icon}
		</span>
		<span className="mt-[9px] whitespace-nowrap text-[12px] text-black/50 leading-[14px]">
			{label}
		</span>
	</button>
);

const Icon = ({ children }: { children: ReactNode }) => (
	<svg viewBox="0 0 24 24" className="h-[30px] w-[30px]" fill="currentColor" aria-hidden="true">
		{children}
	</svg>
);

const PhotoIcon = () => (
	<Icon>
		<path
			fillRule="evenodd"
			d="M4 3.8h16a1.7 1.7 0 0 1 1.7 1.7v13A1.7 1.7 0 0 1 20 20.2H4a1.7 1.7 0 0 1-1.7-1.7v-13A1.7 1.7 0 0 1 4 3.8Zm4.3 3.3a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8ZM4.2 17.8h15.6v-1.4l-4.5-5-3.6 3.8-2.4-2.2-5.1 4.4Z"
		/>
	</Icon>
);

const CameraIcon = () => (
	<Icon>
		<path
			fillRule="evenodd"
			d="M8.6 4h6.8l1.4 2.1H20A1.7 1.7 0 0 1 21.7 7.8v10.5A1.7 1.7 0 0 1 20 20H4a1.7 1.7 0 0 1-1.7-1.7V7.8A1.7 1.7 0 0 1 4 6.1h3.2L8.6 4ZM12 8.6a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4Zm0 2a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4Z"
		/>
	</Icon>
);

const LocationIcon = () => (
	<Icon>
		<path
			fillRule="evenodd"
			d="M12 2.3a6.7 6.7 0 0 0-6.7 6.7c0 4.8 6.7 12.7 6.7 12.7s6.7-7.9 6.7-12.7A6.7 6.7 0 0 0 12 2.3Zm0 9.1a2.4 2.4 0 1 1 0-4.8 2.4 2.4 0 0 1 0 4.8Z"
		/>
	</Icon>
);

const XiaoweiIcon = () => (
	<Icon>
		<ellipse cx="8" cy="11" rx="2.5" ry="3.2" />
		<ellipse cx="16" cy="11" rx="2.5" ry="3.2" />
	</Icon>
);

const FavoritesIcon = () => (
	<Icon>
		<path d="M12 2.8 19.7 7.2 12 11.6 4.3 7.2Z" />
		<path d="M3.8 8.7 11.3 13v8L3.8 16.7Z" />
		<path d="M20.2 8.7v8L12.7 21v-8Z" />
	</Icon>
);

const CardIcon = () => (
	<Icon>
		<circle cx="12" cy="7.8" r="4.4" />
		<path d="M3.6 20.6c0-4.4 3.7-7 8.4-7s8.4 2.6 8.4 7v.1H3.6Z" />
	</Icon>
);

const FileIcon = () => (
	<Icon>
		<path d="M2.6 6.3A1.8 1.8 0 0 1 4.4 4.5h5l1.8 2.1h8.4a1.8 1.8 0 0 1 1.8 1.8v1H2.6Z" />
		<path d="M2.6 10.9h18.8v7.3a1.8 1.8 0 0 1-1.8 1.8H4.4a1.8 1.8 0 0 1-1.8-1.8Z" />
	</Icon>
);

const MusicIcon = () => (
	<Icon>
		<path d="M9.2 4.2 19.4 2.6v12.7a3.5 3.5 0 1 1-2-3.2V7l-6.2 1v9.4a3.5 3.5 0 1 1-2-3.2Z" />
	</Icon>
);

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
		<div className="h-[350px] overflow-y-auto bg-[#F6F6F6] px-[23px] pt-4">
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
			<div className="grid grid-cols-[repeat(4,62px)] justify-between gap-y-2">
				<Action
					label={t("wechatPage.chatPlus.photos")}
					icon={<PhotoIcon />}
					onClick={() => albumRef.current?.click()}
				/>
				<Action
					label={t("wechatPage.chatPlus.camera")}
					icon={<CameraIcon />}
					onClick={() => cameraRef.current?.click()}
				/>
				<Action
					label={t("wechatPage.chatPlus.location")}
					icon={<LocationIcon />}
					onClick={() => undefined}
				/>
				<Action
					label={t("wechatPage.chatPlus.askXiaowei")}
					icon={<XiaoweiIcon />}
					onClick={() => undefined}
				/>
				<Action
					label={t("wechatPage.chatPlus.favorites")}
					icon={<FavoritesIcon />}
					onClick={() => undefined}
				/>
				<Action
					label={t("wechatPage.chatPlus.contactCard")}
					icon={<CardIcon />}
					onClick={() => undefined}
				/>
				<Action
					label={t("wechatPage.chatPlus.file")}
					icon={<FileIcon />}
					onClick={() => undefined}
				/>
				<Action
					label={t("wechatPage.chatPlus.music")}
					icon={<MusicIcon />}
					onClick={() => undefined}
				/>
			</div>
			{busy && <div className="mt-4 text-center text-black/45 text-xs">正在处理…</div>}
			{error && <div className="mt-4 text-center text-[#FA5151] text-xs">{error}</div>}
		</div>
	);
};

export default MorePanel;
