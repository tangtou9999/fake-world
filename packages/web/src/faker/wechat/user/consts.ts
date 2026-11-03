import type { IStateProfile, TStateAllProfiles } from "@/stateV2/profile";
import { importedFriends } from "../imported";

export const MYSELF_ID = "0";

export const INIT_MY_PROFILE: IStateProfile = {
	id: MYSELF_ID,
	nickname: "林克",
	avatarInfo: "https://cdn-fakeworld.azureedge.net/fakeworld/ppf3dl.jpg",
	wechat: "link",
	momentsBackgroundInfo: "https://cdn-fakeworld.azureedge.net/fakeworld/pnqqk6.jpg",
	momentsPrivacy: "all",
	gender: "male",
	thumbnailInfo: [],
	momentsBackgroundLike: false,
	privacy: "all",
	area: "江苏 常州",
	phone: ["13612345666"],
	signature: "Master Sword!!!!",
	ringtone: "晴天",
};

export const INIT_FRIENDS: TStateAllProfiles = importedFriends;
