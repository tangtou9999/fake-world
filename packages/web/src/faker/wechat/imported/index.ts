import type { TConversationItem } from "@/stateV2/conversation/typing";
import type { IDialogueItem } from "@/stateV2/dialogueList";
import type { IStateFeed } from "@/stateV2/moments/typing";
import type { IStateProfile } from "@/stateV2/profile/typing";
import raw from "./seed.json";

type SeedFile = {
	profiles: IStateProfile[];
	dialogues: IDialogueItem[];
	conversations: Record<string, TConversationItem[]>;
	feeds: IStateFeed[];
};

const seed = raw as unknown as SeedFile;

function asset(relativePath: string) {
	return `${import.meta.env.BASE_URL}${relativePath}`;
}

function mapProfile(profile: IStateProfile): IStateProfile {
	return {
		...profile,
		avatarInfo: asset(profile.avatarInfo),
		momentsBackgroundInfo: profile.momentsBackgroundInfo
			? asset(profile.momentsBackgroundInfo)
			: undefined,
		thumbnailInfo: profile.thumbnailInfo.map(asset),
	};
}

function mapMessage(message: TConversationItem): TConversationItem {
	if (message.type === "image") {
		return { ...message, imageInfo: asset(message.imageInfo) };
	}
	if (message.type === "personalCard") {
		return { ...message, avatarInfo: asset(message.avatarInfo) };
	}
	return message;
}

function mapFeed(feed: IStateFeed): IStateFeed {
	if (feed.content.type !== "textWithImages") return feed;
	return {
		...feed,
		content: {
			...feed.content,
			imagesInfo: feed.content.imagesInfo.map(asset),
		},
	};
}

export const importedFriends: IStateProfile[] = seed.profiles.map(mapProfile);

export const importedDialogues: IDialogueItem[] = seed.dialogues;

export const importedConversations: Record<string, TConversationItem[]> = Object.fromEntries(
	Object.entries(seed.conversations).map(([id, messages]) => [id, messages.map(mapMessage)]),
);

export const importedFeeds: IStateFeed[] = seed.feeds.map(mapFeed);
