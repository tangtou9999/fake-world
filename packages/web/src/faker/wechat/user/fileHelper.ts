import type { IStateProfile } from "@/stateV2/profile";

export const FILE_HELPER_ID = "file-helper";

const AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#07C160"/><path d="M20 33a4 4 0 0 1 4-4h17l6 7h25a4 4 0 0 1 4 4v26a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4Z" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round"/><path d="M34 52h26m-9-9 9 9-9 9" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export const FILE_HELPER_PROFILE: IStateProfile = {
	id: FILE_HELPER_ID,
	nickname: "文件传输助手",
	avatarInfo: `data:image/svg+xml;utf8,${encodeURIComponent(AVATAR_SVG)}`,
	wechat: "filehelper",
	privacy: "all",
	thumbnailInfo: [],
	momentsBackgroundLike: false,
	momentsPrivacy: "all",
};
