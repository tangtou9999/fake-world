import useScreenTopBg from "@/components/useScreenTopBg";
import type { ParsedItem } from "@/pages/wechat/conversation/ConversationFooter/importScreenshots";
import { previewLine } from "@/pages/wechat/conversation/ConversationFooter/importScreenshots";
import { type AiChatMessage, AI_CHAT_SYSTEM, aiChatsAtom } from "@/stateV2/aiChat";
import { geminiConfigAtom } from "@/stateV2/gemini";
import { GeminiBlockedError, callGemini } from "@/utils/gemini";
import { speakText, startRecording } from "@/utils/voice";
import { useAtom, useAtomValue } from "jotai";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { NavBar } from "../../addFriend/Shared";
import { type Level, applyAction, buildSystem, findMentioned, listContacts, parseAction, resolveTarget } from "./aiChatTools";

const AiChat = () => {
	useScreenTopBg("#EDEDED");
	const navigate = useNavigate();
	const [params] = useSearchParams();
	const from = params.get("from");
	const gemini = useAtomValue(geminiConfigAtom);
	const [state, setState] = useAtom(aiChatsAtom);
	const session = state.sessions.find((s) => s.id === state.activeId) ?? state.sessions[0];
	const [input, setInput] = useState("");
	const [busy, setBusy] = useState(false);
	const [withCtx, setWithCtx] = useState(true);
	const [voiceMode, setVoiceMode] = useState(false);
	const [rec, setRec] = useState<"idle" | "recording" | "processing">("idle");
	const [note, setNote] = useState("");
	const bottomRef = useRef<HTMLDivElement>(null);
	const holdRef = useRef(false);
	const recRef = useRef<Awaited<ReturnType<typeof startRecording>> | null>(null);
	const fromContact = from ? listContacts().find((c) => c.id === from) : undefined;

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ block: "end" });
	}, [session.messages.length, busy, session.id]);

	const updateSession = (id: string, fn: (m: AiChatMessage[]) => AiChatMessage[]) =>
		setState((s) => ({ ...s, sessions: s.sessions.map((x) => (x.id === id ? { ...x, messages: fn(x.messages) } : x)) }));

	const addSession = () =>
		setState((s) => {
			const no = s.counter + 1;
			const id = nanoid(6);
			return { ...s, counter: no, activeId: id, sessions: [...s.sessions, { id, no, messages: [] }] };
		});

	const clearSession = () => window.confirm("清空这个窗口的全部对话？") && updateSession(session.id, () => []);

	const removeSession = () => {
		if (state.sessions.length <= 1) return clearSession();
		if (!window.confirm(`删除「${session.no}号AI」窗口和里面的对话？`)) return;
		setState((s) => {
			const rest = s.sessions.filter((x) => x.id !== session.id);
			return { ...s, sessions: rest, activeId: rest[0].id };
		});
	};

	const send = async (text: string, viaVoice = false) => {
		const sid = session.id;
		const userMsg: AiChatMessage = { id: nanoid(8), role: "user", text, voice: viaVoice || undefined };
		const prior = session.messages.filter((m) => !m.error && !m.failed);
		updateSession(sid, (m) => [...m, userMsg]);
		setBusy(true);
		try {
			const contacts = listContacts();
			const mentioned = findMentioned([text, ...prior.slice(-6).map((m) => m.text)].join("\n"), contacts).map((c) => c.id);
			const ids = Array.from(new Set([...(from && withCtx ? [from] : []), ...mentioned])).slice(0, 4);
			let reply = "";
			let usedLevel: Level = 0;
			let blocked: unknown = null;
			for (const level of [0, 1, 2, 3] as Level[]) {
				const take = level === 0 ? 40 : level === 1 ? 6 : 0;
				let turns = take ? prior.slice(-take) : [];
				while (turns.length && turns[0].role !== "user") turns = turns.slice(1);
				try {
					reply = await callGemini(text, {
						history: turns.map((m) => ({ role: m.role, text: m.text })),
						system: buildSystem(AI_CHAT_SYSTEM, level, contacts, ids),
					});
					usedLevel = level;
					blocked = null;
					break;
				} catch (e) {
					if (e instanceof GeminiBlockedError) {
						blocked = e;
						continue;
					}
					throw e;
				}
			}
			if (blocked) throw blocked;
			const parsed = parseAction(reply.trim());
			const target = parsed.action ? resolveTarget(parsed.action.target, contacts, from) : undefined;
			const extra = usedLevel > 0 ? "\n\n（刚才触发了 Gemini 的内容拦截，这次自动缩减了上下文，我可能看不到完整的聊天记录。）" : "";
			updateSession(sid, (m) => [
				...m,
				{
					id: nanoid(8),
					role: "model",
					text: parsed.text + extra,
					action: parsed.action ? { ...parsed.action, targetId: target?.id } : undefined,
				},
			]);
			if (viaVoice && state.speak) speakText(parsed.text);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			updateSession(sid, (m) => [
				...m.map((x) => (x.id === userMsg.id ? { ...x, failed: true } : x)),
				{ id: nanoid(8), role: "model", error: true, text: `${msg}\n（这条已自动跳过，不会影响之后的对话，可以直接继续提问或换个说法。）` },
			]);
		} finally {
			setBusy(false);
		}
	};

	const onSend = () => {
		const t = input.trim();
		if (!t || busy) return;
		setInput("");
		void send(t);
	};

	const onDown = async () => {
		if (busy || rec !== "idle") return;
		holdRef.current = true;
		setNote("");
		setRec("recording");
		try {
			const r = await startRecording();
			if (!holdRef.current) {
				r.cancel();
				setRec("idle");
				return;
			}
			recRef.current = r;
			setTimeout(() => {
				if (recRef.current === r && holdRef.current) void onUp();
			}, 60000);
		} catch (e) {
			holdRef.current = false;
			setRec("idle");
			setNote(`无法使用麦克风：${e instanceof Error ? e.message : String(e)}（请在系统设置里允许浏览器使用麦克风）`);
		}
	};

	const onUp = async () => {
		if (!holdRef.current) return;
		holdRef.current = false;
		const r = recRef.current;
		recRef.current = null;
		if (!r) {
			setRec("idle");
			return;
		}
		const audio = r.stop();
		if (!audio) {
			setRec("idle");
			setNote("说话时间太短，请按住说话");
			return;
		}
		setRec("processing");
		try {
			const t = (await callGemini("请把这段语音逐字转写成文字（语言按说话内容）。只输出转写出的文字本身；如果听不清或没有说话，只输出：空", { audio })).trim();
			if (!t || t === "空") setNote("没听清，请再说一次");
			else await send(t, true);
		} catch (e) {
			setNote(e instanceof Error ? e.message : String(e));
		} finally {
			setRec("idle");
		}
	};

	const applyCard = (msg: AiChatMessage, mode: "append" | "replace") => {
		const a = msg.action;
		if (!a) return;
		const contacts = listContacts();
		const c = (a.targetId && contacts.find((x) => x.id === a.targetId)) || resolveTarget(a.target, contacts, from);
		if (!c) {
			window.alert(`找不到联系人「${a.target}」，请让 AI 用联系人列表里的名字重新输出。`);
			return;
		}
		const n = applyAction(c.id, { ...a, mode });
		updateSession(session.id, (m) =>
			m.map((x) => (x.id === msg.id && x.action ? { ...x, action: { ...x.action, applied: `已${mode === "replace" ? "替换为" : "追加"} ${n} 条，放进「${c.name}」的聊天了` } } : x)),
		);
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-[#EDEDED]">
			<NavBar
				title="AI 对话"
				right={
					<button type="button" aria-label="新建 AI 窗口" onClick={addSession} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[22px] leading-none">
						+
					</button>
				}
			/>
			<div className="flex shrink-0 items-center gap-2 overflow-x-auto whitespace-nowrap px-3 pb-2">
				{state.sessions.map((s) => (
					<button
						key={s.id}
						type="button"
						onClick={() => setState((v) => ({ ...v, activeId: s.id }))}
						className={`h-8 shrink-0 rounded-full px-4 text-[14px] ${s.id === session.id ? "bg-[#07C160] text-white" : "bg-white text-black/70"}`}
					>
						{s.no}号AI
					</button>
				))}
			</div>
			<div className="flex shrink-0 items-center gap-4 px-4 pb-2 text-[13px] text-[#576B95]">
				<button type="button" onClick={clearSession}>清空本窗口</button>
				<button type="button" onClick={removeSession}>删除本窗口</button>
				<button type="button" className="ml-auto" onClick={() => setState((s) => ({ ...s, speak: !s.speak }))}>
					语音提问时朗读：{state.speak ? "开" : "关"}
				</button>
			</div>
			<div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
				<div className="mx-auto mb-3 max-w-[92%] text-center text-[12px] text-black/40 leading-5">
					消息和被提到的聊天记录会通过你的密钥发给 Google Gemini 处理；对话只保存在这台手机的浏览器里。每个窗口的对话互相独立，但都能读取任何联系人的聊天。
				</div>
				{fromContact && (
					<button
						type="button"
						onClick={() => setWithCtx((v) => !v)}
						className={`mx-auto mb-3 block rounded-full px-3 py-1 text-[13px] ${withCtx ? "bg-[#07C160]/15 text-[#07C160]" : "bg-black/5 text-black/50"}`}
					>
						{withCtx ? "✓ 已带上与" : "未带上与"}「{fromContact.name}」的全部聊天
					</button>
				)}
				{!gemini.apiKey && (
					<button type="button" onClick={() => navigate("/wechat/my/settings/ai/key")} className="mx-auto mb-3 block h-10 rounded-[6px] bg-[#07C160] px-6 text-[15px] text-white">
						还没填密钥，去填写
					</button>
				)}
				{session.messages.length === 0 && gemini.apiKey && (
					<div className="mt-8 text-center text-[14px] text-black/40 leading-7">
						可以问我任何事：
						<br />
						「帮我把张三的聊天记录改成……」
						<br />
						「接着我和老妈的聊天往下写 20 条」
						<br />
						构思剧情、这个工具怎么用、个人的问题……
					</div>
				)}
				{session.messages.map((m) => (
					<div key={m.id} className={`mb-3 flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
						<div
							className={`max-w-[82%] whitespace-pre-wrap break-words rounded-[6px] px-3 py-[10px] text-[16px] leading-[23px] ${m.role === "user" ? (m.failed ? "bg-[#95EC69]/50" : "bg-[#95EC69]") : m.error ? "bg-[#FBE9E9] text-[#C62828]" : "bg-white"}`}
						>
							{m.voice ? "🎤 " : ""}
							{m.text}
						</div>
						{m.role === "model" && !m.error && m.text && (
							<button type="button" className="mt-1 text-[12px] text-black/35" onClick={() => speakText(m.text)}>
								🔊 朗读
							</button>
						)}
						{m.action && (
							<div className="mt-2 w-[88%] rounded-[8px] bg-white p-3">
								<div className="text-[14px] font-medium">
									准备放进「{m.action.target}」的聊天（{m.action.mode === "replace" ? "清空替换" : "追加"}，共 {m.action.items.length} 条）
								</div>
								<div className="mt-2 max-h-[160px] space-y-1 overflow-auto rounded-[6px] bg-[#F5F5F5] p-2 text-[13px] leading-5">
									{m.action.items.map((it, i) => (
										<div key={i}>{previewLine(it as ParsedItem)}</div>
									))}
								</div>
								{m.action.applied ? (
									<div className="mt-2 text-[13px] text-[#07C160]">✓ {m.action.applied}</div>
								) : (
									<div className="mt-2 grid grid-cols-2 gap-2">
										<button type="button" onClick={() => applyCard(m, "replace")} className={`h-10 rounded-[6px] text-[15px] ${m.action.mode === "replace" ? "bg-[#07C160] text-white" : "bg-black/5"}`}>
											清空替换
										</button>
										<button type="button" onClick={() => applyCard(m, "append")} className={`h-10 rounded-[6px] text-[15px] ${m.action.mode === "append" ? "bg-[#07C160] text-white" : "bg-black/5"}`}>
											追加到末尾
										</button>
									</div>
								)}
							</div>
						)}
					</div>
				))}
				{busy && <div className="mb-3 text-[14px] text-black/40">AI 正在写…</div>}
				<div ref={bottomRef} />
			</div>
			{note && <div className="bg-[#FBE9E9] px-4 py-2 text-[13px] text-[#C62828]">{note}</div>}
			<div className="flex items-end gap-2 border-t-[0.5px] border-t-[#D6D6D6] bg-[#F7F7F7] px-3 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))]">
				<button type="button" aria-label="切换语音/文字" onClick={() => setVoiceMode((v) => !v)} className="h-10 w-10 shrink-0 rounded-full border border-black text-[18px]">
					{voiceMode ? "⌨" : "🎤"}
				</button>
				{voiceMode ? (
					<button
						type="button"
						className={`h-10 flex-1 select-none rounded-[6px] text-[16px] ${rec === "recording" ? "bg-[#07C160] text-white" : "bg-white"}`}
						style={{ touchAction: "none", WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
						onContextMenu={(e) => e.preventDefault()}
						onPointerDown={() => void onDown()}
						onPointerUp={() => void onUp()}
						onPointerCancel={() => void onUp()}
						onPointerLeave={() => void onUp()}
					>
						{rec === "recording" ? "松开 发送" : rec === "processing" ? "识别中…" : "按住 说话"}
					</button>
				) : (
					<>
						<textarea
							rows={1}
							className="max-h-[120px] min-h-[40px] flex-1 resize-none rounded-[6px] bg-white px-3 py-[9px] text-[16px] leading-[22px] outline-none"
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder="和 AI 说点什么…"
						/>
						<button type="button" disabled={busy || !input.trim()} onClick={onSend} className="h-10 shrink-0 rounded-[6px] bg-[#07C160] px-4 text-[16px] text-white disabled:opacity-40">
							发送
						</button>
					</>
				)}
			</div>
		</div>
	);
};

export default AiChat;
