import useScreenTopBg from "@/components/useScreenTopBg";
import { DEFAULT_GEMINI_MODEL, type VoiceFx, VOICE_PACES, VOICE_SCENES, geminiConfigAtom, hasApiKey, resolveProfile } from "@/stateV2/gemini";
import { callGemini, listGeminiModels } from "@/utils/gemini";
import { geminiSpeak, isModelId, unlockAudio } from "@/utils/tts";
import { useAtom } from "jotai";
import { type ReactNode, useState } from "react";
import { NavBar } from "../../addFriend/Shared";
import VoiceLibrary, { TRIAL_TEXT } from "./VoiceLibrary";

const TEXT_CHOICES = [
	{ id: "", title: "自动（推荐）", desc: "用快速模型，繁忙或停用时自动换备用，省心" },
	{ id: "gemini-2.5-flash", title: "均衡 · 推荐", desc: "免费额度高，最懂情绪，写得细、有人味" },
	{ id: "gemini-3-flash-preview", title: "新一代（预览）", desc: "更新的模型，可能偶尔不稳定" },
	{ id: "gemini-flash-latest", title: "自动最新", desc: "跟随 Google 当前最新的 Flash" },
	{ id: "gemini-2.5-flash-lite", title: "快速 · 省额度", desc: "回复最快，适合短对话；长剧本偏简短" },
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

const Choice = ({ active, title, desc, onClick, onTrial }: { active: boolean; title: string; desc: string; onClick: () => void; onTrial?: () => void }) => (
	<button type="button" onClick={onClick} className="flex w-full items-center border-black/5 border-b bg-white px-4 py-3 text-left last:border-b-0">
		<div className="min-w-0 flex-1">
			<div className="text-[16px]">{title}</div>
			<div className="mt-[2px] text-[12px] text-black/40 leading-5">{desc}</div>
		</div>
		{onTrial && (
			<span
				role="button"
				tabIndex={0}
				onClick={(e) => {
					e.stopPropagation();
					onTrial();
				}}
				onKeyDown={() => undefined}
				className="ml-2 shrink-0 rounded-[6px] bg-[#07C160] px-3 py-1 text-[13px] text-white"
			>
				试听
			</span>
		)}
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
			setModels(await listGeminiModels(config.apiKey || config.apiKey2));
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

	const trialFx = async (patch: VoiceFx) => {
		unlockAudio();
		setVoiceNote("正在请求 Gemini 声音…");
		const note = await geminiSpeak(TRIAL_TEXT, resolveProfile("friend"), { ...config.fx, ...patch });
		setVoiceNote(note ?? "播放中。如果没有声音，请检查手机是否静音。");
	};
	const fx = config.fx ?? {};

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-[#EDEDED]">
			<NavBar title="AI 模型与声音" />
			<div className="min-h-0 flex-1 overflow-auto pb-10">
				<Section title="① 密钥" hint="密钥只保存在这台手机的浏览器里，不会上传，也不会写进网站代码。">
					<div className="flex items-center bg-white px-4">
						<span className="w-[72px] shrink-0 text-[15px]">主密钥</span>
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
					<div className="mt-px flex items-center bg-white px-4">
						<span className="w-[72px] shrink-0 text-[15px]">备用密钥</span>
						<input
							type={show ? "text" : "password"}
							className="min-w-0 flex-1 bg-transparent py-4 text-[16px] outline-none placeholder:text-black/30"
							placeholder="第二个 Google 账号的密钥（可不填）"
							value={config.apiKey2 ?? ""}
							autoComplete="off"
							onChange={(e) => setConfig((v) => ({ ...v, apiKey2: e.target.value.trim() }))}
						/>
					</div>
					<div className="px-4 pt-2 text-[12px] text-black/40 leading-5">上面两栏分别是「主密钥」和「备用密钥」，删掉任何一个都不会影响另一个（只要有一个密钥，AI 功能就能用）。现在：主密钥{config.apiKey ? "已填" : "未填"}，备用密钥{config.apiKey2 ? "已填" : "未填"}。填了备用密钥后：主密钥额度用完、繁忙或出错时，文字和声音都会自动改用备用密钥，不用你手动切换。</div>
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
						<button type="button" disabled={!hasApiKey(config)} onClick={loadModels} className="text-[14px] text-[#576B95] disabled:opacity-40">
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

				<Section title="④ 声音 AI（Gemini 语音合成）" hint="先选角色，再调它的声纹、人设、气声等。每个聊天还可以在「编辑模式 → 声音」里单独设置。试听需要联网，每次会用一点额度。">
					<VoiceLibrary />
					<div className="px-4 pt-4 pb-1 font-medium text-[14px] text-black/70">整体语速与节奏</div>
					<div>
						{VOICE_PACES.map((p) => (
							<Choice key={p.id} active={(fx.pace ?? "chat") === p.id} title={p.title} desc={p.desc} onClick={() => setConfig((v) => ({ ...v, fx: { ...v.fx, pace: p.id } }))} onTrial={() => void trialFx({ pace: p.id })} />
						))}
					</div>
					<div className="px-4 pt-4 pb-1 font-medium text-[14px] text-black/70">物理声场 / 环境</div>
					<div>
						{VOICE_SCENES.map((p) => (
							<Choice key={p.id} active={(fx.scene ?? "pure") === p.id} title={p.title} desc={p.desc} onClick={() => setConfig((v) => ({ ...v, fx: { ...v.fx, scene: p.id } }))} onTrial={() => void trialFx({ scene: p.id })} />
						))}
					</div>
					<div className="mt-4 bg-white px-4 py-3">
						<label className="flex items-start justify-between gap-3">
							<span>
								<span className="text-[16px]">情绪词智能软化</span>
								<span className="block text-[12px] text-black/40 leading-5">把容易被拦截的极端口气标签，换成声学上等效但安全的指令，避免报错没声音</span>
							</span>
							<input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#07C160]" checked={fx.soften !== false} onChange={(e) => setConfig((v) => ({ ...v, fx: { ...v.fx, soften: e.target.checked } }))} />
						</label>
						<div className="mt-3 text-[16px]">同音字发音词典</div>
						<div className="text-[12px] text-black/40 leading-5">每行一条「原词=同音安全词」，例如 滚蛋=滚淡。气泡上仍显示原词，只在合成声音时替换。</div>
						<textarea
							className="mt-2 h-[88px] w-full resize-none rounded-[6px] bg-[#F5F5F5] p-2 text-[14px] leading-5 outline-none placeholder:text-black/30"
							placeholder={"滚蛋=滚淡"}
							value={fx.dict ?? ""}
							onChange={(e) => setConfig((v) => ({ ...v, fx: { ...v.fx, dict: e.target.value } }))}
						/>
					</div>
					<div className="px-4 pt-3 text-[12px] text-black/40 leading-5">
						小技巧：语音消息的文字开头写（口气）就是本句专属口气，例如「（撒娇）你怎么才回我」「（冷笑）行啊你」。支持：撒娇、气泡音/耳语、笑/调侃、暴怒、冷笑/嘲讽、委屈/哭腔、无奈/叹气、惊讶、抢话/打断。其他括号备注不会被读出来。
					</div>
					<div className="px-4 pt-3 text-[12px] text-black/40 leading-5">
						语音模型：一般不用填，留空就会用 gemini-2.5-flash-preview-tts。要填的话必须是这种英文小写名字，不是 AI Studio 里显示的「Gemini 2.5 Flash TTS」。{config.ttsModel && !isModelId(config.ttsModel) && <span className="text-[#C62828]">（你现在填的格式不对，会被自动忽略，建议清空）</span>}
					</div>
					<div className="mx-4 mt-1 rounded-[6px] bg-white px-3">
						<input
							className="w-full bg-transparent py-3 text-[15px] outline-none placeholder:text-black/30"
							placeholder="留空 = 自动"
							value={config.ttsModel ?? ""}
							onChange={(e) => setConfig((v) => ({ ...v, ttsModel: e.target.value.trim() }))}
						/>
					</div>
					{voiceNote && <div className="whitespace-pre-line px-4 pt-2 text-[12px] text-[#576B95] leading-5">{voiceNote}</div>}
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
				<button type="button" disabled={busy || !hasApiKey(config)} onClick={test} className="mx-auto mt-5 block h-[46px] w-[200px] rounded-[6px] bg-[#07C160] text-[16px] text-white disabled:opacity-40">
					{busy ? "检测中…" : "检测连接"}
				</button>
				{result && <div className={`mx-4 mt-4 rounded-[8px] p-3 text-[14px] leading-6 ${result.ok ? "bg-[#E6F6EC] text-[#0a7a3c]" : "bg-[#FBE9E9] text-[#C62828]"}`}>{result.text}</div>}
			</div>
		</div>
	);
};

export default AiSettings;
