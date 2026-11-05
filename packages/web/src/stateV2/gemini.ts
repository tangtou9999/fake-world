import atomWithStorage from "./atomWithStorage";
import { mainStore } from "./store";

export type GeminiConfig = {
	/** 只保存在本机 localStorage，不会上传、不写进代码 */
	apiKey: string;
	model: string;
};

export const DEFAULT_GEMINI_MODEL = "gemini-flash-lite-latest";

/** 常用模型（点一下就能切换） */
export const GEMINI_MODEL_PRESETS = [
	"gemini-flash-lite-latest",
	"gemini-flash-latest",
	"gemini-2.5-flash",
	"gemini-3-flash-preview",
];

/** 旧版本把密钥存在 gemini-config，这里沿用密钥、模型换成新的默认值 */
function initialConfig(): GeminiConfig {
	try {
		const old = JSON.parse(localStorage.getItem("gemini-config") || "null");
		if (old?.apiKey) return { apiKey: old.apiKey, model: DEFAULT_GEMINI_MODEL };
	} catch {
		// ignore
	}
	return { apiKey: "", model: DEFAULT_GEMINI_MODEL };
}

export const geminiConfigAtom = atomWithStorage<GeminiConfig>("gemini-config-v2", initialConfig());

export const getGeminiConfig = () => mainStore.get(geminiConfigAtom);
