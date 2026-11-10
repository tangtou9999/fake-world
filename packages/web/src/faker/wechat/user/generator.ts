import getFakerInstanceByLang from "@/faker/core";
import { pickFriendAvatar } from "@/library/pick";
import type { IStateProfile } from "@/stateV2/profile";
import { nanoid } from "nanoid";

export function randomAvatar() {
	const faker = getFakerInstanceByLang();
	return faker.image.avatarGitHub();
}

export function randomUserId() {
	return nanoid(8);
}

export function randomGender() {
	const faker = getFakerInstanceByLang();
	return faker.person.sexType();
}

export function randomNickname() {
	const faker = getFakerInstanceByLang();
	const gender = randomGender();
	return faker.person.fullName({
		sex: gender,
	});
}

function friendAvatarHint(preData: Partial<IStateProfile>) {
	return [
		preData.nickname,
		preData.remark,
		preData.description,
		preData.signature,
		...(preData.tags ?? []),
	]
		.filter((part): part is string => !!part)
		.join(" ");
}

export function generateFakeUser(preData: Partial<IStateProfile> = {}): IStateProfile {
	const faker = getFakerInstanceByLang();
	const gender = randomGender();
	const { avatarInfo: givenAvatar, ...rest } = preData;
	return {
		id: randomUserId(),
		nickname: randomNickname(),
		gender,
		wechat: faker.internet.userName({
			firstName: faker.person.firstName(gender),
			lastName: faker.person.lastName(gender),
		}),
		momentsBackgroundLike: false,
		privacy: "all",
		momentsPrivacy: "all",
		thumbnailInfo: [],
		momentsBackgroundInfo: faker.image.url(),
		...rest,
		avatarInfo: givenAvatar || pickFriendAvatar(friendAvatarHint(preData)),
	};
}
