import { isGroupId } from "@/stateV2/group";
import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { useConversationAPI } from "./context";
import { EMPTY_PERSONA, type PersonaCard, loadPersonas, personaMapAtom, writePersona } from "./persona";
import { standInAtom } from "./standIn";

const FIELDS: { key: keyof PersonaCard; label: string; hint?: string; long?: boolean }[] = [
	{ key: "role", label: "角色/身份" },
	{ key: "origin", label: "籍贯" },
	{ key: "age", label: "年龄" },
	{ key: "style", label: "性格与说话风格", long: true },
	{ key: "relation", label: "和我的关系", long: true },
	{ key: "story", label: "背景故事", long: true },
	{ key: "scene", label: "当前场景/话题", hint: "这次聊什么", long: true },
	{ key: "plot", label: "临时剧情", hint: "突发事件，可一键清空", long: true },
];

/** AI 代回开启时，标题栏下方的人设条。点开编辑，收起后仍可再展开。 */
const PersonaBar = () => {
	const { conversationId } = useConversationAPI();
	const standIn = useAtomValue(standInAtom);
	const map = useAtomValue(personaMapAtom);
	const card = map[conversationId] ?? EMPTY_PERSONA;
	const [collapsed, setCollapsed] = useState(false);
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState<PersonaCard>(EMPTY_PERSONA);
	const draftRef = useRef(draft);
	const dirty = useRef(false);
	const timer = useRef(0);
	draftRef.current = draft;

	useEffect(() => {
		void loadPersonas().catch(() => undefined);
	}, []);

	useEffect(() => {
		setEditing(false);
		setCollapsed(false);
	}, [conversationId]);

	const flush = () => {
		if (!dirty.current) return;
		window.clearTimeout(timer.current);
		dirty.current = false;
		void writePersona(conversationId, draftRef.current);
	};

	useEffect(() => () => flush(), [conversationId]);

	if (!standIn[conversationId] || isGroupId(conversationId)) return null;

	const change = (key: keyof PersonaCard, value: string) => {
		const next = { ...draftRef.current, [key]: value };
		draftRef.current = next;
		dirty.current = true;
		setDraft(next);
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => {
			dirty.current = false;
			void writePersona(conversationId, draftRef.current);
		}, 280);
	};

	const open = () => {
		const next = { ...(map[conversationId] ?? EMPTY_PERSONA) };
		draftRef.current = next;
		dirty.current = false;
		setDraft(next);
		setEditing(true);
	};

	const clearPlot = () => {
		const next = { ...draftRef.current, plot: "" };
		draftRef.current = next;
		dirty.current = false;
		window.clearTimeout(timer.current);
		setDraft(next);
		void writePersona(conversationId, next);
	};

	const role = card.role.trim();
	const scene = card.scene.trim();

	return (
		<>
			{collapsed ? (
				<button type="button" onClick={() => setCollapsed(false)} className="flex h-8 w-full shrink-0 items-center border-black/10 border-b bg-[#F7F7F7] px-3 text-left text-[13px] text-[#576B95]">
					人设
				</button>
			) : (
				<div className="flex h-9 shrink-0 items-center gap-2 border-black/10 border-b bg-[#F7F7F7] px-3">
					<button type="button" onClick={open} className="min-w-0 flex-1 truncate text-left text-[13px] text-black/80">
						<span className="text-black/40">角色 </span>
						{role || "未填"}
						<span className="text-black/40"> · 场景 </span>
						{scene || "未填"}
					</button>
					<button type="button" onClick={() => setCollapsed(true)} className="shrink-0 text-[13px] text-[#576B95]">
						收起
					</button>
				</div>
			)}
			{editing && (
				<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => { flush(); setEditing(false); }}>
					<div className="flex max-h-[86%] flex-col rounded-t-[12px] bg-white" onClick={(e) => e.stopPropagation()}>
						<div className="flex h-12 shrink-0 items-center justify-between border-black/5 border-b px-4">
							<button type="button" className="text-[16px] text-black/50" onClick={() => { flush(); setEditing(false); }}>
								取消
							</button>
							<div className="font-medium text-[16px]">人设卡</div>
							<button type="button" className="text-[16px] text-[#07C160]" onClick={() => { flush(); setEditing(false); }}>
								完成
							</button>
						</div>
						<div className="min-h-0 flex-1 overflow-auto px-4 pt-2">
							{FIELDS.map((field) => (
								<label key={field.key} className="mb-3 block">
									<span className="mb-1 flex items-center text-[13px] text-black/50">
										{field.label}
										{field.hint ? <span className="ml-2 text-black/35">{field.hint}</span> : null}
										{field.key === "plot" && (
											<button type="button" className="ml-auto text-[#576B95]" onClick={clearPlot}>
												清空
											</button>
										)}
									</span>
									{field.long ? (
										<textarea
											value={draft[field.key]}
											onChange={(e) => change(field.key, e.target.value)}
											className="h-[72px] w-full resize-none rounded-[8px] bg-[#F5F5F5] p-3 text-[16px] outline-none"
										/>
									) : (
										<input
											value={draft[field.key]}
											onChange={(e) => change(field.key, e.target.value)}
											className="h-10 w-full rounded-[8px] bg-[#F5F5F5] px-3 text-[16px] outline-none"
										/>
									)}
								</label>
							))}
						</div>
						<div className="shrink-0 px-4 pt-2 pb-[calc(12px+env(safe-area-inset-bottom))]">
							<button type="button" onClick={() => { flush(); setEditing(false); }} className="h-11 w-full rounded-[6px] bg-[#07C160] text-[16px] text-white">
								完成
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
};

export default PersonaBar;
