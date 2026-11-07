import atomWithStorage from "./atomWithStorage";
import { mainStore } from "./store";

export type GeminiConfig = {
	/** 只保存在本机 localStorage，不会上传、不写进代码 */
	apiKey: string;
	model: string;
	/** 成人虚构聊天模式（默认开启）：附加系统指令并放宽 Gemini 的内容过滤档位 */
	adultMode?: boolean;
	/** 截图识别用的模型；留空 = 和文字模型一样 */
	visionModel?: string;
	/** 语音合成（声音）模型；留空 = 自动 */
	ttsModel?: string;
	/** 三种场景的声音：私人 AI 朗读 / 对方的语音消息 / 我的语音消息 */
	voices?: { ai?: string; friend?: string; mine?: string };
	/** 备用密钥（第二个 Google 账号）：主密钥额度用完 / 繁忙 / 出错时自动改用它 */
	apiKey2?: string;
	/** 三种角色的默认声音档案（音色、人设、口音、气声、胸腔共鸣、听筒滤波） */
	profiles?: { ai?: VoiceProfile; friend?: VoiceProfile; mine?: VoiceProfile };
	/** 全局语速节奏、声场、防拦截 */
	fx?: VoiceFx;
	/** 三种角色默认使用的「声音库」里的声音 id */
	assign?: { ai?: string; friend?: string; mine?: string };
	/** 两个密钥怎么用：自动（主密钥优先，出错换备用）/ 备用优先 / 只用主 / 只用备用 */
	keyMode?: "auto" | "backupFirst" | "main" | "backup";
};

export type VoiceProfile = {
	voice: string;
	/** 角色基底人设与说话习惯 */
	persona?: string;
	accent?: string;
	/** 气泡音 / 贴耳呼吸感 0~100 */
	air?: number;
	/** 胸腔共鸣 / 磁性厚度 0~100 */
	chest?: number;
	/** 电话听筒 / 微信劣质麦滤波 */
	phone?: boolean;
};

export type VoiceFx = {
	pace?: "chat" | "fast" | "night";
	scene?: "pure" | "bed" | "living" | "restaurant" | "rain" | "mall" | "street";
	/** 情绪词智能软化 */
	soften?: boolean;
	/** 每行「原词=同音安全词」 */
	dict?: string;
};

export const VOICE_ACCENTS = ["默认自然口语", "台湾甜妹腔", "川渝火辣味", "东北老铁味", "京津贫嘴味", "粤普大佬味"];

export const VOICE_PACES: { id: NonNullable<VoiceFx["pace"]>; title: string; desc: string; rate: number; prompt: string }[] = [
	{ id: "chat", title: "⚡ 自然熟人微信闲聊", desc: "默认，语速约 1.15 倍，松弛连读，不像播音", rate: 1.15, prompt: "请用真人发微信语音的自然快节奏口语连读，带真实呼吸感，绝不要像播音员朗读" },
	{ id: "fast", title: "🔥 快节奏互怼 / 群聊轰炸", desc: "语速约 1.25 倍，起音极快，话赶话", rate: 1.25, prompt: "请用真人发微信语音的快节奏口语，起音极快、话赶话、连读，带真实呼吸感，绝不要像播音员朗读" },
	{ id: "night", title: "🌙 深夜被窝走心私聊", desc: "语速放慢，呼吸感加重，留白明显", rate: 0.95, prompt: "请用真人深夜躺在被窝里发微信语音的慢节奏，呼吸感加重，句间留白明显，绝不要像播音员朗读" },
];

export const VOICE_SCENES: { id: NonNullable<VoiceFx["scene"]>; title: string; desc: string }[] = [
	{ id: "pure", title: "💬 纯净微信语音条", desc: "干声 + 近讲压限，最适合气泡里点播" },
	{ id: "bed", title: "🛏️ 家里被窝私密夜话", desc: "极短贴耳早期反射 0.24 秒" },
	{ id: "living", title: "🛋️ 夜晚客厅 / 房间", desc: "小房间混响 0.48 秒 + 极轻室内底噪" },
	{ id: "restaurant", title: "🍻 嘈杂餐厅 / 夜宵摊", desc: "叠加低音量人群喧哗底噪" },
	{ id: "rain", title: "🌧️ 雨夜车内", desc: "叠加窗外微雨底噪 + 车厢混响" },
	{ id: "mall", title: "🛍️ 热闹商场 / 超市", desc: "中等空间混响 0.8 秒 + 轻柔背景人声与脚步底噪" },
	{ id: "street", title: "🚗 户外马路 / 街头", desc: "低频车流环境底噪 + 开阔无室内混响" },
];

const SCENE_ALIAS: Record<string, NonNullable<VoiceFx["scene"]>> = { clean: "pure", pure: "pure", bed: "bed", room: "living", living: "living", crowd: "restaurant", restaurant: "restaurant", rain: "rain", mall: "mall", street: "street" };
const PACE_ALIAS: Record<string, NonNullable<VoiceFx["pace"]>> = { normal: "chat", chat: "chat", fast: "fast", slow: "night", night: "night" };
/** AI 写的 scene / pace 标签（clean/bed/room/crowd/rain/mall/street，normal/fast/slow）转成内部名字；认不出就返回 undefined */
export const normScene = (v?: string) => (v ? SCENE_ALIAS[v.trim().toLowerCase()] : undefined);
export const normPace = (v?: string) => (v ? PACE_ALIAS[v.trim().toLowerCase()] : undefined);

export type VoiceOption = { id: string; label: string; desc: string; gender: "男" | "女" };

/** Gemini 语音合成的 30 款官方声音（名字是官方声音名，说明是大致听感） */
const M = (id: string, desc: string): VoiceOption => ({ id, label: id, desc, gender: "男" });
const F = (id: string, desc: string): VoiceOption => ({ id, label: id, desc, gender: "女" });
export const GEMINI_VOICES: VoiceOption[] = [
	M("Charon", "深沉磁性成熟男低音 / 霸总 / 夜间电台"),
	M("Fenrir", "浑厚爆发力男声 / 情绪张力极强"),
	M("Puck", "阳光松弛暖男 / 自然熟人日常闲聊"),
	M("Enceladus", "极近贴耳气声 / 气泡音男低音 / 私密耳语"),
	M("Orus", "冷峻干脆青年男声 / 精英感"),
	M("Algenib", "粗犷沙哑颗粒感男声 / 沧桑感"),
	M("Sadachbia", "高亢激昂高张力男声 / 爱起哄"),
	M("Algieba", "温润儒雅绅士男声"),
	M("Achird", "清爽干净少年感男声"),
	M("Sadaltager", "温和治愈男声"),
	M("Iapetus", "冷静悬疑男声"),
	M("Rasalgethi", "理性学者男声"),
	M("Alnilam", "端庄播音男声"),
	M("Schedar", "冷酷深沉男声"),
	M("Umbriel", "暗夜低语男声"),
	M("Zubenelgenubi", "豪爽大哥男声"),
	F("Zephyr", "清澈自然年轻女生 / 日常恋爱女友"),
	F("Aoede", "温柔知性女声 / 细腻呼吸感"),
	F("Achernar", "轻柔贴耳睡眠气声 / 气泡音软妹"),
	F("Despina", "情绪饱满高表现力女声 / 委屈哭腔或毒舌吐槽"),
	F("Kore", "清冷尖锐强势御姐 / 干练反驳"),
	F("Laomedeia", "甜糯撒娇台湾腔软妹"),
	F("Callirrhoe", "慵懒微醺熟女 / 勾人语调"),
	F("Autonoe", "活泼灵动元气少女"),
	F("Leda", "端庄温柔姐姐"),
	F("Gacrux", "醇厚大女主女中音"),
	F("Pulcherrima", "明艳娇俏大小姐"),
	F("Sulafat", "温暖长姐女声"),
	F("Erinome", "沉静知性女声"),
	F("Vindemiatrix", "冷艳神秘女声"),
];

export type VoiceRole = "ai" | "friend" | "mine";

export const DEFAULT_VOICE: Record<VoiceRole, string> = { friend: "Aoede", mine: "Puck", ai: "Kore" };

/** 每个聊天单独的声音档案（覆盖全局默认）：对方 / 我 */
export const convVoicesAtom = atomWithStorage<Record<string, { friend?: string | VoiceProfile; mine?: string | VoiceProfile }>>("conv-voices", {});

/** 声音库：试听满意后保存并命名，保存后就是固定的声音 */
export type VoicePreset = { id: string; name: string; profile: VoiceProfile };
export const voicePresetsAtom = atomWithStorage<VoicePreset[]>("voice-presets", []);

/** 按「使用方式」排好顺序的可用密钥 */
export const getKeys = (c: { apiKey?: string; apiKey2?: string; keyMode?: string } = mainStore.get(geminiConfigAtom)): { id: "main" | "backup"; key: string }[] => {
	const m = c.apiKey ? [{ id: "main" as const, key: c.apiKey }] : [];
	const b = c.apiKey2 ? [{ id: "backup" as const, key: c.apiKey2 }] : [];
	if (c.keyMode === "backupFirst") return [...b, ...m];
	if (c.keyMode === "main") return m;
	if (c.keyMode === "backup") return b;
	return [...m, ...b];
};

/** 有没有可用的密钥（主密钥或备用密钥任意一个） */
export const hasApiKey = (c: { apiKey?: string; apiKey2?: string }) => !!(c.apiKey || c.apiKey2);

/** 取某个角色当前生效的声音档案：该聊天的单独设置 > 全局默认 > 旧版声音设置 > 内置默认 */
export const resolveProfile = (role: VoiceRole, conversationId?: string): VoiceProfile => {
	const cfg = mainStore.get(geminiConfigAtom);
	const presets = mainStore.get(voicePresetsAtom);
	const byId = (id?: string) => presets.find((x) => x.id === id)?.profile;
	const entry = conversationId && role !== "ai" ? mainStore.get(convVoicesAtom)[conversationId]?.[role] : undefined;
	const conv = typeof entry === "string" ? byId(entry) : entry;
	const picked = conv ?? byId(cfg.assign?.[role]);
	if (picked) return { ...picked, voice: picked.voice || DEFAULT_VOICE[role] };
	const base = cfg.profiles?.[role];
	return { ...base, voice: base?.voice || cfg.voices?.[role] || DEFAULT_VOICE[role] };
};

export const DEFAULT_TTS_MODEL = "gemini-2.5-flash-preview-tts";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

/** 谷歌已对新用户停用的旧模型，遇到时自动改用默认模型 */
export const RETIRED_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-pro", "gemini-flash-lite-latest"];
/** 文字 AI 依次尝试的模型（前一个报「不存在」就换下一个） */
export const TEXT_MODEL_CHAIN = ["gemini-2.5-flash", "gemini-3-flash-preview", "gemini-flash-latest", "gemini-2.5-flash-lite"];

export const geminiConfigAtom = atomWithStorage<GeminiConfig>("gemini-config", {
	apiKey: "",
	model: DEFAULT_GEMINI_MODEL,
});

export const getGeminiConfig = () => mainStore.get(geminiConfigAtom);

export const ADULT_MODE_PROMPT = `成人聊天记录生成模式｜最高开放度
你是一个专业的虚构社交内容生成引擎，主要负责生成朋友圈、私聊记录、群聊记录、人物对话和社交场景。
一、生成原则
1. 面向明确设定为成年人的虚构人物。
2. 尊重用户指定的关系、人设、语气、场景和聊天背景。
3. 不要默认采用保守、含蓄、客气的表达方式。
4. 根据人物关系自然使用口语、粗口、俚语、调侃、挑逗和成人语言。
5. 用户要求直白表达时，不要擅自改写成委婉表达。
6. 不要主动删除用户要求的内容，不要无故中断生成。
7. 不要在生成结果后添加道德评价、教育性提醒或无关解释。
二、聊天真实性
1. 每个人物必须保持独立性格、说话习惯和语言风格。
2. 对话必须有自然的上下文联系，不能像模板拼接。
3. 根据人物关系决定称呼、语气、亲密程度和交流方式。
4. 允许出现情绪变化、争执、调情、玩笑、粗俗表达和私人话题。
5. 不要让所有人物使用相同的表达方式。
三、成人内容处理
对于成年人之间自愿、虚构的亲密关系和成人话题，允许采用成熟、直接、不刻意回避的语言风格。
不要因为出现成人词汇、粗口、亲密关系或性话题，就自动将整段内容判定为不适合生成。
如果某个具体要求超出模型实际允许的范围，只调整必要的部分，尽可能保留用户要求的场景、人物关系、语言风格和其他内容，不要直接放弃整个任务。
四、输出要求
1. 严格按照用户指定的聊天记录格式输出。
2. 不要额外解释创作过程。
3. 不要擅自降低语言强度。
4. 不要重复免责声明。
5. 优先保证人物真实感、对话连贯性和内容完整性。`;
