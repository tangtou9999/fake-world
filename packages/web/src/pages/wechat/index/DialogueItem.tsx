import { PAY_ID } from "@/stateV2/payService";
import MUTED_SVG from "@/assets/muted.svg";
import Badge from "@/components/Badge";
import { h } from "@/components/HashAssets";
import { canBeDetected } from "@/components/NodeDetected";
import TopOperations from "@/components/TopOperations";
import { conversationListAtom } from "@/stateV2/conversation";
import { EMetaDataType } from "@/stateV2/detectedNode";
import { type IDialogueItem, dialogueItemAtom, dialogueListAtom } from "@/stateV2/dialogueList";
import { profileAtom } from "@/stateV2/profile";
import { Modal } from "antd";
import { useAtomValue, useSetAtom } from "jotai";
import { RESET } from "jotai/utils";
import { memo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { twMerge } from "tailwind-merge";
import styles from "./style.module.scss";

type Props = {
	itemId: IDialogueItem["id"];
	className?: string;
};

const DialogueItem = ({ itemId, className }: Props) => {
	const {
		friendId,
		id,
		isPinned,
		unreadDisplayType,
		unreadMarkNumber,
		isMuted,
		badgeHide,
		lastMessage,
		lastMessageTime,
	} = useAtomValue(dialogueItemAtom(itemId))!;
	const friendProfile = useAtomValue(profileAtom(friendId))!;
	const setConversationList = useSetAtom(conversationListAtom(friendId));
	const setDialogueList = useSetAtom(dialogueListAtom);
	const navigate = useNavigate();

	const { nickname, avatarInfo, remark } = friendProfile;
	const [sheet, setSheet] = useState(false);
	const pressTimer = useRef<ReturnType<typeof setTimeout>>();
	const pressed = useRef(false);
	const startPress = () => {
		pressed.current = false;
		pressTimer.current = setTimeout(() => {
			pressed.current = true;
			setSheet(true);
		}, 500);
	};
	const cancelPress = () => clearTimeout(pressTimer.current);

	/** 置顶 / 取消置顶：置顶的排最前面，取消后放到置顶区的下面 */
	const togglePin = () => {
		setDialogueList((prev) => {
			const updated = prev.map((v) => (v.id === id ? { ...v, isPinned: !v.isPinned } : v));
			const target = updated.find((v) => v.id === id)!;
			const rest = updated.filter((v) => v.id !== id);
			const pinned = rest.filter((v) => v.isPinned);
			const normal = rest.filter((v) => !v.isPinned);
			return target.isPinned ? [target, ...pinned, ...normal] : [...pinned, target, ...normal];
		});
		setSheet(false);
	};

	const handleOperationDelete = () => {
		Modal.confirm({
			title: "是否删除该对话项？",
			content: "这将删除与该对话的聊天记录",
			onOk: () => {
				setDialogueList((prev) => prev.filter((v) => v.id !== id));
				setConversationList(RESET);
			},
		});
	};

	return (
		<canBeDetected.div
			className={twMerge(
				"relative flex min-h-[72px] cursor-pointer items-center px-4 py-3 after:pointer-events-none after:absolute after:bottom-0 after:w-full",
				styles["chat-item"],
				isPinned && "bg-[#EDEDED]",
				className,
			)}
			metaData={[
				{
					type: EMetaDataType.DialogueItem,
					index: id,
					operations: [
						{ onClick: handleOperationDelete, element: <TopOperations.OperaionDeleteBase /> },
						{
							onClick: TopOperations.OperationSelectParent.selectParentNode,
							element: <TopOperations.OperationNewBase />,
						},
					],
					label: "对话项目",
				},
				{
					type: EMetaDataType.FirendProfile,
					index: friendId,
					label: "好友个人信息",
					treeItemDisplayName: (data) => `对话项目（${data.nickname}）`,
				},
			]}
			onTouchStart={startPress}
			onTouchEnd={cancelPress}
			onTouchMove={cancelPress}
			onTouchCancel={cancelPress}
			onContextMenu={(e) => {
				e.preventDefault();
				setSheet(true);
			}}
			onClick={() => {
				if (pressed.current) {
					pressed.current = false;
					return;
				}
				navigate(friendId === PAY_ID ? "/wechat/pay-service" : `/wechat/conversation/${friendId}`);
			}}
			nodeTreeSort
		>
			{sheet && (
				<div
					className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
					onClick={(e) => {
						e.stopPropagation();
						setSheet(false);
					}}
				>
					<div className="overflow-hidden rounded-t-[12px] bg-[#F7F7F7] pb-[env(safe-area-inset-bottom)]" onClick={(e) => e.stopPropagation()}>
						<div className="bg-white py-3 text-center text-[13px] text-black/40">{remark ?? nickname}</div>
						<button type="button" className="block h-[56px] w-full border-black/10 border-t bg-white text-[17px]" onClick={togglePin}>
							{isPinned ? "取消置顶" : "置顶聊天"}
						</button>
						<button
							type="button"
							className="block h-[56px] w-full border-black/10 border-t bg-white text-[17px] text-[#FA5151]"
							onClick={() => {
								setSheet(false);
								handleOperationDelete();
							}}
						>
							删除聊天
						</button>
						<button type="button" className="mt-2 block h-[56px] w-full bg-white text-[17px]" onClick={() => setSheet(false)}>
							取消
						</button>
					</div>
				</div>
			)}
			<Badge type={unreadDisplayType} text={unreadMarkNumber} hidden={badgeHide}>
				<h.img className="h-12 w-12 rounded-[6px] object-cover object-center" src={avatarInfo} />
			</Badge>
			<div className="ml-3 flex min-w-0 flex-1 flex-col justify-center gap-1 overflow-hidden">
				<div className="flex items-center justify-between gap-2">
					<span className="truncate font-normal text-[16px] text-black/90 leading-[22px]">
						{remark ?? nickname}
					</span>
					<span className="shrink-0 text-[12px] text-black/30 leading-4">{lastMessageTime}</span>
				</div>
				<div className="flex items-center">
					<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-black/45 leading-5">
						{lastMessage}
					</span>
					{isMuted && <img className="ml-2 w-4 shrink-0" src={MUTED_SVG} alt="" />}
				</div>
			</div>
		</canBeDetected.div>
	);
};

export default memo(DialogueItem);
