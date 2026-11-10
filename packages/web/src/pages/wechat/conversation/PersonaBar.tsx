import useMode from "@/components/useMode";
import { geminiConfigAtom } from "@/stateV2/gemini";
import { isGroupId } from "@/stateV2/group";
import { callGemini, normalizeDeepSeekApiKey, type GeminiTurn } from "@/utils/gemini";
import dayjs from "dayjs";
import { useAtom, useAtomValue } from "jotai";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useConversationAPI } from "./context";
import {
	EMPTY_PERSONA,
	PERSONA_FILL_KEYS,
	PERSONA_FILL_SYSTEM,
	RULES_EXAMPLE,
	type PersonaCard,
	loadPersonas,
	peekPersona,
	personaEditorAtom,
	personaFromModel,
	writePersona,
} from "./persona";

const FIELDS: { key: keyof PersonaCard; label: string; hint?: string; long?: boolean }[] = [
	{ key: "role", label: "角色/身份" },
	{ key: "origin", label: "籍贯" },
	{ key: "age", label: "年龄" },
	{ key: "style", label: "性格与说话风格", long: true },
	{ key: "relation", label: "和我的关系", long: true },
	{ key: "story", label: "背景故事", long: true },
	{ key: "scene", label: "当前场景/话题", hint: "这次聊什么", long: true },
	{ key: "rules", label: "对话规则", hint: "字数、禁用词、情绪、表情", long: true },
	{ key: "plot", label: "临时剧情", hint: "突发事件，可一键清空", long: true },
];

type ChatMsg = { id: string; role: "user" | "model"; text: string; error?: boolean };

const stopped = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

/** 只在编辑模式里打开。正常聊天不渲染任何条。点保存才写入。 */
const PersonaBar = () => {
	const { conversationId } = useConversationAPI();
	const { isEdit } = useMode();
	const [open, setOpen] = useAtom(personaEditorAtom);
	const navigate = useNavigate();
	const [draft, setDraft] = useState<PersonaCard>(EMPTY_PERSONA);
	const [input, setInput] = useState("");
	const [messages, setMessages] = useState<ChatMsg[]>([]);
	const [busy, setBusy] = useState(false);
	const dirty = useRef(false);
	const draftRef = useRef(draft);
	const live = useRef(true);
	const gen = useRef(0);
	const ctrl = useRef<AbortController | null>(null);
	const prevId = useRef(conversationId);
	draftRef.current = draft;

	useEffect(() => {
		live.current = true;
		return () => {
			live.current = false;
			ctrl.current?.abort();
		};
	}, []);

	useEffect(() => {
		if (!isEdit) setOpen(false);
	}, [isEdit, setOpen]);

	useEffect(() => {
		if (prevId.current === conversationId) return;
		prevId.current = conversationId;
		setOpen(false);
	}, [conversationId, setOpen]);

	useEffect(() => {
		if (!open) {
			gen.current += 1;
			ctrl.current?.abort();
			return;
		}
		const token = ++gen.current;
		dirty.current = false;
		setDraft({ ...peekPersona(conversationId) });
		setMessages([]);
		setInput("");
		let on = true;
		void loadPersonas().then(() => {
			if (on && token === gen.current && !dirty.current) setDraft({ ...peekPersona(conversationId) });
		});
		return () => {
			on = false;
		};
	}, [open, conversationId]);

	if (!open || !isEdit || isGroupId(conversationId)) return null;

	const change = (key: keyof PersonaCard, value: string) => {
		dirty.current = true;
		setDraft((prev) => ({ ...prev, [key]: value }));
	};

	const save = () => {
		void writePersona(conversationId, draft);
		setOpen(false);
	};

	const send = async () => {
		const typed = input.trim();
		if (!typed || busy) return;
		const token = gen.current;
		const history: GeminiTurn[] = messages.filter((m) => !m.error && m.text.trim()).map((m) => ({ role: m.role, text: m.text }));
		const snapshot = Object.fromEntries(PERSONA_FILL_KEYS.map((key) => [key, draft[key]]));
		const ac = new AbortController();
		ctrl.current?.abort();
		ctrl.current = ac;
		setInput("");
		setMessages((prev) => [...prev, { id: nanoid(8), role: "user", text: typed }]);
		setBusy(true);
		try {
			const reply = await callGemini(
				`今天是 ${dayjs().format("YYYY-MM-DD")}。\n当前人设卡：${JSON.stringify(snapshot)}\n用户说：${typed}`,
				{ json: true, system: PERSONA_FILL_SYSTEM, history: history.slice(-12), signal: ac.signal },
			);
			if (!live.current || ac.signal.aborted || token !== gen.current) return;
			const parsed = personaFromModel(reply, draftRef.current);
			if (parsed.card) {
				dirty.current = true;
				setDraft(parsed.card);
			}
			setMessages((prev) => [...prev, { id: nanoid(8), role: "model", text: parsed.say }]);
		} catch (e) {
			if (!live.current || ac.signal.aborted || token !== gen.current || stopped(e)) return;
			setMessages((prev) => [...prev, { id: nanoid(8), role: "model", error: true, text: e instanceof Error ? e.message : String(e) }]);
		} finally {
			if (ctrl.current === ac) setBusy(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setOpen(false)}>
			<div className="flex max-h-[86%] flex-col rounded-t-[12px] bg-white" onClick={(e) => e.stopPropagation()}>
				<div className="flex h-12 shrink-0 items-center justify-between border-black/5 border-b px-4">
					<button type="button" className="text-[16px] text-black/50" onClick={() => setOpen(false)}>
						取消
					</button>
					<div className="font-medium text-[16px]">人设卡</div>
					<button type="button" className="text-[16px] text-[#07C160]" onClick={save}>
						保存
					</button>
				</div>
				<div className="max-h-[28%] shrink-0 overflow-auto border-black/5 border-b px-4 py-2">
					<div className="mb-1 text-[12px] text-black/40 leading-5">丢几个关键词，AI 会填好下面各栏。改完点保存才写入。</div>
					{messages.length === 0 && <div className="text-[13px] text-black/35">例如：上海女大学生 家里管得严 有点傲娇</div>}
					{messages.map((m) => (
						<div key={m.id} className={`mb-1 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
							<div className={`max-w-[86%] whitespace-pre-wrap break-words rounded-[6px] px-2.5 py-1.5 text-[14px] leading-5 ${m.role === "user" ? "bg-[#95EC69]" : m.error ? "bg-[#FBE9E9] text-[#C62828]" : "bg-[#F5F5F5]"}`}>
								{m.text}
							</div>
						</div>
					))}
					{busy && <div className="text-[13px] text-black/40">正在写…</div>}
				</div>
				<div className="min-h-0 flex-1 overflow-auto px-4 pt-2">
					{FIELDS.map((field) => (
						<label key={field.key} className="mb-3 block">
							<span className="mb-1 flex items-center text-[13px] text-black/50">
								{field.label}
								{field.hint ? <span className="ml-2 text-black/35">{field.hint}</span> : null}
								{field.key === "plot" && (
									<button type="button" className="ml-auto text-[#576B95]" onClick={() => change("plot", "")}>
										清空
									</button>
								)}
								{field.key === "rules" && (
									<button type="button" className="ml-auto text-[#576B95]" onClick={() => change("rules", RULES_EXAMPLE)}>
										填入示例
									</button>
								)}
							</span>
							{field.long ? (
								<textarea
									aria-label={field.label}
									value={draft[field.key]}
									onChange={(e) => change(field.key, e.target.value)}
									className="h-[72px] w-full resize-none rounded-[8px] bg-[#F5F5F5] p-3 text-[16px] outline-none"
								/>
							) : (
								<input
									aria-label={field.label}
									value={draft[field.key]}
									onChange={(e) => change(field.key, e.target.value)}
									className="h-10 w-full rounded-[8px] bg-[#F5F5F5] px-3 text-[16px] outline-none"
								/>
							)}
						</label>
					))}
				</div>
				<PersonaAsk input={input} setInput={setInput} busy={busy} onSend={() => void send()} onKey={() => navigate("/wechat/my/settings/ai/key")} />
				<div className="shrink-0 px-4 pt-2 pb-[calc(12px+env(safe-area-inset-bottom))]">
					<button type="button" onClick={save} className="h-11 w-full rounded-[6px] bg-[#07C160] text-[16px] text-white">
						保存
					</button>
				</div>
			</div>
		</div>
	);
};

const PersonaAsk = ({
	input,
	setInput,
	busy,
	onSend,
	onKey,
}: {
	input: string;
	setInput: (v: string) => void;
	busy: boolean;
	onSend: () => void;
	onKey: () => void;
}) => {
	const gemini = useAtomValue(geminiConfigAtom);
	const hasKey = !!(gemini.apiKey || gemini.apiKey2 || normalizeDeepSeekApiKey(gemini.deepseekApiKey));
	if (!hasKey) {
		return (
			<button type="button" onClick={onKey} className="mx-4 mt-2 h-10 shrink-0 rounded-[6px] bg-[#07C160] text-[15px] text-white">
				还没填密钥，去填写
			</button>
		);
	}
	return (
		<div className="flex shrink-0 items-end gap-2 border-black/10 border-t px-3 py-2">
			<textarea
				rows={1}
				aria-label="对人设 AI 说"
				value={input}
				placeholder="关键词，或「年龄改大一点」"
				onChange={(e) => setInput(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						onSend();
					}
				}}
				className="max-h-[72px] min-h-[40px] flex-1 resize-none rounded-[6px] bg-[#F5F5F5] px-3 py-[9px] text-[16px] leading-[22px] outline-none"
			/>
			<button type="button" disabled={busy || !input.trim()} onClick={onSend} className="h-10 shrink-0 rounded-[6px] bg-[#07C160] px-4 text-[16px] text-white disabled:opacity-40">
				发送
			</button>
		</div>
	);
};

export default PersonaBar;
