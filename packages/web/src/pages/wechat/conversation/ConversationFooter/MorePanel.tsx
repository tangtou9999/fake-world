import {
	EConversationType,
	fromLastGenerateUpperText,
	setConversationListValue,
} from "@/stateV2/conversation";
import { FILE_HELPER_ID } from "@/faker/wechat/user/fileHelper";
import { touchFileHelperDialogue } from "@/stateV2/fileHelper";
import { prepareImageAsset, prepareVideoAsset } from "@/utils/media";
import dayjs from "dayjs";
import { nanoid } from "nanoid";
import { type ChangeEvent, type ReactNode, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useConversationAPI } from "../context";

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

const VideoCallIcon = () => (
	<Icon>
		<path d="M3.8 6.2h10.4a1.8 1.8 0 0 1 1.8 1.8v8a1.8 1.8 0 0 1-1.8 1.8H3.8A1.8 1.8 0 0 1 2 16V8a1.8 1.8 0 0 1 1.8-1.8Zm13.2 4 5-3v9.6l-5-3Z" />
	</Icon>
);

const RedPacketIcon = () => (
	<Icon>
		<path d="M4.4 2.8h15.2a1.4 1.4 0 0 1 1.4 1.4v4.6c-2.4 1.8-5.2 2.8-9 2.8S5.4 10.6 3 8.8V4.2a1.4 1.4 0 0 1 1.4-1.4Z" />
		<path d="M3 11.4c3.2 2 5.6 2.8 9 2.8s5.8-.8 9-2.8v8.4a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 19.8Z" />
		<circle cx="12" cy="11.300" r="1.700" fill="#fff" />
	</Icon>
);

const GiftIcon = () => (
	<Icon>
		<path
			fillRule="evenodd"
			d="M4.2 4.5h15.6A2.2 2.2 0 0 1 22 6.700v8.6a2.2 2.2 0 0 1-2.2 2.2h-7.6L8 20.8v-3.300H4.2A2.2 2.2 0 0 1 2 15.300V6.700a2.2 2.2 0 0 1 2.2-2.2Zm3.700 3.4a1.5 1.5 0 0 0 0 3h3.100V7.900Zm8.2 0h-3.100v3h3.100a1.5 1.5 0 0 0 0-3ZM9.900 12.5v3.2h2.100v-3.2Zm4.2 0h-2.100v3.2h2.100Z"
		/>
	</Icon>
);

const TransferIcon = () => (
	<Icon>
		<path d="M4 7.6h13.4L14.6 4.8l1.2-1.2L21 8.8l-5.2 5.2-1.2-1.2 2.8-2.8H4Z" />
		<path d="M20 16.4H6.6l2.8 2.8-1.2 1.2L3 15.2l5.2-5.2 1.2 1.2-2.8 2.8H20Z" />
	</Icon>
);

type MoneySheetProps = {
	kind: "redPacket" | "transfer";
	onClose: () => void;
	onSend: (params: {
		kind: "redPacket" | "transfer";
		sender: "mine" | "friend";
		amount: string;
		note: string;
		done: boolean;
	}) => void;
};

const Seg = ({
	value,
	options,
	onChange,
}: {
	value: string;
	options: { label: string; value: string }[];
	onChange: (v: string) => void;
}) => (
	<div className="flex rounded-[6px] bg-[#F2F2F2] p-[2px]">
		{options.map((o) => (
			<button
				key={o.value}
				type="button"
				className={`rounded-[5px] px-3 py-1 text-[14px] ${value === o.value ? "bg-white text-black/90 shadow-sm" : "text-black/50"}`}
				onClick={() => onChange(o.value)}
			>
				{o.label}
			</button>
		))}
	</div>
);

const MoneySheet = ({ kind, onClose, onSend }: MoneySheetProps) => {
	const isRed = kind === "redPacket";
	const [sender, setSender] = useState<"mine" | "friend">("mine");
	const [amount, setAmount] = useState("");
	const [note, setNote] = useState(isRed ? "恭喜发财，大吉大利" : "");
	const [done, setDone] = useState(false);
	const valid = /^\d{1,7}(\.\d{1,2})?$/.test(amount) && Number(amount) > 0;

	return (
		<div className="fixed inset-0 z-[1000] flex flex-col justify-end bg-black/50" role="dialog">
			<button type="button" aria-label="关闭" className="min-h-0 flex-1" onClick={onClose} />
			<div className="rounded-t-[12px] bg-white px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
				<div className="grid grid-cols-[40px_1fr_40px] items-center">
					<button type="button" aria-label="关闭" className="text-left text-[22px] text-black/60" onClick={onClose}>
						×
					</button>
					<div className="text-center font-medium text-[17px]">{isRed ? "发红包" : "转账"}</div>
					<div />
				</div>
				<div className="mt-4 flex items-center justify-between text-[15px]">
					<span>发送方</span>
					<Seg
						value={sender}
						onChange={(v) => setSender(v as "mine" | "friend")}
						options={[
							{ label: "我发的", value: "mine" },
							{ label: "对方发的", value: "friend" },
						]}
					/>
				</div>
				<div className="mt-4 flex items-center justify-between rounded-[8px] bg-[#F7F7F7] px-3 py-3">
					<span className="text-[15px]">金额</span>
					<span className="flex items-center text-[24px]">
						¥
						<input
							inputMode="decimal"
							placeholder="0.00"
							value={amount}
							onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
							className="ml-1 w-[130px] bg-transparent text-right outline-none"
						/>
					</span>
				</div>
				<div className="mt-3 flex items-center rounded-[8px] bg-[#F7F7F7] px-3 py-3">
					<span className="w-[48px] shrink-0 text-[15px]">{isRed ? "祝福语" : "备注"}</span>
					<input
						placeholder={isRed ? "恭喜发财，大吉大利" : "添加转账说明"}
						value={note}
						onChange={(e) => setNote(e.target.value)}
						className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
					/>
				</div>
				<div className="mt-3 flex items-center justify-between text-[15px]">
					<span>{isRed ? "红包状态" : "转账状态"}</span>
					<Seg
						value={done ? "done" : "wait"}
						onChange={(v) => setDone(v === "done")}
						options={[
							{ label: isRed ? "待领取" : "待收款", value: "wait" },
							{ label: isRed ? "已领取" : "已收款", value: "done" },
						]}
					/>
				</div>
				<button
					type="button"
					disabled={!valid}
					className={`mt-5 h-[46px] w-full rounded-[8px] font-medium text-[17px] text-white ${valid ? (isRed ? "bg-[#E7432F]" : "bg-[#07C160]") : "bg-black/15"}`}
					onClick={() =>
						valid &&
						onSend({
							kind,
							sender,
							amount: Number(amount).toFixed(2),
							note: note.trim(),
							done,
						})
					}
				>
					{isRed ? "塞钱进红包" : "转账"}
				</button>
			</div>
		</div>
	);
};

const MorePanel = ({ onSent }: { onSent?: () => void }) => {
	const { t } = useTranslation();
	const { conversationId, scrollConversationListToBtm } = useConversationAPI();
	const albumRef = useRef<HTMLInputElement>(null);
	const cameraRef = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [money, setMoney] = useState<null | "redPacket" | "transfer">(null);
	const [page, setPage] = useState(0);
	const pagerRef = useRef<HTMLDivElement>(null);

	const sendMoney = (params: {
		kind: "redPacket" | "transfer";
		sender: "mine" | "friend";
		amount: string;
		note: string;
		done: boolean;
	}) => {
		const base = {
			id: nanoid(8),
			role: params.sender,
			originalSender: params.sender,
			amount: params.amount,
			note: params.note || undefined,
			sendTimestamp: dayjs().valueOf(),
		} as const;
		setConversationListValue(conversationId, (prev) => [
			...prev,
			params.kind === "redPacket"
				? {
						...base,
						type: EConversationType.redPacket,
						redPacketStatus: params.done ? "accepted" : "awaiting",
						upperText: fromLastGenerateUpperText(prev),
					}
				: {
						...base,
						type: EConversationType.transfer,
						transferStatus: params.done ? "accepted" : "awaiting",
						upperText: fromLastGenerateUpperText(prev),
					},
		]);
		if (conversationId === FILE_HELPER_ID) {
			touchFileHelperDialogue(params.kind === "redPacket" ? "[红包]" : "[转账]");
		}
		setMoney(null);
		scrollConversationListToBtm();
		onSent?.();
	};

	const appendFile = async (file: File) => {
		setBusy(true);
		setError("");
		try {
			if (file.type.startsWith("video/")) {
				const asset = await prepareVideoAsset(file);
				if (conversationId === FILE_HELPER_ID) touchFileHelperDialogue("[视频]");
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
				if (conversationId === FILE_HELPER_ID) touchFileHelperDialogue("[图片]");
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
						onClick={() => undefined}
					/>
					<Action
						label={t("wechatPage.chatPlus.location")}
						icon={<LocationIcon />}
						onClick={() => undefined}
					/>
					<Action
						label={t("wechatPage.chatPlus.redPacket")}
						icon={<RedPacketIcon />}
						onClick={() => setMoney("redPacket")}
					/>
					<Action label={t("wechatPage.chatPlus.gift", "礼物")} icon={<GiftIcon />} onClick={() => undefined} />
					<Action
						label={t("wechatPage.chatPlus.transfer")}
						icon={<TransferIcon />}
						onClick={() => setMoney("transfer")}
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
			{money &&
				createPortal(
					<MoneySheet kind={money} onClose={() => setMoney(null)} onSend={sendMoney} />,
					document.body,
				)}
			{busy && <div className="mt-4 text-center text-black/45 text-xs">正在处理…</div>}
			{error && <div className="mt-4 text-center text-[#FA5151] text-xs">{error}</div>}
		</div>
	);
};

export default MorePanel;
