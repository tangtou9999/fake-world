import type { IStateProfile } from "@/stateV2/profile";

export const FILE_HELPER_ID = "file-helper";

const AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#07C160"/><path d="M23.7 27.3h14.5q1.2 0 2 .8l3.2 3.2h27.3q2.2 0 2.2 2.2v31.4q0 2.2-2.2 2.2H23.7q-2.2 0-2.2-2.2V29.5q0-2.2 2.2-2.2z" fill="#fff"/><path d="M37.7 47.4H52V43l8.5 7.5L52 58v-4.4H37.7z" fill="#07C160"/></svg>`;

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
