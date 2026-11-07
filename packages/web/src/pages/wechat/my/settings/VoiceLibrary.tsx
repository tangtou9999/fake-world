import { DEFAULT_VOICE, GEMINI_VOICES, type GeminiConfig, type VoiceFx, type VoicePreset, type VoiceProfile, type VoiceRole, geminiConfigAtom, hasApiKey, resolveProfile, voicePresetsAtom } from "@/stateV2/gemini";
import { geminiSpeak, unlockAudio } from "@/utils/tts";
import { useAtom, useAtomValue } from "jotai";
import { nanoid } from "nanoid";
import { useState } from "react";
import VoiceProfileEditor from "./VoiceProfileEditor";

export const TRIAL_TEXT = "（笑）你好呀，这是我的声音，听起来像真人发的微信语音吗？";

const ROLE_LABEL: Record<VoiceRole, string> = { friend: "对方的语音消息", mine: "我的语音消息", ai: "AI 朗读回复" };
const ROLE_DESC: Record<VoiceRole, string> = { friend: "点聊天里对方发的语音时用", mine: "点我发的语音时用", ai: "AI 对话里朗读回复用" };

const summary = (p: VoiceProfile) => {
	const v = GEMINI_VOICES.find((x) => x.id === p.voice);
	return `${p.voice}${v ? `（${v.gender}声）` : ""}${p.accent && p.accent !== "默认自然口语" ? ` · ${p.accent}` : ""}`;
};

/** 声音库：新建 → 试听 → 命名保存（保存后固定）→ 给「对方 / 我 / AI」选用 */
const VoiceLibrary = () => {
	const [presets, setPresets] = useAtom(voicePresetsAtom);
	const [config, setConfig] = useAtom(geminiConfigAtom);
	const [draft, setDraft] = useState<VoiceProfile | null>(null);
	const [name, setName] = useState("");
	const [note, setNote] = useState("");
	const ok = hasApiKey(config);

	const trial = async (profile: VoiceProfile, fx?: VoiceFx) => {
		unlockAudio();
		setNote("正在请求 Gemini 声音…");
		const n = await geminiSpeak(TRIAL_TEXT, profile, fx);
		setNote(n ?? "播放中。如果没有声音，请检查手机是否静音。");
	};

	const save = () => {
		const n = name.trim();
		if (!draft || !n) return;
		const preset: VoicePreset = { id: nanoid(6), name: n, profile: draft };
		setPresets((v) => [...v, preset]);
		setDraft(null);
		setName("");
		setNote(`已保存「${n}」，现在可以在下面给对方 / 我 / AI 选用。`);
	};

	const remove = (id: string) => {
		const p = presets.find((x) => x.id === id);
		if (!p || !window.confirm(`删除声音「${p.name}」？用到它的地方会改回默认声音。`)) return;
		setPresets((v) => v.filter((x) => x.id !== id));
		setConfig((c) => ({ ...c, assign: Object.fromEntries(Object.entries(c.assign ?? {}).filter(([, val]) => val !== id)) as GeminiConfig["assign"] }));
	};

	const rename = (id: string) => {
		const p = presets.find((x) => x.id === id);
		const n = p && window.prompt("新的名字", p.name)?.trim();
		if (n) setPresets((v) => v.map((x) => (x.id === id ? { ...x, name: n } : x)));
	};

	return (
		<div>
			<div className="px-4 pb-1 font-medium text-[14px] text-black/70">我的声音库</div>
			{presets.length === 0 && <div className="bg-white px-4 py-3 text-[13px] text-black/40 leading-5">还没有保存的声音。点下面「新建声音」，调好、试听满意后命名保存。</div>}
			{presets.map((p) => (
				<div key={p.id} className="flex items-center gap-2 border-black/5 border-b bg-white px-4 py-3 last:border-b-0">
					<div className="min-w-0 flex-1">
						<div className="truncate text-[16px]">{p.name}</div>
						<div className="truncate text-[12px] text-black/40">{summary(p.profile)}</div>
					</div>
					<button type="button" disabled={!ok} onClick={() => void trial(p.profile)} className="h-8 shrink-0 rounded-[6px] bg-[#07C160] px-3 text-[14px] text-white disabled:opacity-40">
						试听
					</button>
					<button type="button" onClick={() => rename(p.id)} className="shrink-0 text-[13px] text-[#576B95]">
						改名
					</button>
					<button type="button" onClick={() => remove(p.id)} className="shrink-0 text-[13px] text-[#C62828]">
						删除
					</button>
				</div>
			))}
			{draft ? (
				<div className="mt-3">
					<div className="px-4 pb-1 font-medium text-[14px] text-black/70">新建声音（调好后先试听）</div>
					<VoiceProfileEditor value={draft} onChange={setDraft} onTrial={() => void trial(draft)} trialDisabled={!ok} />
					<div className="flex items-center gap-2 border-black/5 border-t bg-white px-4 pb-3">
						<input className="h-10 min-w-0 flex-1 rounded-[6px] bg-[#F5F5F5] px-3 text-[15px] outline-none placeholder:text-black/30" placeholder="给这个声音起个名字，例如：小满" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
						<button type="button" disabled={!name.trim()} onClick={save} className="h-10 shrink-0 rounded-[6px] bg-[#07C160] px-4 text-[15px] text-white disabled:opacity-40">
							保存
						</button>
						<button type="button" onClick={() => setDraft(null)} className="h-10 shrink-0 rounded-[6px] bg-black/5 px-3 text-[15px]">
							取消
						</button>
					</div>
				</div>
			) : (
				<button type="button" onClick={() => { setDraft({ voice: "Aoede", air: 0, chest: 0 }); setName(""); }} className="mx-4 mt-3 block h-[42px] w-[calc(100%-32px)] rounded-[6px] bg-white text-[15px] text-[#07C160]">
					＋ 新建声音
				</button>
			)}
			{note && <div className="px-4 pt-2 text-[12px] text-[#576B95] leading-5">{note}</div>}

			<div className="mt-5 px-4 pb-1 font-medium text-[14px] text-black/70">各用哪个声音</div>
			{(["friend", "mine", "ai"] as const).map((r) => (
				<div key={r} className="border-black/5 border-b bg-white px-4 py-3 last:border-b-0">
					<div className="text-[16px]">{ROLE_LABEL[r]}</div>
					<div className="text-[12px] text-black/40">{ROLE_DESC[r]}</div>
					<div className="mt-2 flex items-center gap-2">
						<select
							className="h-10 min-w-0 flex-1 rounded-[6px] bg-[#F5F5F5] px-2 text-[15px] outline-none"
							value={config.assign?.[r] ?? ""}
							onChange={(e) => setConfig((c) => ({ ...c, assign: { ...c.assign, [r]: e.target.value || undefined } }))}
						>
							<option value="">默认（{DEFAULT_VOICE[r]}）</option>
							{presets.map((p) => (
								<option key={p.id} value={p.id}>
									{p.name}
								</option>
							))}
						</select>
						<button type="button" disabled={!ok} onClick={() => void trial(resolveProfile(r))} className="h-10 shrink-0 rounded-[6px] bg-[#07C160] px-4 text-[15px] text-white disabled:opacity-40">
							试听
						</button>
					</div>
				</div>
			))}
		</div>
	);
};

export default VoiceLibrary;
