import { atom } from "jotai";
import { mainStore } from "./store";

export type KeyId = "main" | "backup" | "deepseek";
export type KeyUse = { which: KeyId; ok: boolean; msg?: string; at: number };

/** 最近一次「文字 AI / 声音」实际用了哪个密钥（只在内存里，刷新后清空） */
export const keyStatusAtom = atom<{ text?: KeyUse; tts?: KeyUse }>({});

export const recordKeyUse = (kind: "text" | "tts", which: KeyId, ok: boolean, msg?: string) => {
	mainStore.set(keyStatusAtom, (v) => ({ ...v, [kind]: { which, ok, msg, at: Date.now() } }));
};
