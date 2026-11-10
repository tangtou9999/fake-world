import { parseJsonLoose } from "@/utils/gemini";
import Notepad, { notepadAtom } from "./Notepad";
import CopyBlock, { parseSegments } from "./CopyBlock";
import { applyOps, describeOp, parseOps } from "./chatOps";
import SearchOutlinedSVG from "@/assets/search-outlined.svg?react";
import useScreenTopBg from "@/components/useScreenTopBg";
import type { ParsedItem } from "@/pages/wechat/conversation/ConversationFooter/importScreenshots";
import { previewLine } from "@/pages/wechat/conversation/ConversationFooter/importScreenshots";
import { type AiChatMessage, AI_CHAT_SYSTEM, CHAT_AI_SYSTEM, aiChatByConvAtom, aiChatsAtom } from "@/stateV2/aiChat";
import { isGroupId } from "@/stateV2/group";
import { callScheduleAtom } from "@/stateV2/videoCall";
import { AI_PROVIDERS, type AiProvider, aiProviderAtom, geminiConfigAtom, resolveProfile, voicePresetsAtom } from "@/stateV2/gemini";
import { GeminiBlockedError, callGemini } from "@/utils/gemini";
import { geminiSpeak, stopSpeaking, unlockAudio, waitIdle } from "@/utils/tts";
import { useAtom, useSetAtom } from "jotai";
import { nanoid } from "nanoid";
import { parseAt } from "@/utils/parseAt";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavBar } from "../../addFriend/Shared";
import { type Level, applyAction, buildSystem, findMentioned, listContacts, parseAction, parseVoiceMake, resolveTarget } from "./aiChatTools";

type Props = { mode: "private" | "chat"; conversationId?: string };

const needsFix = (r: string, ask = ""): string => {
	const m = r.match(/```wxchat\s*([\s\S]*?)```/);
	if (!m && /```wxops/.test(r)) return "";
	// 代码块写到一半被截断（有开头没有结尾的 ```）：以前会被悄悄吃掉，现在要求重出
	if (!m && /```wxchat/.test(r))
		return "你上一条的 ```wxchat 代码块没有写完（缺少结尾的 ```），聊天里什么都没有生成。请重新输出：一句简短说明 + 完整并闭合的 ```wxchat 代码块；如果内容很多，就少写几条，保证代码块完整。";
	if (!m && /(删除|删掉|改时间|改成|挪到|移到|调整时间|修改)/.test(ask) && /(这就|马上|现在|已经|帮你|好的|我来).{0,20}(删|改|挪|调|修改)/.test(r))
		return "你上一条只说了要修改，却没有附 ```wxops 代码块，聊天里什么都没有变。请现在重新输出：一句简短说明 + 完整的 ```wxops 代码块（id 必须照抄聊天记录里 # 后面的内容）。";
	if (!m) {
		// 「怎么生成聊天记录」这类纯提问不算要执行
		const isQuestion = /(怎么|如何|为什么|是什么|什么意思)/.test(ask);
		const asked =
			!isQuestion &&
			(/(生成|追加|写入|补).{0,10}(聊天记录|记录|对话)|^(生成|写)/.test(ask) ||
				(/(生成|追加|写入|补上|重写|重新生成|替换|写进|放进|放到|再放|发一些|发几|发点|发个)/.test(ask) &&
					/(聊天|记录|消息|转账|红包|表情|窗口|对话|聊天框|一段|几条)/.test(ask)));
		// 回复以冒号结尾、后面却什么都没有：说明本该跟着的内容丢了
		const bare = r.replace(/```[\s\S]*?(```|$)/g, "").trim();
		const dangling = /[：:]$/.test(bare) && !/```copy/.test(r);
		const promised = asked || dangling || /(现在|这就|马上|重新|立刻|接下来|下面).{0,14}(生成|写|发|输出|追加|记录)|忘了附|没有附/.test(r);
		return promised && !/```wx(voice|call)/.test(r)
			? "你上一条只说了要生成，却没有附 ```wxchat 代码块，聊天里什么都没有生成。请现在重新输出：一句简短说明 + 完整的 ```wxchat 代码块（每一项都要有 at 日期时间）。"
			: "";
	}
	try {
		const j = parseJsonLoose<{ items?: { at?: string }[] }>(m[1]);
		if (!Array.isArray(j.items) || j.items.length === 0)
			return "你上一条的 ```wxchat 代码块里 items 是空的，聊天里什么都没有生成。请重新输出带完整 items 的 ```wxchat 代码块（每一项都要有 at）。";
		if (Array.isArray(j.items) && j.items.some((v) => !v?.at))
			return "你上一条的代码块里有些 items 没有写 at。每一项都必须有 at（YYYY-MM-DD HH:mm），并且严格按用户要求的真实日期。请重新输出完整的 ```wxchat 代码块。";
		if (Array.isArray(j.items) && j.items.some((v) => parseAt(v?.at) === null))
			return "你上一条的代码块里有 at 的日期格式系统认不出来。at 必须是半角的 YYYY-MM-DD HH:mm（带四位年份、24 小时制，如 2026-01-06 12:00）。请重新输出完整的 ```wxchat 代码块。";
	} catch {
		return "";
	}
	return "";
};

const AiChatView = ({ mode, conversationId }: Props) => {
	useScreenTopBg("#EDEDED");
	const navigate = useNavigate();
	const [gemini] = useAtom(geminiConfigAtom);
	const setPresets = useSetAtom(voicePresetsAtom);
	const setSched = useSetAtom(callScheduleAtom);
	const [speaking, setSpeaking] = useState(false);
	const [state, setState] = useAtom(aiChatsAtom);
	const [byConv, setByConv] = useAtom(aiChatByConvAtom);
	const [providers, setProviders] = useAtom(aiProviderAtom);
	const session = state.sessions.find((s) => s.id === state.activeId) ?? state.sessions[0];
	const isChat = mode === "chat" && !!conversationId;
	const isGroupChat = isChat && isGroupId(conversationId);
	const messages: AiChatMessage[] = isChat ? (byConv[conversationId as string] ?? []) : session.messages;
	const [input, setInput] = useState("");
	const [toast, setToast] = useState("");
	const showToast = (r: "copied" | "selected" | "saved") => {
		setToast(r === "copied" ? "已复制" : r === "saved" ? "已存到记事本" : "已选中，请长按选择「拷贝」");
		window.setTimeout(() => setToast(""), 1600);
	};
	const [notepad, setNotepad] = useState(false);
	const setNotes = useSetAtom(notepadAtom);
	const saveToNotepad = (text: string) => {
		setNotes((v) => [{ id: nanoid(8), title: "", content: text, at: Date.now() }, ...v]);
		showToast("saved");
	};
	const [searching, setSearching] = useState(false);
	const [sq, setSq] = useState("");
	const jumpTo = (sid: string | undefined, mid: string) => {
		setSearching(false);
		setSq("");
		if (sid && sid !== session.id) setState((v) => ({ ...v, activeId: sid }));
		window.setTimeout(() => {
			const el = document.querySelector(`[data-mid="${mid}"]`);
			if (!el) return;
			el.scrollIntoView({ block: "center" });
			el.classList.add("wx-flash");
			window.setTimeout(() => el.classList.remove("wx-flash"), 1800);
		}, 350);
	};
	const sKey = sq.trim().toLowerCase();
	const hits = sKey
		? (isChat ? [{ sid: undefined as string | undefined, name: "", msgs: messages }] : state.sessions.map((x) => ({ sid: x.id as string | undefined, name: x.name || `${x.no}号AI`, msgs: x.messages })))
				.flatMap((g) => g.msgs.filter((m) => m.text.toLowerCase().includes(sKey)).map((m) => ({ sid: g.sid, name: g.name, m })))
				.slice(-60)
				.reverse()
		: [];
	const [busyKeys, setBusyKeys] = useState<string[]>([]);
	const busyKey = isChat ? `c:${conversationId}` : `s:${session.id}`;
	const busy = busyKeys.includes(busyKey);
	const cancelled = useRef<Set<string>>(new Set());
	const lastTab = useRef({ id: "", t: 0 });
	const [note, setNote] = useState("");
	const [picker, setPicker] = useState(false);
	const bottomRef = useRef<HTMLDivElement>(null);
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
			// 新窗口排在最前面；名字取最小的还没被占用的「N号AI」（1号被改名了或删了，新窗口就叫 1号AI）
			const used = new Set(s.sessions.map((x) => x.name || `${x.no}号AI`));
			let no = 1;
			while (used.has(`${no}号AI`)) no++;
			const id = nanoid(6);
			return { ...s, counter: Math.max(s.counter, no), activeId: id, sessions: [{ id, no, messages: [], boundIds: [] }, ...s.sessions] };
		});

	const clearSession = () => window.confirm(isChat ? "清空这个聊天的 AI 对话？（不会动聊天内容）" : "清空这个窗口的全部对话？") && updateMessages(() => []);

	const removeSession = () => {
		if (state.sessions.length <= 1) return clearSession();
		if (!window.confirm(`删除「${session.name || `${session.no}号AI`}」窗口和里面的对话？`)) return;
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

	const send = async (text: string) => {
		unlockAudio();
		setNote("");
		const userMsg: AiChatMessage = { id: nanoid(8), role: "user", text };
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
			let lastTurns: { role: "user" | "model"; text: string }[] = [];
			let lastSystem = "";
			for (const level of [0, 1, 2, 3] as Level[]) {
				const take = level === 0 ? 40 : level === 1 ? 6 : 0;
				let turns = take ? prior.slice(-take) : [];
				while (turns.length && turns[0].role !== "user") turns = turns.slice(1);
				try {
					lastTurns = turns.map((m) => ({ role: m.role, text: m.text }));
					lastSystem = buildSystem(isChat ? CHAT_AI_SYSTEM : AI_CHAT_SYSTEM, level, contacts, ids, isChat ? { currentId: conversationId as string } : undefined);
					reply = await callGemini(text, { windowKey: myKey, history: lastTurns, system: lastSystem });
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
			// AI 偶尔嘴上说生成却漏了代码块，或漏了日期：自动让它重出，最多 2 次
			for (let retry = 0; retry < 2 && isChat; retry++) {
				const fix = needsFix(reply, text);
				if (!fix) break;
				try {
					reply = await callGemini(fix, {
						windowKey: myKey,
						history: [...lastTurns, { role: "user", text }, { role: "model", text: reply }],
						system: lastSystem,
					});
				} catch {
					break;
				}
			}
			if (cancelled.current.delete(userMsg.id)) return;
			const vm = parseVoiceMake(reply.trim());
			const cm = isChat ? vm.text.match(/```wxcall\s*([\s\S]*?)```/) : null;
			const callMinutes = cm ? Number((cm[1].match(/-?\d+(\.\d+)?/) ?? [])[0]) : Number.NaN;
			const vmText = isChat ? vm.text.replace(/```wxcall[\s\S]*?(```|$)/g, "").trim() : vm.text;
			const po = isChat ? parseOps(vmText) : { text: vmText, ops: undefined };
			const parsed = isChat ? parseAction(po.text) : { text: vm.text, action: undefined };
			// 目标锁定当前窗口：只有用户这一句话里明确点名了别的联系人，才听 AI 写的 target；
			// 否则（比如之前对话里提过「老妈」，AI 就把 target 写成老妈）一律写进当前聊天
			const curContact = isChat ? contacts.find((c) => c.id === conversationId) : undefined;
			const userNamedOther = isChat && findMentioned(text, contacts).some((c) => c.id !== conversationId);
			const lockCur = (t: (typeof contacts)[number] | undefined) => (curContact && !userNamedOther ? curContact : t);
			const opsTarget = po.ops ? lockCur(resolveTarget(po.ops.target, contacts, conversationId)) : undefined;

			const target = parsed.action ? lockCur(resolveTarget(parsed.action.target, contacts, conversationId)) : undefined;
			let failNote = "";
			if (isChat && !parsed.action && !po.ops && !Number.isFinite(callMinutes) && !vm.make && !parsed.text.includes("（AI 附上的") && needsFix(reply, text)) {
				failNote = "\n\n⚠️ 这次没有写入：AI 没有输出有效的聊天数据（重试 2 次也没成功），聊天里没有任何改动。可以再发一次，或把一次要生成的条数减少、换个更强的模型。";
			}
			const extra = (usedLevel > 0 ? "\n\n（刚才触发了 Gemini 的内容拦截，这次自动缩减了上下文，我可能看不到完整的聊天记录。）" : "") + failNote;
			updateMessages((m) => [
				...m,
				{
					id: nanoid(8),
					role: "model",
					text: parsed.text + extra,
					voiceMake: vm.make ? { name: vm.make.name, sample: vm.make.sample, profile: { voice: vm.make.profile.voice, chest: vm.make.profile.chest ?? 0, air: vm.make.profile.air ?? 0, accent: vm.make.profile.accent ?? "默认自然口语", persona: vm.make.profile.persona ?? "" } } : undefined,
					action: parsed.action ? { ...parsed.action, targetId: target?.id } : undefined,
					ops: po.ops ? { ...po.ops, targetId: opsTarget?.id } : undefined,
					callMake: Number.isFinite(callMinutes) ? { minutes: Math.min(Math.max(callMinutes, 0), 1440) } : undefined,
				},
			]);
			if (state.speak) void doSpeak(parsed.text);
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
					<div className="flex items-center gap-2">
						<select
							aria-label="选择模型"
							value={providers[busyKey] ?? "gemini"}
							onChange={(e) => setProviders((v) => ({ ...v, [busyKey]: e.target.value as AiProvider }))}
							className="h-8 max-w-[132px] rounded-full bg-white px-2 text-[13px] text-black/80 outline-none"
						>
							{AI_PROVIDERS.map((p) => (
								<option key={p.id} value={p.id}>
									{p.label}
								</option>
							))}
						</select>
						<button type="button" aria-label="搜索聊天记录" onClick={() => setSearching(true)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
							<SearchOutlinedSVG width={22} height={22} fill="rgba(0,0,0,0.8)" />
						</button>
						{!isChat && (
							<button type="button" aria-label="新建 AI 窗口" onClick={addSession} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[22px] leading-none">
								+
							</button>
						)}
					</div>
				}
			/>
			{!isChat && (
				<div className="flex shrink-0 items-center gap-2 overflow-x-auto whitespace-nowrap px-3 pb-2">
					{state.sessions.map((s) => (
						<button
							key={s.id}
							type="button"
							onClick={() => {
								const now = Date.now();
								if (lastTab.current.id === s.id && now - lastTab.current.t < 400) {
									lastTab.current = { id: "", t: 0 };
									const n = window.prompt("给这个窗口起个名字（方便记住聊了什么）", s.name || `${s.no}号AI`)?.trim();
									if (n) setState((v) => ({ ...v, sessions: v.sessions.map((x) => (x.id === s.id ? { ...x, name: n } : x)) }));
									return;
								}
								lastTab.current = { id: s.id, t: now };
								setState((v) => ({ ...v, activeId: s.id }));
							}}
							className={`h-8 shrink-0 rounded-full px-4 text-[14px] ${s.id === session.id ? "bg-[#07C160] text-white" : "bg-white text-black/70"}`}
						>
							{s.name || `${s.no}号AI`}
						</button>
					))}
				</div>
			)}
			<div className="flex shrink-0 items-center gap-4 px-4 pb-2 text-[13px] text-[#576B95]">
				{(
					<button type="button" aria-label="记事本" className="rounded-full bg-white px-3 py-[2px] text-black/80" onClick={() => setNotepad(true)}>
						📝 记事本
					</button>
				)}
				<button type="button" onClick={clearSession}>清空对话</button>
				{!isChat && <button type="button" onClick={removeSession}>删除本窗口</button>}
				{speaking && (
					<button
						type="button"
						className="ml-auto text-[#07C160]"
						onClick={() => {
							stopSpeaking();
							setSpeaking(false);
						}}
					>
						🔊 停止
					</button>
				)}
				<button type="button" className={speaking ? "" : "ml-auto"} onClick={() => setState((s) => ({ ...s, speak: !s.speak }))}>
					朗读回复：{state.speak ? "开" : "关"}
				</button>
			</div>
			{!isChat && (
				<div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pb-2 text-[13px]">
					<span className="text-black/40">绑定的聊天：</span>
					{bound.length === 0 && <span className="text-black/40">无</span>}
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
						{isGroupChat ? (
							<>
								「群里接着聊，大家吵吵闹闹写 30 条」
								<br />
								「阿美发个红包，其他人抢完起哄」
								<br />
								「小王和小李为了吃什么吵起来」
							</>
						) : isChat ? (
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
					<div key={m.id} data-mid={m.id} className={`mb-3 flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
						<div
							className={`max-w-[82%] whitespace-pre-wrap break-words rounded-[6px] px-3 py-[10px] text-[16px] leading-[23px] ${m.role === "user" ? (m.failed ? "bg-[#95EC69]/50" : "bg-[#95EC69]") : m.error ? "bg-[#FBE9E9] text-[#C62828]" : "bg-white"}`}
						>
							{m.voice ? "🎤 " : ""}
							{m.role === "model" && !m.error && m.text.includes("```")
								? parseSegments(m.text).map((seg, i) =>
										seg.type === "copy" ? <CopyBlock key={i} content={seg.content} onResult={showToast} /> : <div key={i}>{seg.content}</div>,
									)
								: m.text}
						</div>
						{m.role === "model" && !m.error && m.text.trim() && (
							<button type="button" aria-label="存到记事本" className="mt-1 ml-1 text-[12px] text-[#576B95]" onClick={() => saveToNotepad(m.text.replace(/```(wxchat|wxops|wxvoice|wxcall)[\s\S]*?```/g, "").trim())}>
								存到记事本
							</button>
						)}
						{m.callMake && (
							<div className="mt-2 w-[88%] rounded-[8px] bg-white p-3">
								<div className="font-medium text-[14px]">📹 {m.callMake.minutes <= 0 ? "马上让对方打视频过来" : `${m.callMake.minutes} 分钟后让对方打视频过来`}</div>
								<div className="mt-1 text-[12px] text-black/40 leading-5">需要先在聊天页「连点三下屏幕 → 视频」里上传两段视频，并停留在这个聊天页面里。</div>
								{m.callMake.done ? (
									<div className="mt-2 text-[13px] text-[#07C160]">已设置</div>
								) : (
									<button
										type="button"
										className="mt-2 h-9 rounded-[6px] bg-[#07C160] px-4 text-[14px] text-white"
										onClick={() => {
											const cid = conversationId as string;
											setSched((v) => ({ ...v, [cid]: Date.now() + (m.callMake?.minutes ?? 0) * 60000 }));
											updateMessages((all) => all.map((x) => (x.id === m.id && x.callMake ? { ...x, callMake: { ...x.callMake, done: true } } : x)));
										}}
									>
										设置
									</button>
								)}
							</div>
						)}
						{m.voiceMake && (
							<div className="mt-2 w-[88%] rounded-[8px] bg-white p-3">
								<div className="font-medium text-[14px]">🎙 AI 为你调好了一个声音</div>
								<input
									className="mt-2 h-9 w-full rounded-[6px] bg-[#F5F5F5] px-2 text-[14px] outline-none"
									value={m.voiceMake.name}
									maxLength={16}
									disabled={m.voiceMake.saved}
									onChange={(e) => updateMessages((all) => all.map((x) => (x.id === m.id && x.voiceMake ? { ...x, voiceMake: { ...x.voiceMake, name: e.target.value } } : x)))}
								/>
								<div className="mt-2 text-[12px] text-black/50 leading-5">
									声纹 {m.voiceMake.profile.voice} · 低音共鸣 {m.voiceMake.profile.chest}% · 高频气声 {m.voiceMake.profile.air}%
									{m.voiceMake.profile.persona ? ` · ${m.voiceMake.profile.persona}` : ""}
								</div>
								{m.voiceMake.saved ? (
									<div className="mt-2 text-[13px] text-[#07C160]">✓ 已保存到声音库，可在聊天的「声音」里选用</div>
								) : (
									<div className="mt-2 grid grid-cols-2 gap-2">
										<button
											type="button"
											className="h-10 rounded-[6px] bg-[#07C160]/10 text-[15px] text-[#07C160]"
											onClick={() => {
												unlockAudio();
												const vmk = m.voiceMake;
												if (vmk) void geminiSpeak(vmk.sample, vmk.profile).then((n) => n && setNote(n));
											}}
										>
											试听
										</button>
										<button
											type="button"
											className="h-10 rounded-[6px] bg-[#07C160] text-[15px] text-white"
											onClick={() => {
												const vmk = m.voiceMake;
												if (!vmk) return;
												stopSpeaking();
												setPresets((v) => [...v, { id: nanoid(6), name: vmk.name.trim() || "新声音", profile: vmk.profile }]);
												updateMessages((all) => all.map((x) => (x.id === m.id && x.voiceMake ? { ...x, voiceMake: { ...x.voiceMake, saved: true } } : x)));
											}}
										>
											保存
										</button>
									</div>
								)}
							</div>
						)}
						{m.ops && (
							<div className="mt-2 w-[88%] rounded-[8px] bg-white p-3">
								<div className="font-medium text-[14px]">准备修改「{m.ops.target}」已有的消息（共 {m.ops.ops.length} 项）</div>
								<div className="mt-2 max-h-[160px] space-y-1 overflow-auto rounded-[6px] bg-[#F5F5F5] p-2 text-[13px] leading-5">
									{m.ops.ops.map((o, i) => (
										<div key={i}>{describeOp(m.ops?.targetId || conversationId || "", o)}</div>
									))}
								</div>
								{m.ops.applied ? (
									<div className="mt-2 text-[13px] text-[#07C160]">✓ {m.ops.applied}</div>
								) : (
									<button
										type="button"
										className="mt-2 h-10 w-full rounded-[6px] bg-[#07C160] text-[15px] text-white"
										onClick={() => {
											const o = m.ops;
											if (!o) return;
											const cid = o.targetId || resolveTarget(o.target, listContacts(), conversationId)?.id;
											if (!cid) return window.alert(`找不到联系人「${o.target}」`);
											const res = applyOps(cid, o.ops);
											updateMessages((all) => all.map((x) => (x.id === m.id && x.ops ? { ...x, ops: { ...x.ops, applied: res } } : x)));
										}}
									>
										应用修改
									</button>
								)}
							</div>
						)}
						{m.action && (
							<div className="mt-2 w-[88%] rounded-[8px] bg-white p-3">
								<div className="text-[14px] font-medium">
									{m.action.mode === "range"
										? `准备修改「${m.action.target}」${m.action.from} ~ ${m.action.to} 这一段（替换为 ${m.action.items.length} 条）`
										: `准备放进「${m.action.target}」的聊天（${m.action.mode === "replace" ? "清空整个聊天并替换" : "追加 / 按日期插入"}，共 ${m.action.items.length} 条）`}
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
											追加 / 按日期插入（过去的日期会插到对应位置）
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
			{notepad && <Notepad onClose={() => setNotepad(false)} onSend={(t) => { setNotepad(false); void send(t); }} />}
			{searching && (
				<div className="fixed inset-0 z-50 flex flex-col bg-white">
					<div className="flex shrink-0 items-center gap-3 bg-[#EDEDED] px-[15px] pt-[calc(env(safe-area-inset-top)+8px)] pb-2">
						<div className="flex h-[35px] flex-1 items-center rounded-md bg-white px-2">
							<SearchOutlinedSVG width={22} height={22} fill="rgba(0,0,0,0.35)" />
							<input autoFocus aria-label="搜索关键词" value={sq} onChange={(e) => setSq(e.target.value)} placeholder={isChat ? "搜索这个聊天的 AI 记录" : "搜索所有 AI 窗口的记录"} className="ml-1 min-w-0 flex-1 bg-transparent text-[16px] outline-none" />
						</div>
						<button type="button" className="text-[16px] text-[#576B95]" onClick={() => { setSearching(false); setSq(""); }}>
							取消
						</button>
					</div>
					<div className="min-h-0 flex-1 overflow-auto">
						{sKey && hits.length === 0 && <div className="pt-16 text-center text-[15px] text-black/40">没有找到「{sq.trim()}」</div>}
						{hits.map((h) => {
							const t = h.m.text;
							const i = t.toLowerCase().indexOf(sKey);
							const a = Math.max(0, i - 10);
							return (
								<button key={`${h.sid}-${h.m.id}`} type="button" onClick={() => jumpTo(h.sid, h.m.id)} className="block w-full border-black/5 border-b px-4 py-3 text-left">
									<div className="text-[12px] text-black/40">
										{h.name ? `${h.name} · ` : ""}
										{h.m.role === "user" ? "我说" : "AI 说"}
									</div>
									<div className="mt-1 line-clamp-2 break-all text-[15px]">
										{a > 0 ? "…" : ""}
										{t.slice(a, i)}
										<span className="text-[#07C160]">{t.slice(i, i + sKey.length)}</span>
										{t.slice(i + sKey.length, i + sKey.length + 50)}
									</div>
								</button>
							);
						})}
					</div>
				</div>
			)}
			{picker && (
				<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setPicker(false)}>
					<div className="max-h-[70%] overflow-auto rounded-t-[12px] bg-white pb-[env(safe-area-inset-bottom)]" onClick={(e) => e.stopPropagation()}>
						<div className="border-black/5 border-b px-4 py-3 text-center font-medium text-[16px]">选择要绑定的聊天（最多 4 个）</div>
						<button type="button" onClick={() => { setState((x) => ({ ...x, sessions: x.sessions.map((y) => (y.id === session.id ? { ...y, boundIds: [] } : y)) })); setPicker(false); }} className="flex w-full items-center justify-between border-black/5 border-b px-4 py-3 text-left text-[16px]">
							一个都不选（不绑定任何聊天）
							<span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[12px] ${(session.boundIds ?? []).length === 0 ? "border-[#07C160] bg-[#07C160] text-white" : "border-black/20"}`}>{(session.boundIds ?? []).length === 0 ? "✓" : ""}</span>
						</button>
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
			{toast && <div className="pointer-events-none fixed bottom-[120px] left-1/2 z-[60] -translate-x-1/2 rounded-[6px] bg-black/75 px-4 py-2 text-[14px] text-white">{toast}</div>}
			{note && <div className="max-h-[40vh] overflow-auto whitespace-pre-line bg-[#FBE9E9] px-4 py-2 text-[13px] text-[#C62828]">{note}</div>}
			<div className="flex items-end gap-2 border-t-[0.5px] border-t-[#D6D6D6] bg-[#F7F7F7] px-3 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))]">
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
			</div>
		</div>
	);
};

export default AiChatView;
