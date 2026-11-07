import { atom } from "jotai";

/** 当前正在播放的聊天语音条 id（没有就是 null） */
export const playingVoiceAtom = atom<string | null>(null);
