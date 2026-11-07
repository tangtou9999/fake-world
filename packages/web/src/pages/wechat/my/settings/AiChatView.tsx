import useScreenTopBg from "@/components/useScreenTopBg";
import type { ParsedItem } from "@/pages/wechat/conversation/ConversationFooter/importScreenshots";
import { previewLine } from "@/pages/wechat/conversation/ConversationFooter/importScreenshots";
import { type AiChatMessage, AI_CHAT_SYSTEM, CHAT_AI_SYSTEM, aiChatByConvAtom, aiChatsAtom } from "@/stateV2/aiChat";
import { DEFAULT_VOICE, type VoicePreset, geminiConfigAtom, resolveProfile, voicePresetsAtom } from "@/stateV2/gemini";
import { GeminiBlockedError, callGemini } from "@/utils/gemini";
import { geminiSpeak, stopSpeaking, unlockAudio, waitIdle } from "@/utils/tts";
import { startRecording } from "@/utils/voice";
import { useAtom } from "jotai";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavBar } from "../../addFriend/Shared";
import { type Level, applyAction, buildSystem, findMentioned, listContacts, parseAction, parseVoiceMake, resolveTarget } from "./aiChatTools";

type Props = { mode: "private" | "chat"; conversationId?: string };

const AiChatView = ({ mode, conversationId }: Props) => {
	useScreenTopBg("#EDEDED");
	const navigate = useNavigate();
	const [gemini, setGemini] = useAtom(geminiConfigAtom);
	const [presets, setPresets] = useAtom(voicePresetsAtom);
	const [speaking, setSpeaking] = useState(false);
	const [state, setState] = useAtom(aiChatsAtom);
	const [byConv, setByConv] = useAtom(aiChatByConvAtom);
	const session = state.sessions.find((s) => s.id === state.activeId) ?? state.sessions[0];
	const isChat = mode === "chat" && !!conversationId;
	const messages: AiChatMessage[] = isChat ? (byConv[conversationId as string] ?? []) : session.messages;
	const [input, setInput] = useState("");
	const [busyKeys, setBusyKeys] = useState<string[]>([]);
	const busyKey = isChat ? `c:${conversationId}` : `s:${session.id}`;
	const busy = busyKeys.includes(busyKey);
	const cancelled = useRef<Set<string>>(new Set());
	const [voiceMode, setVoiceMode] = useState(false);
	const [rec, setRec] = useState<"idle" | "recording" | "processing">("idle");
	const [note, setNote] = useState("");
	const [picker, setPicker] = useState(false);
	const bottomRef = useRef<HTMLDivElement>(null);
	const holdRef = useRef(false);
	const recRef = useRef<Awaited<ReturnType<typeof startRecording>> | null>(null);
	const allContacts = listContacts();
	const current = isChat ? allContacts.find((c) => c.id === conversationId) : undefined;
	const bound = (!isChat ? (session.boundIds ?? []) : []).map((id) => allContacts.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ block: "end" });
	}, [messages.length, busy, session.id]);

	const updateMessages = (fn: (m: AiChatMessage[]) => AiChatMessage[]) => {
		if (isChat) {
			const cid = conversationId as string;
			setByConv((s) => ({ ...s, [cid]: fn(s[cid] ?? []) }));
		} else {
			const sid = session.id;
			setState((s) => ({ ...s, sessions: s.sessions.map((x) => (x.id === sid ? { ...x, messages: fn(x.messages) } : x)) }));
		}
	};

	const addSession = () =>
		setState((s) => {
			const no = s.counter + 1;
			const id = nanoid(6);
			return { ...s, counter: no, activeId: id, sessions: [...s.sessions, { id, no, messages: [], boundIds: [] }] };
		});

	const clearSession = () => window.confirm(isChat ? "清空这个聊天的 AI 对话？（不会动聊天内容）" : "清空这个窗口的全部对话？") && updateMessages(() => []);

	const removeSession = () => {
		if (state.sessions.length <= 1) return clearSession();
		if (!window.confirm(`删除「${session.no}号AI」窗口和里面的对话？`)) return;
		setState((s) => {
			const rest = s.sessions.filter((x) => x.id !== session.id);
			return { ...s, sessions: rest, activeId: rest[0].id };
		});
	};

	const toggleBound = (id: string) =>
		setState((s) => ({
			...s,
			sessions: s.sessions.map((x) => {
				if (x.id !== session.id) return x;
				const cur = x.boundIds ?? [];
				return { ...x, boundIds: cur.includes(id) ? cur.filter((v) => v !== id) : [...cur, id].slice(-4) };
			}),
		}));

	const doSpeak = async (t: string) => {
		unlockAudio();
		setSpeaking(true);
		const n = await geminiSpeak(t, resolveProfile("ai"));
		if (n) setNote(n);
		else await waitIdle();
		setSpeaking(false);
	};

	const send = async (text: string, viaVoice = false) => {
		unlockAudio();
		setNote("");
		const userMsg: AiChatMessage = { id: nanoid(8), role: "user", text, voice: viaVoice || undefined };
		const prior = messages.filter((m) => !m.error && !m.failed);
		updateMessages((m) => [...m, userMsg]);
		const myKey = busyKey;
		setBusyKeys((k) => [...k, myKey]);
		try {
			const contacts = listContacts();
			let ids: string[];
			if (isChat) {
				const mentioned = findMentioned([text, ...prior.slice(-6).map((m) => m.text)].join("\n"), contacts).map((c) => c.id);
				ids = Array.from(new Set([conversationId as string, ...mentioned])).slice(0, 4);
			} else {
				ids = session.boundIds ?? [];
			}
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
						system: buildSystem(isChat ? CHAT_AI_SYSTEM : AI_CHAT_SYSTEM, level, contacts, ids, isChat ? { currentId: conversationId as string } : undefined),
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
			if (cancelled.current.delete(userMsg.id)) return;
			const vm = parseVoiceMake(reply.trim());
			const parsed = isChat ? parseAction(vm.text) : { text: vm.text, action: undefined };
			let saved = "";
			if (vm.make) {
				const preset: VoicePreset = { id: nanoid(6), name: vm.make.name, profile: vm.make.profile };
				setPresets((v) => [...v, preset]);
				saved = `\n\n✅ 已自动保存到声音库：「${preset.name}」（${preset.profile.voice} · 低音 ${preset.profile.chest}% · 气声 ${preset.profile.air}%），正在试听。可到「设置 → AI 模型与声音」里改名、选用。`;
				unlockAudio();
				void geminiSpeak(vm.make.sample, preset.profile).then((n) => n && setNote(n));
			}
			const target = parsed.action ? resolveTarget(parsed.action.target, contacts, conversationId) : undefined;
			const extra = usedLevel > 0 ? "\n\n（刚才触发了 Gemini 的内容拦截，这次自动缩减了上下文，我可能看不到完整的聊天记录。）" : "";
			updateMessages((m) => [
				...m,
				{
					id: nanoid(8),
					role: "model",
					text: parsed.text + saved + extra,
					action: parsed.action ? { ...parsed.action, targetId: target?.id } : undefined,
				},
			]);
			if (viaVoice && state.speak) void doSpeak(parsed.text);
		} catch (e) {
			if (cancelled.current.delete(userMsg.id)) return;
			const msg = e instanceof Error ? e.message : String(e);
			updateMessages((m) => [
				...m.map((x) => (x.id === userMsg.id ? { ...x, failed: true } : x)),
				{ id: nanoid(8), role: "model", error: true, text: `${msg}\n（这条已自动跳过，不会影响之后的对话，可以直接继续提问或换个说法。）` },
			]);
		} finally {
			setBusyKeys((k) => k.filter((x) => x !== myKey));
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
		unlockAudio();
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

	const applyCard = (msg: AiChatMessage, applyMode: "append" | "replace" | "range") => {
		const a = msg.action;
		if (!a) return;
		const contacts = listContacts();
		const c = (a.targetId && contacts.find((x) => x.id === a.targetId)) || resolveTarget(a.target, contacts, conversationId);
		if (!c) {
			window.alert(`找不到联系人「${a.target}」，请让 AI 用联系人列表里的名字重新输出。`);
			return;
		}
		const n = applyAction(c.id, { ...a, mode: applyMode });
		const verb = applyMode === "append" ? "追加" : applyMode === "range" ? "替换该时间段为" : "整个替换为";
		updateMessages((m) =>
			m.map((x) => (x.id === msg.id && x.action ? { ...x, action: { ...x.action, applied: `已${verb} ${n} 条，放进「${c.name}」的聊天了` } } : x)),
		);
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-[#EDEDED]">
			<NavBar
				title={isChat ? `AI · ${current?.name ?? "当前聊天"}` : "私人 AI"}
				right={
					isChat ? undefined : (
						<button type="button" aria-label="新建 AI 窗口" onClick={addSession} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[22px] leading-none">
							+
						</button>
					)
				}
			/>
			{!isChat && (
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
			)}
			<div className="flex shrink-0 items-center gap-2 px-4 pb-2 text-[13px] text-black/60">
				朗读声音
				<select
					className="h-7 min-w-0 flex-1 rounded-[6px] bg-white px-2 text-[13px] outline-none"
					value={gemini.assign?.ai ?? ""}
					onChange={(e) => setGemini((c) => ({ ...c, assign: { ...c.assign, ai: e.target.value || undefined } }))}
				>
					<option value="">默认（{DEFAULT_VOICE.ai}）</option>
					{presets.map((p) => (
						<option key={p.id} value={p.id}>
							{p.name}
						</option>
					))}
				</select>
				{speaking && (
					<button
						type="button"
						className="shrink-0 text-[#07C160]"
						onClick={() => {
							stopSpeaking();
							setSpeaking(false);
						}}
					>
						🔊 停止朗读
					</button>
				)}
			</div>
			<div className="flex shrink-0 items-center gap-4 px-4 pb-2 text-[13px] text-[#576B95]">
				<button type="button" onClick={clearSession}>清空对话</button>
				{!isChat && <button type="button" onClick={removeSession}>删除本窗口</button>}
				<button type="button" className="ml-auto" onClick={() => setState((s) => ({ ...s, speak: !s.speak }))}>
					语音提问时朗读：{state.speak ? "开" : "关"}
				</button>
			</div>
			{!isChat && (
				<div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pb-2 text-[13px]">
					<span className="text-black/40">绑定的聊天：</span>
					{bound.map((c) => (
						<span key={c.id} className="rounded-full bg-[#07C160]/15 px-3 py-[2px] text-[#07C160]">
							{c.name}
						</span>
					))}
					<button type="button" onClick={() => setPicker(true)} className="rounded-full bg-white px-3 py-[2px] text-[#576B95]">
						{bound.length ? "修改" : "选择聊天"}
					</button>
				</div>
			)}
			<div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
				<div className="mx-auto mb-3 max-w-[92%] text-center text-[12px] text-black/40 leading-5">
					{isChat
						? "这是这个聊天专属的 AI：能读取这个聊天的全部记录，并直接修改它（包括改之前某一段）。对话只保存在这台手机上，每个聊天各有各的 AI。"
						: "私人 AI：可以绑定聊天让它读取，但不会改动聊天。消息和绑定聊天的记录会通过你的密钥发给 Google Gemini 处理，对话只保存在这台手机上。"}
				</div>
				{!(gemini.apiKey || gemini.apiKey2) && (
					<button type="button" onClick={() => navigate("/wechat/my/settings/ai/key")} className="mx-auto mb-3 block h-10 rounded-[6px] bg-[#07C160] px-6 text-[15px] text-white">
						还没填密钥，去填写
					</button>
				)}
				{messages.length === 0 && (gemini.apiKey || gemini.apiKey2) && (
					<div className="mt-8 text-center text-[14px] text-black/40 leading-7">
						{isChat ? (
							<>
								「接着聊下去，写 20 条」
								<br />
								「把昨天晚上那一段改成吵架」
								<br />
								「对方回复得冷淡一点」
							</>
						) : (
							<>
								可以问我任何事：
								<br />
								构思剧情、这个工具怎么用、
								<br />
								个人的问题……
								<br />
								（点上面“选择聊天”，可以让我读取某个聊天）
							</>
						)}
					</div>
				)}
				{messages.map((m) => (
					<div key={m.id} className={`mb-3 flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
						<div
							className={`max-w-[82%] whitespace-pre-wrap break-words rounded-[6px] px-3 py-[10px] text-[16px] leading-[23px] ${m.role === "user" ? (m.failed ? "bg-[#95EC69]/50" : "bg-[#95EC69]") : m.error ? "bg-[#FBE9E9] text-[#C62828]" : "bg-white"}`}
						>
							{m.voice ? "🎤 " : ""}
							{m.text}
						</div>
						{m.role === "model" && !m.error && m.text && (
							<button type="button" className="mt-1 text-[12px] text-black/35" onClick={() => void doSpeak(m.text)}>
								🔊 朗读
							</button>
						)}
						{m.action && (
							<div className="mt-2 w-[88%] rounded-[8px] bg-white p-3">
								<div className="text-[14px] font-medium">
									{m.action.mode === "range"
										? `准备修改「${m.action.target}」${m.action.from} ~ ${m.action.to} 这一段（替换为 ${m.action.items.length} 条）`
										: `准备放进「${m.action.target}」的聊天（${m.action.mode === "replace" ? "清空整个聊天并替换" : "追加到末尾"}，共 ${m.action.items.length} 条）`}
								</div>
								<div className="mt-2 max-h-[160px] space-y-1 overflow-auto rounded-[6px] bg-[#F5F5F5] p-2 text-[13px] leading-5">
									{m.action.items.map((it, i) => (
										<div key={i}>{previewLine(it as ParsedItem)}</div>
									))}
								</div>
								{m.action.applied ? (
									<div className="mt-2 text-[13px] text-[#07C160]">✓ {m.action.applied}</div>
								) : (
									m.action.mode === "range" ? (
										<button type="button" onClick={() => applyCard(m, "range")} className="mt-2 h-10 w-full rounded-[6px] bg-[#07C160] text-[15px] text-white">
											应用修改（只改这一段）
										</button>
									) : (
									<div className="mt-2 grid grid-cols-2 gap-2">
										<button type="button" onClick={() => applyCard(m, "replace")} className={`h-10 rounded-[6px] text-[15px] ${m.action.mode === "replace" ? "bg-[#07C160] text-white" : "bg-black/5"}`}>
											清空替换
										</button>
										<button type="button" onClick={() => applyCard(m, "append")} className={`h-10 rounded-[6px] text-[15px] ${m.action.mode === "append" ? "bg-[#07C160] text-white" : "bg-black/5"}`}>
											追加到末尾
										</button>
									</div>
									)
								)}
							</div>
						)}
					</div>
				))}
				{busy && (
					<div className="mb-3 flex items-center gap-3 text-[14px] text-black/40">
						AI 正在写…（最多等 60 秒）
						<button
							type="button"
							className="text-[#576B95]"
							onClick={() => {
								const last = [...messages].reverse().find((m) => m.role === "user");
								if (last) cancelled.current.add(last.id);
								setBusyKeys((k) => k.filter((x) => x !== busyKey));
								updateMessages((m) => m.map((x) => (x.id === last?.id ? { ...x, failed: true } : x)));
							}}
						>
							停止
						</button>
					</div>
				)}
				<div ref={bottomRef} />
			</div>
			{picker && (
				<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setPicker(false)}>
					<div className="max-h-[70%] overflow-auto rounded-t-[12px] bg-white pb-[env(safe-area-inset-bottom)]" onClick={(e) => e.stopPropagation()}>
						<div className="border-black/5 border-b px-4 py-3 text-center font-medium text-[16px]">选择要绑定的聊天（最多 4 个）</div>
						{allContacts.map((c) => {
							const on = (session.boundIds ?? []).includes(c.id);
							return (
								<button key={c.id} type="button" onClick={() => toggleBound(c.id)} className="flex w-full items-center justify-between border-black/5 border-b px-4 py-3 text-left text-[16px]">
									{c.name}
									<span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[12px] ${on ? "border-[#07C160] bg-[#07C160] text-white" : "border-black/20"}`}>{on ? "✓" : ""}</span>
								</button>
							);
						})}
						<button type="button" onClick={() => setPicker(false)} className="h-[52px] w-full text-[16px] text-[#07C160]">完成</button>
					</div>
				</div>
			)}
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

export default AiChatView;
