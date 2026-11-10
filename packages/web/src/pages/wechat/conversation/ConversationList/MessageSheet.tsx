import { reflow } from "@/pages/wechat/my/settings/chatOps";
import { groupAtom, isGroupId } from "@/stateV2/group";
import { EConversationType, type TConversationItem, formatWechatTime, getConversationListValueSnapshot, setConversationListValue } from "@/stateV2/conversation";
import { getProfileValueSnapshot } from "@/stateV2/profile";
import { slateToPlain, textToSlateChildren } from "@/wechatComponents/SlateText/emojiNames";
import dayjs from "dayjs";
import { useAtomValue } from "jotai";
import { nanoid } from "nanoid";
import { useState } from "react";

type R = Record<string, any>;
const FMT = "YYYY-MM-DDTHH:mm";
const nameOf = (id: string) => {
	const p = getProfileValueSnapshot(id);
	return p?.remark || p?.nickname || id;
};

const TYPE_NAME: Record<string, string> = {
	text: "文字", image: "图片", video: "视频", voice: "语音", centerText: "居中提示", transfer: "转账", redPacket: "红包", redPacketAcceptedReply: "领取红包提示", personalCard: "名片",
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
	<div className="flex items-start gap-3 border-black/5 border-b py-2">
		<div className="w-[72px] shrink-0 pt-[7px] text-[14px] text-black/50">{label}</div>
		<div className="min-w-0 flex-1">{children}</div>
	</div>
);
const inputCls = "w-full rounded-[6px] bg-[#F5F5F5] px-3 py-[7px] text-[16px] outline-none";

/** 手机端「编辑这条消息」：发送人、时间、内容、金额状态……都在这一个面板里改 */
const MessageSheet = ({ id, conversationId, onClose, onSwitch }: { id: string; conversationId: string; onClose: () => void; onSwitch: (id: string) => void }) => {
	const item = getConversationListValueSnapshot(conversationId).find((v) => v.id === id) as R | undefined;
	const group = useAtomValue(groupAtom(isGroupId(conversationId) ? conversationId : ""));
	const [d, setD] = useState<R>(() => {
		const r = (item ?? {}) as R;
		return {
			role: r.role,
			senderId: r.senderId ?? "",
			at: r.sendTimestamp ? dayjs(r.sendTimestamp).format(FMT) : "",
			upper: r.upperText ?? "",
			text: r.type === EConversationType.text ? (r.textContent ?? []).map((n: never) => slateToPlain(n)).join("\n") : r.type === EConversationType.centerText ? (r.simpleContent ?? "") : "",
			duration: String(r.duration ?? ""),
			isRead: !!r.isRead,
			showStt: !!r.showStt,
			stt: r.stt ?? "",
			amount: r.amount ?? "",
			note: r.note ?? "",
			status: r.transferStatus ?? r.redPacketStatus ?? "",
			originalSender: r.originalSender ?? "friend",
			referenceId: r.referenceId ?? "",
		};
	});
	if (!item) return null;
	const set = (patch: R) => setD((v) => ({ ...v, ...patch }));
	const type = item.type as string;
	const isGroup = isGroupId(conversationId);

	const mutate = (fn: (list: R[]) => R[]) => setConversationListValue(conversationId, (prev) => fn(prev.map((v) => ({ ...v }))) as TConversationItem[]);

	const save = () => {
		const ts = d.at ? dayjs(d.at).valueOf() : undefined;
		const timeChanged = !!ts && ts !== item.sendTimestamp;
		const upperChanged = d.upper !== (item.upperText ?? "");
		mutate((list) => {
			const it = list.find((v) => v.id === id);
			if (!it) return list;
			it.role = d.role;
			if (isGroup) it.senderId = d.role === "friend" ? d.senderId || undefined : undefined;
			if (ts) it.sendTimestamp = Math.min(ts, Date.now());
			if (upperChanged) it.upperText = d.upper.trim() || undefined;
			if (type === "text") {
				it.textContent = d.text.split("\n").map((line: string) => ({ type: "paragraph", children: textToSlateChildren(line) }));
				it.referenceId = d.referenceId || undefined;
			}
			if (type === "centerText") it.simpleContent = d.text;
			if (type === "voice") {
				const n = Number(d.duration);
				if (n > 0) it.duration = Math.round(n);
				it.isRead = d.isRead;
				it.showStt = d.showStt;
				it.stt = d.stt;
			}
			if (type === "transfer" || type === "redPacket") {
				const n = Number(d.amount);
				if (Number.isFinite(n) && n > 0) it.amount = (type === "redPacket" ? Math.min(n, 200) : n).toFixed(2);
				it.note = d.note || undefined;
				it.originalSender = d.originalSender;
				if (d.status) (type === "transfer" ? (it.transferStatus = d.status) : (it.redPacketStatus = d.status));
			}
			return reflow(list, new Set(timeChanged && !upperChanged ? [id] : []));
		});
		onClose();
	};

	const remove = () => {
		if (!window.confirm("删除这条消息？")) return;
		mutate((list) => list.filter((v) => v.id !== id && !(v.type === EConversationType.redPacketAcceptedReply && v.redPacketId === id)));
		onClose();
	};

	const recall = () => {
		mutate((list) => {
			const it = list.find((v) => v.id === id);
			if (!it) return list;
			it.type = EConversationType.centerText;
			it.simpleContent = it.role === "mine" ? "你撤回了一条消息" : "对方撤回了一条消息";
			it.textContent = undefined;
			return list;
		});
		onClose();
	};

	const insert = (where: "above" | "below") => {
		const newId = nanoid(8);
		mutate((list) => {
			const i = list.findIndex((v) => v.id === id);
			if (i < 0) return list;
			const cur = list[i].sendTimestamp ?? Date.now();
			const nb = where === "above" ? list[i - 1] : list[i + 1];
			const nbTs = nb?.sendTimestamp;
			const ts = where === "above" ? (nbTs ? Math.round((nbTs + cur) / 2) : cur - 60_000) : nbTs ? Math.round((nbTs + cur) / 2) : Math.min(cur + 60_000, Date.now());
			const fresh: R = { id: newId, type: EConversationType.text, role: list[i].role, senderId: list[i].senderId, sendTimestamp: ts, textContent: [{ type: "paragraph", children: [{ text: "新消息" }] }] };
			list.splice(where === "above" ? i : i + 1, 0, fresh);
			return list;
		});
		onSwitch(newId);
	};

	const options = getConversationListValueSnapshot(conversationId)
		.filter((v) => v.type === EConversationType.text && v.id !== id)
		.slice(-30);

	return (
		<div className="fixed inset-0 z-[1100] flex flex-col justify-end bg-black/40" onClick={onClose}>
			<div className="flex max-h-[86%] flex-col rounded-t-[14px] bg-white pb-[env(safe-area-inset-bottom)]" onClick={(e) => e.stopPropagation()}>
				<div className="flex h-12 shrink-0 items-center justify-between border-black/5 border-b px-4">
					<button type="button" className="text-[16px] text-black/60" onClick={onClose}>取消</button>
					<div className="font-medium text-[16px]">编辑这条{TYPE_NAME[type] ?? "消息"}</div>
					<button type="button" className="font-medium text-[16px] text-[#07C160]" onClick={save}>保存</button>
				</div>
				<div className="min-h-0 flex-1 overflow-auto px-4 pb-3">
					<Row label="发送人">
						<div className="flex flex-wrap gap-2">
							{(["mine", "friend"] as const).map((r) => (
								<button key={r} type="button" onClick={() => set({ role: r })} className={`rounded-full px-4 py-[6px] text-[15px] ${d.role === r ? "bg-[#07C160] text-white" : "bg-[#F5F5F5]"}`}>
									{r === "mine" ? "我" : "对方"}
								</button>
							))}
							{isGroup && d.role === "friend" && (
								<select aria-label="群成员" value={d.senderId} onChange={(e) => set({ senderId: e.target.value })} className="rounded-full bg-[#F5F5F5] px-3 py-[6px] text-[15px]">
									<option value="">默认成员</option>
									{(group?.memberIds ?? []).map((m) => (
										<option key={m} value={m}>{nameOf(m)}</option>
									))}
								</select>
							)}
						</div>
					</Row>
					<Row label="发送时间">
						<input aria-label="发送时间" type="datetime-local" value={d.at} onChange={(e) => set({ at: e.target.value })} className={inputCls} />
					</Row>
					<Row label="上方时间">
						<div className="flex gap-2">
							<input aria-label="上方时间文字" value={d.upper} onChange={(e) => set({ upper: e.target.value })} placeholder="空 = 不显示" className={inputCls} />
							<button type="button" className="shrink-0 rounded-[6px] border border-black/15 px-3 text-[14px]" onClick={() => set({ upper: d.at ? formatWechatTime(dayjs(d.at).valueOf()) : "" })}>自动</button>
						</div>
					</Row>
					{(type === "text" || type === "centerText") && (
						<Row label="内容">
							<textarea aria-label="消息内容" value={d.text} onChange={(e) => set({ text: e.target.value })} className={`${inputCls} h-[110px] resize-none leading-6`} placeholder="表情写成 [微笑] 这样" />
						</Row>
					)}
					{type === "text" && (
						<Row label="引用">
							<select aria-label="引用的消息" value={d.referenceId} onChange={(e) => set({ referenceId: e.target.value })} className={inputCls}>
								<option value="">不引用</option>
								{options.map((o) => (
									<option key={o.id} value={o.id}>{(o as R).textContent?.map((n: never) => slateToPlain(n)).join("").slice(0, 18)}</option>
								))}
							</select>
						</Row>
					)}
					{type === "voice" && (
						<>
							<Row label="时长(秒)"><input aria-label="语音时长" type="number" value={d.duration} onChange={(e) => set({ duration: e.target.value })} className={inputCls} /></Row>
							<Row label="状态">
								<label className="mr-4 text-[15px]"><input type="checkbox" checked={d.isRead} onChange={(e) => set({ isRead: e.target.checked })} /> 已读</label>
								<label className="text-[15px]"><input type="checkbox" checked={d.showStt} onChange={(e) => set({ showStt: e.target.checked })} /> 显示转文字</label>
							</Row>
							<Row label="转文字"><textarea aria-label="转文字内容" value={d.stt} onChange={(e) => set({ stt: e.target.value })} className={`${inputCls} h-[80px] resize-none`} /></Row>
						</>
					)}
					{(type === "transfer" || type === "redPacket") && (
						<>
							<Row label="金额"><input aria-label="金额" inputMode="decimal" value={d.amount} onChange={(e) => set({ amount: e.target.value })} className={inputCls} />{type === "redPacket" && <div className="mt-1 text-[12px] text-black/40">红包最高 200 元</div>}</Row>
							<Row label="说明"><input aria-label="说明" value={d.note} onChange={(e) => set({ note: e.target.value })} className={inputCls} /></Row>
							<Row label="发起人">
								<div className="flex gap-2">
									{(["mine", "friend"] as const).map((r) => (
										<button key={r} type="button" onClick={() => set({ originalSender: r })} className={`rounded-full px-4 py-[6px] text-[15px] ${d.originalSender === r ? "bg-[#07C160] text-white" : "bg-[#F5F5F5]"}`}>{r === "mine" ? "我" : "对方"}</button>
									))}
								</div>
							</Row>
							<Row label="状态">
								<select aria-label="状态" value={d.status} onChange={(e) => set({ status: e.target.value })} className={inputCls}>
									<option value="awaiting">待领取/待收款</option>
									<option value="accepted">已领取/已收款</option>
									{type === "transfer" && <option value="rejected">已退还</option>}
									<option value="expired">已过期</option>
								</select>
							</Row>
						</>
					)}
					{(type === "image" || type === "video" || type === "personalCard") && <div className="py-3 text-[13px] text-black/40">图片、视频本身不能在这里替换，要换请删除后从「+」重新发送。</div>}
					<div className="flex flex-wrap gap-2 pt-3">
						<button type="button" className="rounded-[6px] border border-black/15 px-3 py-2 text-[14px]" onClick={() => insert("above")}>在上方插入一条</button>
						<button type="button" className="rounded-[6px] border border-black/15 px-3 py-2 text-[14px]" onClick={() => insert("below")}>在下方插入一条</button>
						{type === "text" && <button type="button" className="rounded-[6px] border border-black/15 px-3 py-2 text-[14px]" onClick={recall}>撤回</button>}
						<button type="button" className="rounded-[6px] border border-[#FA5151] px-3 py-2 text-[14px] text-[#FA5151]" onClick={remove}>删除</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default MessageSheet;
