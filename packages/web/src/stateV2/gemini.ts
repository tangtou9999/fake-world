import atomWithStorage from "./atomWithStorage";
import { mainStore } from "./store";

export type GeminiConfig = {
	/** 只保存在本机 localStorage，不会上传、不写进代码 */
	apiKey: string;
	model: string;
};

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export const geminiConfigAtom = atomWithStorage<GeminiConfig>("gemini-config", {
	apiKey: "",
	model: DEFAULT_GEMINI_MODEL,
});

export const getGeminiConfig = () => mainStore.get(geminiConfigAtom);
