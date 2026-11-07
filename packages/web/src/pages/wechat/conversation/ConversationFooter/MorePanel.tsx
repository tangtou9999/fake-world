import {
	EConversationType,
	fromLastGenerateUpperText,
	setConversationListValue,
} from "@/stateV2/conversation";
import { touchDialogue } from "@/stateV2/fileHelper";
import { CENTER_LINK, IMAGE_NOTE_LINK } from "@/stateV2/friendRequests";
import { prepareImageAsset, prepareVideoAsset } from "@/utils/media";
import dayjs from "dayjs";
import { nanoid } from "nanoid";
import { type ChangeEvent, type ReactNode, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConversationAPI } from "../context";
import VideoCall from "./VideoCall";
import { profileAtom } from "@/stateV2/profile";
import { useAtomValue } from "jotai";

type ActionProps = {
	label: string;
	icon: ReactNode;
	onClick: () => void;
};

// iOS 微信 8.0.x 的「+」面板：62pt 白色圆角方块，下方 12pt 灰色文字
const Action = ({ label, icon, onClick }: ActionProps) => (
	<button
		type="button"
		className="flex w-[62px] flex-col items-center border-0 bg-transparent p-0"
		onClick={onClick}
	>
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
			d="M2.5 3.8h19a.8.8 0 0 1 .8.8v14.8a.8.8 0 0 1-.8.8h-19a.8.8 0 0 1-.8-.8V4.6a.8.8 0 0 1 .8-.8ZM3.9 5.7v7.4l4.2-4.2 4 4.600 3.100-3.400 5 5.200V5.700Z"
		/>
	</Icon>
);

const CameraIcon = () => (
	<Icon>
		<path
			fillRule="evenodd"
			d="M8.600 3.800h6.800l1.400 2.700h3.500a2 2 0 0 1 2 2v9.700a2 2 0 0 1-2 2H3.700a2 2 0 0 1-2-2V8.500a2 2 0 0 1 2-2h3.500Zm3.400 5.700a3.700 3.700 0 1 0 0 7.400 3.700 3.700 0 0 0 0-7.400Z"
		/>
	</Icon>
);

const LocationIcon = () => (
	<Icon>
		<path
			fillRule="evenodd"
			d="M11.900 1.700a8.100 8.100 0 0 0-8.100 8.100c0 4.300 4.100 9.200 7.200 12.500a1.300 1.300 0 0 0 1.800 0c3.100-3.300 7.200-8.200 7.200-12.500a8.100 8.100 0 0 0-8.100-8.100Zm0 5.400a2.700 2.700 0 1 1 0 5.400 2.700 2.700 0 0 1 0-5.400Z"
		/>
	</Icon>
);

const XiaoweiIcon = () => (
	<Icon>
		<ellipse cx="4.800" cy="9.600" rx="3.200" ry="5.300" />
		<ellipse cx="19.200" cy="9.600" rx="3.200" ry="5.300" />
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

const VideoCallIcon = () => (
	<Icon>
		<path d="M3.700 5.400h11.500a2 2 0 0 1 2 2v9.200a2 2 0 0 1-2 2H3.700a2 2 0 0 1-2-2V7.400a2 2 0 0 1 2-2Z" />
		<path d="M18.500 10.600l3.700-2.900a.7.700 0 0 1 1.100.6v7.400a.7.700 0 0 1-1.100.6l-3.700-2.900Z" />
	</Icon>
);

const RedPacketIcon = () => (
	<Icon>
		<path d="M6.100 2.500h11.800a1.500 1.500 0 0 1 1.800 1.500v16a1.500 1.500 0 0 1-1.500 1.500H6A1.500 1.500 0 0 1 4.300 20V4A1.500 1.500 0 0 1 6.100 2.500Z" />
		<path d="M4.300 7.300c1.900 2.600 4.400 4 7.700 4s5.800-1.400 7.700-4" fill="none" stroke="#fff" strokeWidth="1" />
		<circle cx="12" cy="10.600" r="1.400" fill="#fff" />
	</Icon>
);

const GiftIcon = () => (
	<Icon>
		<path d="M3.500 3.800h17a1.800 1.800 0 0 1 1.800 1.800v11.300a1.800 1.800 0 0 1-1.800 1.800h-10.800l-2.800 3.300v-3.300H3.500a1.800 1.800 0 0 1-1.800-1.800V5.600a1.800 1.800 0 0 1 1.800-1.800Z" />
		<g fill="none" stroke="#fff" strokeWidth="0.950" strokeLinecap="round" strokeLinejoin="round">
			<path d="M1.700 10.800h7.300M15 10.800h7.300" />
			<path d="M12 10.800c-2.600-1.300-3.500-3.800-2-4.800 1.600-.9 2.400 2.500 2 4.800Zm0 0c2.600-1.300 3.500-3.800 2-4.800-1.600-.9-2.400 2.500-2 4.800Z" />
			<path d="M12 10.800l-2.300 3.400M12 10.800l2.300 3.400" />
		</g>
	</Icon>
);

const TransferIcon = () => (
	<Icon>
		<path d="M3.700 9.200h16.500v1.800H3.700Z" />
		<path d="M3.700 10.100l6.500-5.200a.4.4 0 0 1 .6.300v4.900Z" />
		<path d="M3.800 12.800h16.500v1.800H3.800Z" />
		<path d="M20.300 13.900l-6.500 5.200a.4.4 0 0 1-.6-.3v-4.900Z" />
	</Icon>
);

const MorePanel = ({ onSent }: { onSent?: () => void }) => {
	const { t } = useTranslation();
	const { conversationId, scrollConversationListToBtm } = useConversationAPI();
	const navigate = useNavigate();
	const albumRef = useRef<HTMLInputElement>(null);
	const cameraRef = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [page, setPage] = useState(0);
	const [calling, setCalling] = useState(false);
	const friend = useAtomValue(profileAtom(conversationId));

	const endCall = (sec: number) => {
		setCalling(false);
		const text = sec < 0 ? "已取消" : `通话时长 ${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
		touchDialogue(conversationId, `[视频通话] ${text}`);
		setConversationListValue(conversationId, (prev) => [
			...prev,
			{
				type: EConversationType.text,
				role: "mine",
				id: nanoid(8),
				sendTimestamp: dayjs().valueOf(),
				upperText: fromLastGenerateUpperText(prev),
				textContent: [{ type: "paragraph", children: [{ text: `📹 ${text}` }] }],
			} as (typeof prev)[number],
		]);
		scrollConversationListToBtm();
		onSent?.();
	};
	const pagerRef = useRef<HTMLDivElement>(null);

	const appendFile = async (file: File) => {
		setBusy(true);
		setError("");
		try {
			if (file.type.startsWith("video/")) {
				const asset = await prepareVideoAsset(file);
				touchDialogue(conversationId, "[视频]");
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
				touchDialogue(conversationId, "[图片]");
				setConversationListValue(conversationId, (prev) => {
					const next = [
						...prev,
						{
							type: EConversationType.image,
							role: "mine",
							id: nanoid(8),
							sendTimestamp: dayjs().valueOf(),
							upperText: fromLastGenerateUpperText(prev),
							...asset,
						},
					] as typeof prev;
					// 新加的好友：发图后微信会提示「将图片 添加到备注」
					const isNewFriend = prev.some(
						(v) => v.type === EConversationType.centerText && v.simpleContent.includes(CENTER_LINK),
					);
					const hinted = prev.some(
						(v) => v.type === EConversationType.centerText && v.simpleContent.includes(IMAGE_NOTE_LINK),
					);
					if (isNewFriend && !hinted) {
						next.push({
							id: nanoid(8),
							type: EConversationType.centerText,
							role: "friend",
							simpleContent: `将图片 ${IMAGE_NOTE_LINK}`,
							sendTimestamp: dayjs().valueOf(),
						} as (typeof prev)[number]);
					}
					return next;
				});
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
		<div className="h-full overflow-y-auto bg-[#F7F7F7] px-[23px] pt-4">
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
			<div
				ref={pagerRef}
				className="-mx-[23px] flex snap-x snap-mandatory overflow-x-auto [&::-webkit-scrollbar]:hidden"
				style={{ scrollbarWidth: "none" }}
				onScroll={(e) => {
					const el = e.currentTarget;
					setPage(Math.round(el.scrollLeft / el.clientWidth));
				}}
			>
				<div className="grid w-full shrink-0 snap-start grid-cols-[repeat(4,62px)] content-start justify-between gap-y-[7px] px-[23px]">
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
						label={t("wechatPage.chatPlus.videoCall")}
						icon={<VideoCallIcon />}
						onClick={() => setCalling(true)}
					/>
					<Action
						label={t("wechatPage.chatPlus.location")}
						icon={<LocationIcon />}
						onClick={() => undefined}
					/>
					<Action
						label={t("wechatPage.chatPlus.redPacket")}
						icon={<RedPacketIcon />}
						onClick={() => navigate(`/wechat/conversation/${conversationId}/red-packet`)}
					/>
					<Action label={t("wechatPage.chatPlus.gift", "礼物")} icon={<GiftIcon />} onClick={() => undefined} />
					<Action
						label={t("wechatPage.chatPlus.transfer")}
						icon={<TransferIcon />}
						onClick={() => navigate(`/wechat/conversation/${conversationId}/transfer`)}
					/>
					<Action
						label={t("wechatPage.chatPlus.askXiaowei")}
						icon={<XiaoweiIcon />}
						onClick={() => undefined}
					/>
				</div>
				<div className="grid w-full shrink-0 snap-start grid-cols-[repeat(4,62px)] content-start justify-between gap-y-[7px] px-[23px]">
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
			</div>
			<div className="mt-[14px] flex justify-center gap-[10px]">
				{[0, 1].map((i) => (
					<i
						key={i}
						className={`h-[7px] w-[7px] rounded-full ${page === i ? "bg-black/45" : "bg-black/15"}`}
					/>
				))}
			</div>
			{calling && <VideoCall storeKey={`call:${conversationId}`} name={friend?.remark || friend?.nickname || ""} avatar={friend?.avatarInfo ?? ""} onEnd={endCall} />}
			{busy && <div className="mt-4 text-center text-black/45 text-xs">正在处理…</div>}
			{error && <div className="mt-4 text-center text-[#FA5151] text-xs">{error}</div>}
		</div>
	);
};

export default MorePanel;
