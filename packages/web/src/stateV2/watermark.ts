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
	/** 文字后面自动加上账号后四位，万一截图流出去能查是谁 */
	trace: boolean;
	/** 口令的 SHA-256；空字符串表示没上锁 */
	lock: string;
};

/** 出厂口令的哈希（口令只有主人知道，进入「工具 → 水印」后可以改成自己的） */
export const WM_DEFAULT_LOCK = "1cc31664e473e7a7d603dec24356dd06d87327342d38c843b6934d646eac2079";

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
	trace: false,
	lock: WM_DEFAULT_LOCK,
};

export const watermarkAtom = atomWithStorage<Partial<Watermark>>("watermark", {});

export const withDefaults = (w: Partial<Watermark>): Watermark => ({ ...WM_DEFAULT, ...w });

export const hashPin = async (pin: string) => {
	const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`wm:${pin}`));
	return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

/** 这一次打开页面期间是否已输对口令（刷新页面就重新上锁） */
let unlocked = false;
export const isUnlocked = () => unlocked;
export const setUnlocked = (v: boolean) => {
	unlocked = v;
};
