import atomWithStorage from "./atomWithStorage";
import { mainStore } from "./store";

export enum MOBILE_LIST {
	AUTO = "auto",
	IPHONE_12_PRO = "iPhone 12 Pro",
	IPHONE_14_PRO_MAX = "iPhone 14 Pro Max",
	IPHONE_XR = "iPhone XR",
	IPHONE_SE = "iPhone SE",
	PIXEL = "Pixel",
}

export const MOBILE_LIST_LABEL = {
	[MOBILE_LIST.AUTO]: "menu.mainBlock.device.auto",
	[MOBILE_LIST.IPHONE_14_PRO_MAX]: "iPhone 14 Pro Max",
	[MOBILE_LIST.IPHONE_12_PRO]: "iPhone 12 Pro",
	[MOBILE_LIST.IPHONE_XR]: "iPhone XR",
	[MOBILE_LIST.IPHONE_SE]: "iPhone SE",
	[MOBILE_LIST.PIXEL]: "Pixel",
};

export const SCREEN_SIZE = {
	[MOBILE_LIST.IPHONE_14_PRO_MAX]: {
		width: 430,
		height: 932,
	},
	[MOBILE_LIST.IPHONE_12_PRO]: {
		width: 390,
		height: 844,
	},
	[MOBILE_LIST.IPHONE_XR]: {
		width: 414,
		height: 896,
	},
	[MOBILE_LIST.IPHONE_SE]: {
		width: 375,
		height: 667,
	},
	[MOBILE_LIST.PIXEL]: {
		width: 412,
		height: 915,
	},
};

/**
 * Chrome for the simulated iPhone frame.
 * Face ID phones: 47pt status bar (54pt with Dynamic Island) and a 34pt home indicator.
 * Home-button phones: 20pt status bar and no home indicator.
 * Apple HIG: https://developer.apple.com/design/human-interface-guidelines/layout
 */
export function simulatedChrome(height: number) {
	if (!height || height >= 900) return { statusBar: 54, homeIndicator: 34 };
	if (height >= 800) return { statusBar: 47, homeIndicator: 34 };
	return { statusBar: 20, homeIndicator: 0 };
}

export const deviceAtom = atomWithStorage<MOBILE_LIST>("device", MOBILE_LIST.AUTO);

window.setDevice = (v) => {
	mainStore.set(deviceAtom, v as MOBILE_LIST);
};
