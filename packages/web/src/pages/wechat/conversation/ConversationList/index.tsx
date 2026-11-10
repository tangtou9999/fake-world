import IncomingCall from "./IncomingCall";
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
	setConversationListValue,
} from "@/stateV2/conversation";
import { EMetaDataType, type StaticMetaData, allNodesTreeAtom } from "@/stateV2/detectedNode";
import { SubnodeOutlined } from "@ant-design/icons";
import { Modal, Tooltip } from "antd";
import { useAtom, useSetAtom } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Node } from "slate";
import { translateText } from "../ConversationFooter/importScreenshots";
import { ReactSortable } from "react-sortablejs";
import { twJoin } from "tailwind-merge";
import { useConversationAPI } from "../context";
import ConversationItem from "./ConversationItem";
import { getGeminiConfig, normPace, normScene, resolveProfile } from "@/stateV2/gemini";

/** 这条语音自带的环境 / 语速（AI 按剧情给的）；没有就用设置里的默认 */
const lineFx = (item: object) => {
	const { scene, pace } = item as { scene?: string; pace?: string };
	const fx = { ...getGeminiConfig().fx };
	const sc = normScene(scene);
	const pc = normPace(pace);
	if (sc) fx.scene = sc;
	if (pc) fx.pace = pc;
	return fx;
};
import { pruneClips } from "@/utils/audioStore";
import { mainStore } from "@/stateV2/store";
import { reflow } from "@/pages/wechat/my/settings/chatOps";
import { copyText } from "@/pages/wechat/my/settings/CopyBlock";
import MessageSheet from "./MessageSheet";
import { playingVoiceAtom } from "@/stateV2/playingVoice";
import { geminiSpeak, stopSpeaking, unlockAudio, waitIdle } from "@/utils/tts";
import { RedPacketDetail, RedPacketOpen } from "./RedPacketViews";
import { getProfileValueSnapshot } from "@/stateV2/profile";
import { groupDefaultSender, isGroupId } from "@/stateV2/group";

const ConversationList = () => {
	const { listRef, conversationId, sendTransfer, sendRedPacketAcceptedReply } =
		useConversationAPI();
	const [conversationList, setConversationList] = useAtom(conversationListAtom(conversationId));
	const { isEdit } = useMode();
	const rebuildTree = useSetAtom(allNodesTreeAtom);

	// 聊天里已经不存在的消息，对应的本地语音一并清掉（只要消息还在，语音就一直保存在手机里）
	useEffect(() => {
		void pruneClips(`${conversationId}:`, new Set(conversationList.map((i) => `${conversationId}:${i.id}`)));
	}, [conversationList, conversationId]);

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

	/** 群聊里红包/转账是哪位成员发的；私聊就是对方 */
	const peerOf = (item: { senderId?: string }) =>
		isGroupId(conversationId) ? (item.senderId ?? groupDefaultSender(conversationId) ?? "") : conversationId;

	const generateTransferReplyConversation = (conversationItemId: TConversationItem["id"]) => {
		const item = getConversationListValueSnapshot(conversationId).find(
			(v) => v.id === conversationItemId,
		);
		const { amount, originalSender, role } = item as IConversationTypeTransfer;
		if (originalSender === "friend") {
			applyMoneyMove({ kind: "transfer", direction: "in", peerId: peerOf(item as TConversationItem), amount });
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
				peerId: peerOf(packet),
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
	const [menu, setMenu] = useState<{ id: string; text: string; translated: boolean; kind: string; voice?: { shown: boolean; has: boolean } } | null>(null);
	const [busy, setBusy] = useState(false);
	// 编辑模式下快速点两下某条消息：打开「编辑这条消息」面板
	const [sheetId, setSheetId] = useState<string | null>(null);
	const editTapRef = useRef<{ id: string; t: number }>({ id: "", t: 0 });
	const onEditTap = (item: TConversationItem) => {
		if (!isEdit) return;
		const now = Date.now();
		const twice = editTapRef.current.id === item.id && now - editTapRef.current.t < 380;
		editTapRef.current = { id: item.id, t: twice ? 0 : now };
		if (twice) setSheetId(item.id);
	};
	// 多选：长按菜单里点「多选」进入，勾选后批量删除 / 互换发送人 / 平移时间
	const [selected, setSelected] = useState<Set<string> | null>(null);
	const [shift, setShift] = useState({ n: "1", unit: "3600000" });
	const batch = (fn: (list: Record<string, any>[]) => Record<string, any>[]) => {
		setConversationList((prev) => fn(prev.map((v) => ({ ...v }))) as TConversationItem[]);
		setSelected(null);
	};
	const pressTimer = useRef<ReturnType<typeof setTimeout>>();
	const openTextMenu = (item: TConversationItem) => {
		if (isEdit) return;
		if (item.type === EConversationType.voice) {
			setMenu({ id: item.id, text: "", kind: item.type, translated: false, voice: { shown: !!item.showStt, has: !!item.stt?.trim() } });
			return;
		}
		if (item.type !== EConversationType.text) {
			setMenu({ id: item.id, text: "", kind: item.type, translated: false });
			return;
		}
		const text = item.textContent.map((n) => Node.string(n)).join("\n");
		setMenu({ id: item.id, text, kind: item.type, translated: !!item.translation });
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
		peer: string;
		id: string;
		amount: string;
		note: string;
	} | null>(null);
	const friend = getProfileValueSnapshot(rp?.peer || conversationId);
	const friendName = friend?.remark || friend?.nickname || "好友";
	const lastTap = useRef<{ id: string; t: number }>({ id: "", t: 0 });
	const voiceTok = useRef(0);
	const handleTap = (item: TConversationItem) => {
		if (isEdit) return;
		if (item.type === EConversationType.voice) {
			// 点一次播放（出现播放动画），再点一次取消；红点消失；有文字用 Gemini 声音读出来，没有文字就只播放动画
			const tok = ++voiceTok.current;
			if (mainStore.get(playingVoiceAtom) === item.id) {
				stopSpeaking();
				mainStore.set(playingVoiceAtom, null);
				return;
			}
			stopSpeaking();
			mainStore.set(playingVoiceAtom, item.id);
			const finish = () => {
				if (voiceTok.current === tok && mainStore.get(playingVoiceAtom) === item.id) mainStore.set(playingVoiceAtom, null);
			};
			if (item.role === "friend" && !(item as { isRead?: boolean }).isRead) {
				setConversationListValue(conversationId, (prev) => prev.map((v) => (v.id === item.id ? ({ ...v, isRead: true } as TConversationItem) : v)));
			}
			const text = item.stt?.trim();
			if (text) {
				unlockAudio();
				void geminiSpeak(text, resolveProfile(item.role === "mine" ? "mine" : "friend", conversationId), lineFx(item), (item as { tone?: string }).tone, `${conversationId}:${item.id}`).then(async (n) => {
					if (n) {
						Modal.info({ title: "声音暂时放不出来", content: <div style={{ whiteSpace: "pre-line" }}>{n}</div>, okText: "知道了", okButtonProps: { style: { background: "#07C160", color: "#fff", border: "none", boxShadow: "none" } } });
						finish();
						return;
					}
					await waitIdle();
					finish();
				});
			} else {
				setTimeout(finish, Math.max(1, (item as { duration?: number }).duration ?? 3) * 1000);
			}
			return;
		}
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
				peer: peerOf(item),
				id: item.id,
				amount: (item as IConversationTypeRedPacket).amount,
				note: (item as IConversationTypeRedPacket).note ?? "",
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
								selected?.has(item.id) && "rounded bg-[#07C160]/25",
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
								onClick={() => {
									onEditTap(item);
									handleTap(item);
								}}
								onClickCapture={(e) => {
									if (selected) {
										e.stopPropagation();
										e.preventDefault();
										setSelected((prev) => {
											const next = new Set(prev);
											next.has(item.id) ? next.delete(item.id) : next.add(item.id);
											return next;
										});
									}
								}}
								onTouchStart={() => startPress(item)}
								onTouchMove={stopPress}
								onTouchEnd={stopPress}
								onTouchCancel={stopPress}
								onContextMenu={(e) => {
									if (!isEdit) {
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
			<IncomingCall conversationId={conversationId} />
			{sheetId && <MessageSheet key={sheetId} id={sheetId} conversationId={conversationId} onClose={() => setSheetId(null)} onSwitch={(nid) => setSheetId(nid)} />}
			{selected && (
				<div className="fixed right-0 bottom-0 left-0 z-[1000] border-black/10 border-t bg-[#F7F7F7] px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)]">
					<div className="flex items-center justify-between text-[14px]">
						<span>已选 {selected.size} 条（点消息勾选）</span>
						<button type="button" className="text-black/60" onClick={() => setSelected(null)}>取消</button>
					</div>
					<div className="mt-2 flex flex-wrap items-center gap-2 text-[14px]">
						<button
							type="button"
							className="rounded-[6px] border border-[#FA5151] px-3 py-[6px] text-[#FA5151]"
							onClick={() => {
								if (!selected.size || !window.confirm(`删除选中的 ${selected.size} 条消息？`)) return;
								batch((list) => list.filter((v) => !selected.has(v.id) && !(v.type === EConversationType.redPacketAcceptedReply && selected.has(v.redPacketId))));
							}}
						>
							删除
						</button>
						<button
							type="button"
							className="rounded-[6px] border border-black/20 px-3 py-[6px]"
							onClick={() => batch((list) => list.map((v) => (selected.has(v.id) ? { ...v, role: v.role === "mine" ? "friend" : "mine" } : v)))}
						>
							互换发送人
						</button>
						<input aria-label="平移数量" type="number" value={shift.n} onChange={(e) => setShift({ ...shift, n: e.target.value })} className="h-8 w-14 rounded-[6px] bg-white px-2" />
						<select aria-label="平移单位" value={shift.unit} onChange={(e) => setShift({ ...shift, unit: e.target.value })} className="h-8 rounded-[6px] bg-white px-1">
							<option value="60000">分钟</option>
							<option value="3600000">小时</option>
							<option value="86400000">天</option>
						</select>
						{[-1, 1].map((dir) => (
							<button
								key={dir}
								type="button"
								className="rounded-[6px] border border-black/20 px-3 py-[6px]"
								onClick={() => {
									const delta = dir * Number(shift.n || 0) * Number(shift.unit);
									if (!delta) return;
									const ids = new Set(selected);
									batch((list) => reflow(list.map((v) => (ids.has(v.id) && v.sendTimestamp ? { ...v, sendTimestamp: Math.min(v.sendTimestamp + delta, Date.now()) } : v)), ids));
								}}
							>
								{dir < 0 ? "提前" : "推后"}
							</button>
						))}
					</div>
				</div>
			)}
			{menu && (
				<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => !busy && setMenu(null)}>
					<div className="rounded-t-[12px] bg-white pb-[env(safe-area-inset-bottom)]" onClick={(e) => e.stopPropagation()}>
						{menu.voice && (
							<button
								type="button"
								disabled={!menu.voice.has && !menu.voice.shown}
								onClick={() => {
									const id = menu.id;
									const next = !menu.voice?.shown;
									setConversationList((prev) => prev.map((v) => (v.id === id ? ({ ...v, showStt: next } as TConversationItem) : v)));
									setMenu(null);
								}}
								className="h-[54px] w-full border-black/5 border-b text-[17px] disabled:opacity-40"
							>
								{menu.voice.shown ? "收起文字" : menu.voice.has ? "转文字" : "转文字（这条没有文字内容）"}
							</button>
						)}
						{menu.kind === EConversationType.text && (
							<>
								<button type="button" disabled={busy} onClick={doTranslate} className="h-[54px] w-full border-black/5 border-b text-[17px] disabled:opacity-50">
									{busy ? "翻译中…" : menu.translated ? "取消翻译" : "翻译"}
								</button>
								<button
									type="button"
									onClick={async () => {
										await copyText(menu.text);
										setMenu(null);
									}}
									className="h-[54px] w-full border-black/5 border-b text-[17px]"
								>
									复制
								</button>
							</>
						)}
						<button type="button" disabled={busy} onClick={() => { setSheetId(menu.id); setMenu(null); }} className="h-[54px] w-full border-black/5 border-b text-[17px]">
							编辑
						</button>
						<button type="button" disabled={busy} onClick={() => { setSelected(new Set([menu.id])); setMenu(null); }} className="h-[54px] w-full border-black/5 border-b text-[17px]">
							多选
						</button>
						<button
							type="button"
							disabled={busy}
							onClick={() => {
								const id = menu.id;
								setMenu(null);
								if (window.confirm("删除这条消息？")) setConversationList((prev) => prev.filter((v) => v.id !== id && !(v.type === EConversationType.redPacketAcceptedReply && v.redPacketId === id)));
							}}
							className="h-[54px] w-full text-[17px] text-[#FA5151]"
						>
							删除
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
