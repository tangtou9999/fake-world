import useScreenTopBg from "@/components/useScreenTopBg";
import { DEFAULT_GEMINI_MODEL, DEFAULT_TTS_MODEL, GEMINI_VOICES, geminiConfigAtom } from "@/stateV2/gemini";
import { callGemini, listGeminiModels } from "@/utils/gemini";
import { geminiSpeak, unlockAudio } from "@/utils/tts";
import { useAtom } from "jotai";
import { type ReactNode, useState } from "react";
import { NavBar } from "../../addFriend/Shared";

const TEXT_CHOICES = [
	{ id: "", title: "自动（推荐）", desc: "用快速模型，繁忙或停用时自动换备用，省心" },
	{ id: "gemini-flash-lite-latest", title: "快速 · 省额度", desc: "回复最快，适合短对话；长剧本偏简短" },
	{ id: "gemini-flash-latest", title: "均衡 · 更聪明", desc: "写得更细、更有人味，速度适中" },
	{ id: "gemini-pro-latest", title: "最强 · 较慢", desc: "最会写长剧情和复杂指令，慢一些、更耗额度" },
];

const VISION_CHOICES = [
	{ id: "", title: "和文字模型相同", desc: "默认" },
	{ id: "gemini-flash-latest", title: "均衡（推荐）", desc: "识别聊天截图比较准" },
	{ id: "gemini-pro-latest", title: "最强", desc: "截图很多、很复杂时用，较慢" },
];

const Section = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => (
	<>
		<div className="px-4 pt-5 pb-1 font-medium text-[15px] text-black/70">{title}</div>
		{hint && <div className="px-4 pb-2 text-[12px] text-black/40 leading-5">{hint}</div>}
		{children}
	</>
);

const Choice = ({ active, title, desc, onClick }: { active: boolean; title: string; desc: string; onClick: () => void }) => (
	<button type="button" onClick={onClick} className="flex w-full items-center border-black/5 border-b bg-white px-4 py-3 text-left last:border-b-0">
		<div className="min-w-0 flex-1">
			<div className="text-[16px]">{title}</div>
			<div className="mt-[2px] text-[12px] text-black/40 leading-5">{desc}</div>
		</div>
		<span className={`ml-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${active ? "border-[#07C160] bg-[#07C160]" : "border-black/20"}`}>
			{active && <span className="h-2 w-2 rounded-full bg-white" />}
		</span>
	</button>
);

const AiSettings = () => {
	const [config, setConfig] = useAtom(geminiConfigAtom);
	const [show, setShow] = useState(false);
	const [busy, setBusy] = useState(false);
	const [models, setModels] = useState<string[]>([]);
	const [listErr, setListErr] = useState("");
	const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
	const [voiceNote, setVoiceNote] = useState("");
	useScreenTopBg("#EDEDED");

	const textActive = (id: string) => (id === "" ? !config.model : config.model === id);

	const loadModels = async () => {
		setListErr("");
		try {
			setModels(await listGeminiModels(config.apiKey));
		} catch (e) {
			setListErr(e instanceof Error ? e.message : String(e));
		}
	};

	const test = async () => {
		setBusy(true);
		setResult(null);
		try {
			const reply = await callGemini("只回复两个字：成功");
			setResult({ ok: true, text: `连接成功：${reply.trim().slice(0, 30)}` });
		} catch (e) {
			setResult({ ok: false, text: e instanceof Error ? e.message : String(e) });
		} finally {
			setBusy(false);
		}
	};

	const trial = async (voice: string) => {
		unlockAudio();
		setVoiceNote("正在请求 Gemini 声音…");
		const note = await geminiSpeak("你好，这是我的声音，听起来怎么样？", voice);
		setVoiceNote(note ?? "播放中。如果没有声音，请检查手机是否静音。");
	};

	const voiceRow = (key: "ai" | "friend" | "mine", label: string, desc: string, def: string) => {
		const value = config.voices?.[key] || def;
		return (
			<div className="border-black/5 border-b bg-white px-4 py-3 last:border-b-0">
				<div className="text-[16px]">{label}</div>
				<div className="mt-[2px] text-[12px] text-black/40">{desc}</div>
				<div className="mt-2 flex items-center gap-2">
					<select
						className="h-10 min-w-0 flex-1 rounded-[6px] bg-[#F5F5F5] px-2 text-[15px] outline-none"
						value={value}
						onChange={(e) => setConfig((v) => ({ ...v, voices: { ...v.voices, [key]: e.target.value } }))}
					>
						{GEMINI_VOICES.map((o) => (
							<option key={o.id} value={o.id}>
								{o.label} · {o.desc}
							</option>
						))}
					</select>
					<button type="button" disabled={!config.apiKey} onClick={() => void trial(value)} className="h-10 shrink-0 rounded-[6px] bg-[#07C160] px-4 text-[15px] text-white disabled:opacity-40">
						试听
					</button>
				</div>
			</div>
		);
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-[#EDEDED]">
			<NavBar title="AI 模型与声音" />
			<div className="min-h-0 flex-1 overflow-auto pb-10">
				<Section title="① 密钥" hint="密钥只保存在这台手机的浏览器里，不会上传，也不会写进网站代码。">
					<div className="flex items-center bg-white px-4">
						<input
							type={show ? "text" : "password"}
							className="min-w-0 flex-1 bg-transparent py-4 text-[16px] outline-none placeholder:text-black/30"
							placeholder="粘贴你的 Gemini API Key"
							value={config.apiKey}
							autoComplete="off"
							onChange={(e) => setConfig((v) => ({ ...v, apiKey: e.target.value.trim() }))}
						/>
						<button type="button" className="ml-3 text-[14px] text-[#576B95]" onClick={() => setShow((v) => !v)}>
							{show ? "隐藏" : "显示"}
						</button>
					</div>
				</Section>

				<Section title="② 文字 AI（聊天、剧本、朋友圈、翻译、AI 对话）" hint="选一个就行。出现“服务器繁忙”或模型停用时，都会自动换备用模型重试。">
					<div>
						{TEXT_CHOICES.map((c) => (
							<Choice key={c.title} active={textActive(c.id)} title={c.title} desc={c.desc} onClick={() => setConfig((v) => ({ ...v, model: c.id }))} />
						))}
					</div>
					<div className="px-4 pt-2 text-[12px] text-black/40 leading-5">
						当前：{config.model || `自动（${DEFAULT_GEMINI_MODEL}）`}
						{config.model && !TEXT_CHOICES.some((c) => c.id === config.model) ? "（自定义）" : ""}
					</div>
					<div className="px-4 pt-1">
						<button type="button" disabled={!config.apiKey} onClick={loadModels} className="text-[14px] text-[#576B95] disabled:opacity-40">
							高级：查看我的密钥能用的全部模型
						</button>
						{listErr && <div className="mt-1 text-[12px] text-[#C62828]">{listErr}</div>}
						{models.length > 0 && (
							<div className="mt-2 flex flex-wrap gap-2">
								{models.map((m) => (
									<button key={m} type="button" onClick={() => setConfig((v) => ({ ...v, model: m }))} className={`rounded-full px-3 py-1 text-[13px] ${config.model === m ? "bg-[#07C160] text-white" : "bg-white text-black/70"}`}>
										{m}
									</button>
								))}
							</div>
						)}
					</div>
				</Section>

				<Section title="③ 图片 AI（上传聊天截图让它复刻）" hint="只在“截图复刻”时用到。">
					<div>
						{VISION_CHOICES.map((c) => (
							<Choice key={c.title} active={(config.visionModel ?? "") === c.id} title={c.title} desc={c.desc} onClick={() => setConfig((v) => ({ ...v, visionModel: c.id }))} />
						))}
					</div>
				</Section>

				<Section title="④ 声音 AI（Gemini 语音合成）" hint="点对方的语音消息、或 AI 朗读回复时，用这里选的声音。试听时需要联网，每次试听会用一点额度。">
					<div>
						{voiceRow("friend", "对方的语音消息", "点聊天里对方发的语音，会用这个声音读出它的文字", "Aoede")}
						{voiceRow("mine", "我的语音消息", "点我发的语音时用的声音", "Puck")}
						{voiceRow("ai", "AI 朗读回复", "AI 对话里朗读回复用的声音", "Kore")}
					</div>
					<div className="px-4 pt-2 text-[12px] text-black/40 leading-5">
						语音模型：{config.ttsModel || DEFAULT_TTS_MODEL}。如果你的账号用的是别的名字，可在下面改。
					</div>
					<div className="mx-4 mt-1 rounded-[6px] bg-white px-3">
						<input
							className="w-full bg-transparent py-3 text-[15px] outline-none placeholder:text-black/30"
							placeholder={DEFAULT_TTS_MODEL}
							value={config.ttsModel ?? ""}
							onChange={(e) => setConfig((v) => ({ ...v, ttsModel: e.target.value.trim() }))}
						/>
					</div>
					{voiceNote && <div className="px-4 pt-2 text-[12px] text-[#576B95] leading-5">{voiceNote}</div>}
				</Section>

				<div className="mt-5 flex items-center justify-between bg-white px-4 py-3">
					<div className="pr-3">
						<div className="text-[16px]">成人虚构聊天模式</div>
						<div className="mt-1 text-[12px] text-black/40 leading-5">
							开启后给 Gemini 附加「成年人虚构聊天、不回避成人用语」的系统指令，并把它的内容过滤调到最宽。仍受 Gemini 自身硬性限制，被拦截时会提示原因。
						</div>
					</div>
					<input type="checkbox" className="h-5 w-5 shrink-0 accent-[#07C160]" checked={config.adultMode !== false} onChange={(e) => setConfig((v) => ({ ...v, adultMode: e.target.checked }))} />
				</div>
				<button type="button" disabled={busy || !config.apiKey} onClick={test} className="mx-auto mt-5 block h-[46px] w-[200px] rounded-[6px] bg-[#07C160] text-[16px] text-white disabled:opacity-40">
					{busy ? "检测中…" : "检测连接"}
				</button>
				{result && <div className={`mx-4 mt-4 rounded-[8px] p-3 text-[14px] leading-6 ${result.ok ? "bg-[#E6F6EC] text-[#0a7a3c]" : "bg-[#FBE9E9] text-[#C62828]"}`}>{result.text}</div>}
			</div>
		</div>
	);
};

export default AiSettings;
