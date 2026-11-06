import useScreenTopBg from "@/components/useScreenTopBg";
import { type AiChatMessage, AI_CHAT_SYSTEM, aiChatHistoryAtom } from "@/stateV2/aiChat";
import { EConversationType, getConversationListValueSnapshot } from "@/stateV2/conversation";
import { geminiConfigAtom } from "@/stateV2/gemini";
import { getProfileValueSnapshot } from "@/stateV2/profile";
import { callGemini } from "@/utils/gemini";
import { useAtom, useAtomValue } from "jotai";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";
import { Node } from "slate";
import { useNavigate, useSearchParams } from "react-router-dom";
import { NavBar } from "../../addFriend/Shared";

const buildContext = (conversationId: string) => {
	const p = getProfileValueSnapshot(conversationId);
	const name = p?.remark || p?.nickname || "对方";
	const lines = getConversationListValueSnapshot(conversationId)
		.slice(-25)
		.map((v) => {
			const who = v.role === "mine" ? "我" : name;
			if (v.type === EConversationType.text) {
				const t = (v as unknown as { textContent: Parameters<typeof Node.string>[0][] }).textContent
					.map((n) => Node.string(n))
					.join("");
				return `${who}：${t}`;
			}
			return `${who}：[${v.type}]`;
		});
	return { name, text: lines.join("\n") };
};

const AiChat = () => {
	useScreenTopBg("#EDEDED");
	const navigate = useNavigate();
	const [params] = useSearchParams();
	const from = params.get("from");
	const gemini = useAtomValue(geminiConfigAtom);
	const [history, setHistory] = useAtom(aiChatHistoryAtom);
	const [input, setInput] = useState("");
	const [busy, setBusy] = useState(false);
	const [withCtx, setWithCtx] = useState(true);
	const bottomRef = useRef<HTMLDivElement>(null);
	const ctx = from ? buildContext(from) : null;

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ block: "end" });
	}, [history.length, busy]);

	const send = async () => {
		const text = input.trim();
		if (!text || busy) return;
		const userMsg: AiChatMessage = { id: nanoid(8), role: "user", text };
		const prior = history.filter((m) => !m.error);
		setHistory([...history, userMsg]);
		setInput("");
		setBusy(true);
		try {
			let turns = prior.slice(-40).map((m) => ({ role: m.role, text: m.text }));
			while (turns.length && turns[0].role !== "user") turns = turns.slice(1);
			const system =
				AI_CHAT_SYSTEM +
				(ctx && withCtx
					? `\n\n当前正在编辑的聊天：我和「${ctx.name}」。最近的聊天记录：\n${ctx.text || "（还没有消息）"}`
					: "");
			const reply = await callGemini(text, { history: turns, system });
			setHistory((h) => [...h, { id: nanoid(8), role: "model", text: reply.trim() }]);
		} catch (e) {
			setHistory((h) => [
				...h,
				{ id: nanoid(8), role: "model", text: e instanceof Error ? e.message : String(e), error: true },
			]);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-[#EDEDED]">
			<NavBar
				title="AI 对话"
				right={
					history.length > 0 ? (
						<button
							type="button"
							className="text-[15px] text-[#576B95]"
							onClick={() => window.confirm("清空全部对话记录？") && setHistory([])}
						>
							清空
						</button>
					) : undefined
				}
			/>
			<div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
				<div className="mx-auto mt-2 mb-3 max-w-[92%] text-center text-[12px] text-black/40 leading-5">
					消息会通过你的密钥发给 Google Gemini 处理；对话记录只保存在这台手机的浏览器里，点右上角「清空」即可删除。
				</div>
				{ctx && (
					<button
						type="button"
						onClick={() => setWithCtx((v) => !v)}
						className={`mx-auto mb-3 block rounded-full px-3 py-1 text-[13px] ${withCtx ? "bg-[#07C160]/15 text-[#07C160]" : "bg-black/5 text-black/50"}`}
					>
						{withCtx ? "✓ 已带上与" : "未带上与"}「{ctx.name}」的聊天
					</button>
				)}
				{!gemini.apiKey && (
					<button type="button" onClick={() => navigate("/wechat/my/settings/ai/key")} className="mx-auto mb-3 block h-10 rounded-[6px] bg-[#07C160] px-6 text-[15px] text-white">
						还没填密钥，去填写
					</button>
				)}
				{history.length === 0 && gemini.apiKey && (
					<div className="mt-10 text-center text-[14px] text-black/40 leading-7">
						可以问我任何事：
						<br />
						构思剧情、写对白、这个工具怎么用、<br />
						个人的问题和烦恼……
					</div>
				)}
				{history.map((m) => (
					<div key={m.id} className={`mb-3 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
						<div
							className={`max-w-[82%] whitespace-pre-wrap break-words rounded-[6px] px-3 py-[10px] text-[16px] leading-[23px] ${m.role === "user" ? "bg-[#95EC69]" : m.error ? "bg-[#FBE9E9] text-[#C62828]" : "bg-white"}`}
						>
							{m.text}
						</div>
					</div>
				))}
				{busy && <div className="mb-3 text-[14px] text-black/40">AI 正在写…</div>}
				<div ref={bottomRef} />
			</div>
			<div className="flex items-end gap-2 border-t-[0.5px] border-t-[#D6D6D6] bg-[#F7F7F7] px-3 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))]">
				<textarea
					rows={1}
					className="max-h-[120px] min-h-[40px] flex-1 resize-none rounded-[6px] bg-white px-3 py-[9px] text-[16px] leading-[22px] outline-none"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="和 AI 说点什么…"
				/>
				<button
					type="button"
					disabled={busy || !input.trim()}
					onClick={send}
					className="h-10 shrink-0 rounded-[6px] bg-[#07C160] px-4 text-[16px] text-white disabled:opacity-40"
				>
					发送
				</button>
			</div>
		</div>
	);
};

export default AiChat;
