import { applyMoneyMove } from "@/stateV2/walletFlow";
import { canBeDetected } from "@/components/NodeDetected";
import TopOperations from "@/components/TopOperations";
import useMode from "@/components/useMode";
import {
	ConversationTypeLabel,
	EConversationType,
	type IConversationTypeRedPacket,
	type IConversationTypeTransfer,
	type TConversationItem,
	conversationListAtom,
	getConversationListValueSnapshot,
} from "@/stateV2/conversation";
import { EMetaDataType, type StaticMetaData, allNodesTreeAtom } from "@/stateV2/detectedNode";
import { SubnodeOutlined } from "@ant-design/icons";
import { Modal, Tooltip } from "antd";
import { useAtom, useSetAtom } from "jotai";
import { useMemo, useRef, useState } from "react";
import { Node } from "slate";
import { translateText } from "../ConversationFooter/importScreenshots";
import { ReactSortable } from "react-sortablejs";
import { twJoin } from "tailwind-merge";
import { useConversationAPI } from "../context";
import ConversationItem from "./ConversationItem";
import { RedPacketDetail, RedPacketOpen } from "./RedPacketViews";
import { getProfileValueSnapshot } from "@/stateV2/profile";

const ConversationList = () => {
	const { listRef, conversationId, sendTransfer, sendRedPacketAcceptedReply } =
		useConversationAPI();
	const [conversationList, setConversationList] = useAtom(conversationListAtom(conversationId));
	const { isEdit } = useMode();
	const rebuildTree = useSetAtom(allNodesTreeAtom);

	const mappedSortableListData = useMemo(() => {
		return conversationList.map((item) => ({
			id: item.id,
		}));
	}, [conversationList]);

	const handleOperationDelete = (id: TConversationItem["id"]) => {
		Modal.confirm({
			title: "是否删除该聊天记录？",
			onOk: () => {
				setConversationList((prev) => prev.filter((v) => v.id !== id));
			},
		});
	};

	const generateTransferReplyConversation = (conversationItemId: TConversationItem["id"]) => {
		const item = getConversationListValueSnapshot(conversationId).find(
			(v) => v.id === conversationItemId,
		);
		const { amount, originalSender, role } = item as IConversationTypeTransfer;
		if (originalSender === "friend") {
			applyMoneyMove({ kind: "transfer", direction: "in", peerId: conversationId, amount });
		}
		setConversationList((prev) =>
			prev.map((item) =>
				item.id === conversationItemId
					? ({ ...item, transferStatus: "accepted" } as TConversationItem)
					: item,
			),
		);
		sendTransfer({
			amount,
			transferStatus: "accepted",
			originalSender,
			role: role === "mine" ? "friend" : "mine",
		});
	};

	const generateRedPacketAcceptedReplyConversation = (
		conversationItemId: TConversationItem["id"],
	) => {
		const packet = getConversationListValueSnapshot(conversationId).find(
			(v) => v.id === conversationItemId,
		) as IConversationTypeRedPacket | undefined;
		if (packet && packet.originalSender === "friend" && packet.redPacketStatus === "awaiting") {
			applyMoneyMove({
				kind: "redPacket",
				direction: "in",
				peerId: conversationId,
				amount: packet.amount,
			});
		}
		setConversationList((prev) =>
			prev.map((item) =>
				item.id === conversationItemId
					? ({ ...item, redPacketStatus: "accepted" } as TConversationItem)
					: item,
			),
		);
		sendRedPacketAcceptedReply(conversationItemId);
	};

	/** 非编辑模式下点击红包 / 转账：对方发的 → 我领取；我发的 → 模拟对方领取 */
	const [menu, setMenu] = useState<{ id: string; text: string; translated: boolean } | null>(null);
	const [busy, setBusy] = useState(false);
	const pressTimer = useRef<ReturnType<typeof setTimeout>>();
	const openTextMenu = (item: TConversationItem) => {
		if (isEdit || item.type !== EConversationType.text) return;
		const text = item.textContent.map((n) => Node.string(n)).join("\n");
		setMenu({ id: item.id, text, translated: !!item.translation });
	};
	const startPress = (item: TConversationItem) => {
		clearTimeout(pressTimer.current);
		pressTimer.current = setTimeout(() => openTextMenu(item), 500);
	};
	const stopPress = () => clearTimeout(pressTimer.current);
	const setTranslation = (id: string, translation?: string) =>
		setConversationList((prev) =>
			prev.map((v) => (v.id === id ? ({ ...v, translation } as TConversationItem) : v)),
		);
	const doTranslate = async () => {
		if (!menu) return;
		const { id, text, translated } = menu;
		if (translated) {
			setTranslation(id, undefined);
			setMenu(null);
			return;
		}
		setBusy(true);
		try {
			setTranslation(id, await translateText(text));
			setMenu(null);
		} catch (e) {
			setMenu(null);
			Modal.error({
				title: "翻译失败",
				content: `${e instanceof Error ? e.message : String(e)}（需要先在「我 → 设置 → AI 助手」填写密钥）`,
				centered: true,
			});
		} finally {
			setBusy(false);
		}
	};
	const [dlg, setDlg] = useState<{
		title: string;
		content: string;
		okText: string;
		onOk: () => void;
	} | null>(null);
	const [rp, setRp] = useState<{
		stage: "open" | "detail";
		id: string;
		amount: string;
		note: string;
	} | null>(null);
	const friend = getProfileValueSnapshot(conversationId);
	const friendName = friend?.remark || friend?.nickname || "好友";
	const lastTap = useRef<{ id: string; t: number }>({ id: "", t: 0 });
	const handleTap = (item: TConversationItem) => {
		if (isEdit) return;
		const isPacket = item.type === EConversationType.redPacket && item.redPacketStatus === "awaiting";
		const isTransfer = item.type === EConversationType.transfer && item.transferStatus === "awaiting";
		if (!isPacket && !isTransfer) return;
		const run = () =>
			isPacket
				? generateRedPacketAcceptedReplyConversation(item.id)
				: generateTransferReplyConversation(item.id);
		const label = isPacket ? "红包" : "转账";
		if (isPacket && (item as IConversationTypeRedPacket).originalSender === "friend") {
			setRp({
				stage: "open",
				id: item.id,
				amount: (item as IConversationTypeRedPacket).amount,
				note: (item as IConversationTypeRedPacket).note,
			});
			return;
		}
		if ((item as IConversationTypeRedPacket).originalSender === "friend") {
			setDlg({
				title: isPacket ? "领取红包？" : "确认收款？",
				content: `金额 ¥${(item as IConversationTypeRedPacket).amount} 将存入零钱`,
				okText: isPacket ? "领取" : "确认收款",
				onOk: run,
			});
		} else {
			// 我发出的：真实聊天里只能等对方领取；这里「双击」才模拟对方领取
			const now = Date.now();
			const isDouble = lastTap.current.id === item.id && now - lastTap.current.t < 400;
			lastTap.current = { id: item.id, t: now };
			if (!isDouble) return;
			lastTap.current = { id: "", t: 0 };
			setDlg({
				title: `模拟对方领取${label}？`,
				content: isPacket
					? "红包会变成「已被领取」，聊天里出现「xx领取了你的红包」"
					: "转账会变成「已被接收」",
				okText: "对方已领取",
				onOk: run,
			});
		}
	};

	return (
		<canBeDetected.div
			className="flex flex-1 flex-col-reverse overflow-auto bg-[#EDEDED] p-3"
			metaData={{
				type: EMetaDataType.ConversationList,
				index: conversationId,
				treeItemDisplayName: "聊天记录",
			}}
			innerRef={listRef}
			id="conversation-list"
		>
			<ReactSortable
				disabled={!isEdit}
				list={mappedSortableListData}
				animation={400}
				setList={(v, sortable) => {
					if (isEdit && sortable) {
						const needUpdate = v.some((_, i) => v[i].id !== conversationList[i].id);
						if (needUpdate) {
							setConversationList(v.map((i) => conversationList.find((d) => d.id === i.id)!));
						}
					}
				}}
				className="mb-auto space-y-4"
				onSort={() => {
					rebuildTree();
				}}
			>
				{conversationList.map((item) => {
					const operations: StaticMetaData.InjectMetaData["operations"] = [
						{
							onClick: handleOperationDelete.bind(null, item.id),
							element: <TopOperations.OperaionDeleteBase />,
						},
						{
							onClick: TopOperations.OperationSelectParent.selectParentNode,
							element: <TopOperations.OperationNewBase />,
						},
					];
					if (item.type === EConversationType.transfer && item.transferStatus === "awaiting") {
						operations.push({
							key: "transferReply",
							onClick: () => generateTransferReplyConversation(item.id),
							element: (
								<Tooltip title="回应转账消息">
									<SubnodeOutlined />
								</Tooltip>
							),
						});
					}
					if (item.type === EConversationType.redPacket && item.redPacketStatus === "awaiting") {
						operations.push({
							key: "RedPacketAcceptedReply",
							onClick: () => generateRedPacketAcceptedReplyConversation(item.id),
							element: (
								<Tooltip title="回应红包消息">
									<SubnodeOutlined />
								</Tooltip>
							),
						});
					}
					return (
						<canBeDetected.div
							className={twJoin(
								"group flex flex-col space-y-4",
								item.role,
								isEdit && "cursor-grab",
							)}
							key={item.id}
							metaData={[
								{
									type: EMetaDataType.ConversationItem,
									index: [conversationId, item.id],
									treeItemDisplayName: (data) =>
										`消息（${ConversationTypeLabel[data.type]}${
											data.role ? `-${data.role}` : ""
										}）`,
									operations,
									label: "单个消息",
								},
								{
									type: EMetaDataType.FirendProfile,
									index: conversationId,
									label: "好友个人信息",
								},
								{
									type: EMetaDataType.MyProfile,
									label: "个人信息",
								},
							]}
							nodeTreeSort
							data-conversation-id={item.id}
						>
							<div
								className="contents"
								onClick={() => handleTap(item)}
								onTouchStart={() => startPress(item)}
								onTouchMove={stopPress}
								onTouchEnd={stopPress}
								onTouchCancel={stopPress}
								onContextMenu={(e) => {
									if (item.type === EConversationType.text && !isEdit) {
										e.preventDefault();
										openTextMenu(item);
									}
								}}
							>
								<ConversationItem data={item} />
							</div>
						</canBeDetected.div>
					);
				})}
			</ReactSortable>
			{rp?.stage === "open" && (
				<RedPacketOpen
					name={friendName}
					avatar={friend?.avatarInfo ?? ""}
					note={rp.note}
					onClose={() => setRp(null)}
					onOpen={() => {
						generateRedPacketAcceptedReplyConversation(rp.id);
						setRp({ ...rp, stage: "detail" });
					}}
				/>
			)}
			{rp?.stage === "detail" && (
				<RedPacketDetail
					name={friendName}
					avatar={friend?.avatarInfo ?? ""}
					note={rp.note}
					amount={rp.amount}
					onClose={() => setRp(null)}
				/>
			)}
			{dlg && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-10" onClick={() => setDlg(null)}>
					<div className="w-full max-w-[300px] overflow-hidden rounded-[12px] bg-white" onClick={(e) => e.stopPropagation()}>
						<div className="px-6 pt-6 pb-5 text-center">
							<div className="font-medium text-[17px] text-black">{dlg.title}</div>
							<div className="mt-2 text-[14px] text-black/60 leading-5">{dlg.content}</div>
						</div>
						<div className="flex h-[52px] border-black/10 border-t text-[17px]">
							<button type="button" className="flex-1 border-black/10 border-r text-black" onClick={() => setDlg(null)}>
								取消
							</button>
							<button
								type="button"
								className="flex-1 font-medium text-[#07C160]"
								onClick={() => {
									const f = dlg.onOk;
									setDlg(null);
									f();
								}}
							>
								{dlg.okText}
							</button>
						</div>
					</div>
				</div>
			)}
			{menu && (
				<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => !busy && setMenu(null)}>
					<div className="rounded-t-[12px] bg-white pb-[env(safe-area-inset-bottom)]" onClick={(e) => e.stopPropagation()}>
						<button type="button" disabled={busy} onClick={doTranslate} className="h-[54px] w-full text-[17px] disabled:opacity-50">
							{busy ? "翻译中…" : menu.translated ? "取消翻译" : "翻译"}
						</button>
						<div className="h-2 bg-[#F7F7F7]" />
						<button type="button" disabled={busy} onClick={() => setMenu(null)} className="h-[54px] w-full text-[17px]">取消</button>
					</div>
				</div>
			)}
		</canBeDetected.div>
	);
};

export default ConversationList;
