import { conversationListAtom, type TConversationItem } from "@/stateV2/conversation";
import dayjs from "dayjs";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { holdMs, replayAtom, showsTyping } from "./replay";
import { useConversationAPI } from "./context";

const chip = (on: boolean) => `h-8 rounded-full px-3 text-[13px] ${on ? "bg-[#07C160] text-white" : "bg-black/5 text-black/60"}`;

const brief = (item?: TConversationItem) => {
	if (!item) return "";
	const r = item as unknown as { textContent?: { children?: { text?: string }[] }[]; simpleContent?: string; note?: string; amount?: string; type?: string };
	if (item.type === "text") return (r.textContent ?? []).map((p) => (p.children ?? []).map((c) => c.text ?? "").join("")).join("").slice(0, 16);
	if (item.type === "voice") return "[语音]";
	if (item.type === "image") return "[图片]";
	if (item.type === "transfer") return `[转账] ${r.note ?? ""}`.slice(0, 16);
	if (item.type === "redPacket") return `[红包] ${r.note ?? ""}`.slice(0, 16);
	if (item.type === "transferReceipt" || item.type === "redPacketAcceptedReply") return "[收款]";
	if (item.type === "centerText") return r.simpleContent?.slice(0, 16) ?? "[提示]";
	return "[消息]";
};

/** 聊天回放：选段确认、倒计时、逐条出现。不改聊天数据。 */
const ReplayLayer = () => {
	const { conversationId, scrollConversationListToBtm } = useConversationAPI();
	const list = useAtomValue(conversationListAtom(conversationId));
	const [replay, setReplay] = useAtom(replayAtom);
	const active = replay?.conversationId === conversationId ? replay : null;
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");
	const [left, setLeft] = useState(0);
	const [timeNote, setTimeNote] = useState("");

	useEffect(() => {
		const live = !!active && active.phase !== "setup";
		const screen = document.getElementById("screen");
		if (live && active) {
			document.body.dataset.replayLive = "1";
			document.body.dataset.replayPhase = active.phase;
			document.body.dataset.replayShown = String(active.shown);
			screen?.setAttribute("data-replay-view", active.view);
		} else {
			delete document.body.dataset.replayLive;
			delete document.body.dataset.replayPhase;
			delete document.body.dataset.replayShown;
			screen?.removeAttribute("data-replay-view");
		}
		return () => {
			delete document.body.dataset.replayLive;
			delete document.body.dataset.replayPhase;
			delete document.body.dataset.replayShown;
			screen?.removeAttribute("data-replay-view");
		};
	}, [active]);

	useEffect(() => {
		if (active?.phase !== "setup" || !active.ids[0]) return;
		document.querySelector(`[data-conversation-id="${CSS.escape(active.ids[0])}"]`)?.scrollIntoView({ block: "center" });
	}, [active?.phase, active?.ids[0]]);

	useEffect(() => {
		if (active?.phase !== "countdown") return;
		let n = active.countdownSec;
		setLeft(n);
		const t = window.setInterval(() => {
			n -= 1;
			if (n <= 0) {
				window.clearInterval(t);
				setLeft(0);
				setReplay((r) => (r?.phase === "countdown" ? { ...r, phase: "playing", shown: 0, typing: false } : r));
			} else setLeft(n);
		}, 1000);
		return () => window.clearInterval(t);
	}, [active?.phase, active?.countdownSec, setReplay]);

	useEffect(() => {
		if (active?.phase !== "playing") return;
		const id = active.ids[active.shown];
		if (!id) {
			setReplay((r) => (r?.phase === "playing" ? { ...r, phase: "done", typing: false } : r));
			return;
		}
		const item = list.find((m) => m.id === id);
		const typing = !!item && showsTyping(item);
		const wait = item ? holdMs(item, active.speed) : 400;
		if (typing) setReplay((r) => (r?.phase === "playing" && !r.typing ? { ...r, typing: true } : r));
		const t = window.setTimeout(() => {
			setReplay((r) => (r?.phase === "playing" ? { ...r, typing: false, shown: r.shown + 1 } : r));
		}, wait);
		return () => window.clearTimeout(t);
		// list 只在这条消息还没出现时读一次。不要把它放进依赖，避免列表引用变化把等待清掉。
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [active?.phase, active?.shown, active?.speed, active?.ids, setReplay]);

	useEffect(() => {
		if (active && active.phase !== "setup") scrollConversationListToBtm();
	}, [active?.phase, active?.shown, active?.typing, scrollConversationListToBtm]);

	if (!active) return null;
	const screen = document.getElementById("screen");
	if (!screen) return null;

	const applyTime = () => {
		const a = dayjs(from).valueOf();
		const b = dayjs(to).endOf("minute").valueOf();
		if (!from || !to || !Number.isFinite(a) || !Number.isFinite(b)) {
			setTimeNote("先把开始和结束时间填上");
			return;
		}
		const ids = list.filter((m) => (m.sendTimestamp ?? 0) >= Math.min(a, b) && (m.sendTimestamp ?? 0) <= Math.max(a, b)).map((m) => m.id);
		setTimeNote(ids.length ? "" : "这段时间里没有消息");
		setReplay((r) => (r ? { ...r, ids } : r));
	};

	if (active.phase === "setup") {
		const first = list.find((m) => m.id === active.ids[0]);
		const last = list.find((m) => m.id === active.ids[active.ids.length - 1]);
		return createPortal(
			<div className="absolute inset-x-0 bottom-0 z-[70] rounded-t-[12px] bg-white p-4 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
				<div className="mb-1 font-medium text-[16px]">聊天回放</div>
				<div className="mb-2 text-[12px] text-black/50 leading-5">
					已选 {active.ids.length} 条{first ? `，从「${brief(first)}」到「${brief(last)}」` : ""}。点一条消息改{active.pick === "start" ? "起点" : "终点"}，绿框里的会按顺序播放。不会改聊天记录。
				</div>
				<div className="mb-2 flex gap-2">
					<button type="button" className={chip(active.pick === "start")} onClick={() => setReplay((r) => (r ? { ...r, pick: "start" } : r))}>
						改起点
					</button>
					<button type="button" className={chip(active.pick === "end")} onClick={() => setReplay((r) => (r ? { ...r, pick: "end" } : r))}>
						改终点
					</button>
				</div>
				<div className="mb-2 flex gap-2">
					<input aria-label="回放开始时间" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 min-w-0 flex-1 rounded-[6px] bg-[#F5F5F5] px-2 text-[12px]" />
					<input aria-label="回放结束时间" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 min-w-0 flex-1 rounded-[6px] bg-[#F5F5F5] px-2 text-[12px]" />
				</div>
				<button type="button" onClick={applyTime} className="mb-2 h-8 w-full rounded-[6px] bg-black/5 text-[13px]">
					按时间选
				</button>
				{timeNote && <div className="mb-2 text-[12px] text-[#C62828]">{timeNote}</div>}
				<div className="mb-2 flex flex-wrap gap-2">
					<button type="button" className={chip(active.view === "full")} onClick={() => setReplay((r) => (r ? { ...r, view: "full" } : r))}>完整</button>
					<button type="button" className={chip(active.view === "privacy")} onClick={() => setReplay((r) => (r ? { ...r, view: "privacy" } : r))}>隐私</button>
					<button type="button" className={chip(active.speed === "fast")} onClick={() => setReplay((r) => (r ? { ...r, speed: "fast" } : r))}>快</button>
					<button type="button" className={chip(active.speed === "normal")} onClick={() => setReplay((r) => (r ? { ...r, speed: "normal" } : r))}>正常</button>
					<button type="button" className={chip(active.speed === "slow")} onClick={() => setReplay((r) => (r ? { ...r, speed: "slow" } : r))}>慢</button>
					{([3, 5, 10] as const).map((n) => (
						<button key={n} type="button" className={chip(active.countdownSec === n)} onClick={() => setReplay((r) => (r ? { ...r, countdownSec: n } : r))}>
							{n} 秒
						</button>
					))}
				</div>
				<div className="flex gap-3">
					<button type="button" onClick={() => setReplay(null)} className="h-11 flex-1 rounded-[6px] bg-black/5 text-[16px]">
						取消
					</button>
					<button
						type="button"
						disabled={!active.ids.length}
						onClick={() => setReplay((r) => (r ? { ...r, phase: "countdown", shown: 0, typing: false } : r))}
						className="h-11 flex-1 rounded-[6px] bg-[#07C160] text-[16px] text-white disabled:opacity-50"
					>
						开始回放
					</button>
				</div>
			</div>,
			screen,
		);
	}

	const toggle = () =>
		setReplay((r) => {
			if (!r || (r.phase !== "playing" && r.phase !== "paused")) return r;
			return { ...r, phase: r.phase === "playing" ? "paused" : "playing", typing: false };
		});

	return createPortal(
		<>
			<style>{`
				body[data-replay-live] .ant-drawer { display: none !important; }
				#screen[data-replay-view="privacy"] [data-replay-avatar],
				#screen[data-replay-view="privacy"] [data-replay-name],
				#screen[data-replay-view="privacy"] [data-replay-title] { display: none !important; }
				#screen[data-replay-view="privacy"] #conversation-list .break-words { font-size: 22px; line-height: 30px; padding: 14px 16px; }
				#screen[data-replay-view="privacy"] #conversation-list { padding-left: 28px; padding-right: 28px; }
			`}</style>
			{active.phase === "countdown" && (
				<div className="absolute inset-0 z-[80] flex flex-col items-center justify-center px-8 text-center text-white" style={{ background: "rgba(17,17,17,0.92)" }}>
					<div className="text-[20px] leading-8">请打开手机录屏</div>
					<div className="mt-2 text-[14px] text-white/70">倒计时结束后，消息会从空白一条条出现</div>
					<div className="mt-6 font-medium text-[72px] leading-none">{left || active.countdownSec}</div>
					<button type="button" className="mt-8 text-[14px] text-white/70" onClick={() => setReplay(null)}>
						取消
					</button>
				</div>
			)}
			{(active.phase === "playing" || active.phase === "paused" || active.phase === "done") && (
				<div className="absolute inset-0 z-[60]" onClick={toggle} />
			)}
			{active.phase === "paused" && (
				<div className="absolute inset-x-0 top-14 z-[75] flex justify-center gap-3">
					<button type="button" className="h-9 rounded-full bg-black/70 px-4 text-[14px] text-white" onClick={toggle}>
						继续
					</button>
					<button type="button" className="h-9 rounded-full bg-white px-4 text-[14px]" onClick={() => setReplay(null)}>
						结束
					</button>
				</div>
			)}
			{active.phase === "done" && (
				<div className="absolute inset-x-0 bottom-8 z-[75] flex justify-center">
					<button type="button" className="h-9 rounded-full bg-black/70 px-4 text-[14px] text-white" onClick={() => setReplay(null)}>
						回放结束
					</button>
				</div>
			)}
		</>,
		screen,
	);
};

export default ReplayLayer;
