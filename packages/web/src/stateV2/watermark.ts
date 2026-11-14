import { atom } from "jotai";
import atomWithStorage from "./atomWithStorage";

export type Watermark = {
	on: boolean;
	text: string;
	size: number;
	color: string;
	/** 0.03 ~ 1 */
	opacity: number;
	/** -90 ~ 90 */
	angle: number;
	gapX: number;
	gapY: number;
	style: "solid" | "hollow" | "both";
	bold: boolean;
	stagger: boolean;
	scope: "chat" | "all";
	/** top：盖在聊天内容上面（截图最稳）；under：垫在气泡/红包下面（气泡不透明） */
	layer: "top" | "under";
	/** 文字后面自动加上账号后四位，万一截图流出去能查是谁 */
	trace: boolean;
};

export const WM_DEFAULT: Watermark = {
	on: true,
	text: "剧本演绎 · 禁止转发",
	size: 18,
	color: "#8A8A8A",
	opacity: 0.2,
	angle: -25,
	gapX: 60,
	gapY: 70,
	style: "solid",
	bold: false,
	stagger: true,
	scope: "chat",
	layer: "under",
	trace: false,
};

export const watermarkOpenAtom = atom(false);

export const watermarkAtom = atomWithStorage<Partial<Watermark>>("watermark", {});

export const withDefaults = (w: Partial<Watermark>): Watermark => ({ ...WM_DEFAULT, ...w });
