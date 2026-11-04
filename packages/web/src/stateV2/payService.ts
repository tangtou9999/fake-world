import type { IStateProfile } from "./profile";
import { setAllProfilesValue } from "./profile";
import { setDialogueListValue } from "./dialogueList";
import { touchDialogue } from "./fileHelper";

export const PAY_ID = "wechat-pay";

const AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#07C160"/><path d="M48 20C32.5 20 20 30 20 42.500c0 6.800 3.700 12.800 9.500 16.900L27.500 68l9.800-4.900c3.400 1.100 7 1.700 10.700 1.700 15.500 0 28-10 28-22.500S63.500 20 48 20Z" fill="#fff"/><path d="M36 43l8 7.500L60 35" fill="none" stroke="#07C160" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export const PAY_PROFILE: IStateProfile = {
	id: PAY_ID,
	nickname: "微信支付",
	avatarInfo: `data:image/svg+xml;utf8,${encodeURIComponent(AVATAR_SVG)}`,
	wechat: "wechatpay",
	privacy: "all",
	thumbnailInfo: [],
	momentsBackgroundLike: false,
	momentsPrivacy: "all",
};

export function ensurePayProfile() {
	setAllProfilesValue((prev) => (prev.some((v) => v.id === PAY_ID) ? prev : [...prev, PAY_PROFILE]));
}

/** 有资金变动时：确保「微信支付」在首页出现，更新预览与时间，并带一个未读红点数字 */
export function notifyPay(preview: string) {
	try {
		ensurePayProfile();
		touchDialogue(PAY_ID, preview);
		setDialogueListValue((prev) =>
			prev.map((v) => (v.friendId === PAY_ID ? { ...v, unreadMarkNumber: (v.unreadMarkNumber ?? 0) + 1 } : v)),
		);
	} catch {
		// ignore
	}
}
