import atomWithStorage from "./atomWithStorage";
import { mainStore } from "./store";

export type GeminiConfig = {
	/** 只保存在本机 localStorage，不会上传、不写进代码 */
	apiKey: string;
	model: string;
};

export const DEFAULT_GEMINI_MODEL = "gemini-flash-lite-latest";

/** 谷歌已对新用户停用的旧模型，遇到时自动改用默认模型 */
export const RETIRED_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-pro"];

export const geminiConfigAtom = atomWithStorage<GeminiConfig>("gemini-config", {
	apiKey: "",
	model: DEFAULT_GEMINI_MODEL,
});

export const getGeminiConfig = () => mainStore.get(geminiConfigAtom);
