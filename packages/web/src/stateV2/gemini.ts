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
};

export type VoiceOption = { id: string; label: string; desc: string };

/** Gemini 语音合成自带的声音（名字是官方声音名，说明是它们的大致听感） */
export const GEMINI_VOICES: VoiceOption[] = [
	{ id: "Kore", label: "Kore", desc: "女声·干练坚定" },
	{ id: "Aoede", label: "Aoede", desc: "女声·轻松明快" },
	{ id: "Leda", label: "Leda", desc: "女声·年轻清亮" },
	{ id: "Zephyr", label: "Zephyr", desc: "女声·明亮活泼" },
	{ id: "Achernar", label: "Achernar", desc: "女声·温柔柔和" },
	{ id: "Sulafat", label: "Sulafat", desc: "女声·温暖亲切" },
	{ id: "Puck", label: "Puck", desc: "男声·欢快有活力" },
	{ id: "Charon", label: "Charon", desc: "男声·沉稳知性" },
	{ id: "Fenrir", label: "Fenrir", desc: "男声·兴奋热情" },
	{ id: "Orus", label: "Orus", desc: "男声·坚定有力" },
	{ id: "Algenib", label: "Algenib", desc: "男声·低沉沙哑" },
	{ id: "Iapetus", label: "Iapetus", desc: "男声·清晰随和" },
];

export const DEFAULT_TTS_MODEL = "gemini-2.5-flash-preview-tts";

export const DEFAULT_GEMINI_MODEL = "gemini-flash-lite-latest";

/** 谷歌已对新用户停用的旧模型，遇到时自动改用默认模型 */
export const RETIRED_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-pro"];

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
