import { atom } from "jotai";

// null = 面板关闭；"tools" = 工具页（编辑模式开关、截图等）；"edit" = 编辑内容页
export type TMobilePanel = null | "tools" | "edit";

export const mobilePanelAtom = atom<TMobilePanel>(null);
