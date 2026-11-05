import atomWithStorage from "./atomWithStorage";
import { mainStore } from "./store";

export type GeminiConfig = {
	/** 只保存在本机 localStorage，不会上传、不写进代码 */
	apiKey: string;
	model: string;
};

export const DEFAULT_GEMINI_MODEL = "gemini-flash-lite-latest";
/** 常用模型（点一下就能切换）。gemini-2.5-flash-lite 已停用，不再列出 */
export const QUICK_MODELS = [
	"gemini-flash-lite-latest",
	"gemini-flash-latest",
	"gemini-2.5-flash",
	"gemini-3-flash-preview",
];

export const geminiConfigAtom = atomWithStorage<GeminiConfig>("gemini-config", {
	apiKey: "",
	model: DEFAULT_GEMINI_MODEL,
});

// 一次性迁移：旧版默认的 gemini-2.5-flash 改为已验证可用的 gemini-flash-lite-latest
try {
	if (typeof localStorage !== "undefined" && !localStorage.getItem("gemini-model-v2")) {
		localStorage.setItem("gemini-model-v2", "1");
		const cur = mainStore.get(geminiConfigAtom);
		if (!cur.model || cur.model === "gemini-2.5-flash") {
			mainStore.set(geminiConfigAtom, { ...cur, model: DEFAULT_GEMINI_MODEL });
		}
	}
} catch {
	// ignore
}

export const getGeminiConfig = () => mainStore.get(geminiConfigAtom);
