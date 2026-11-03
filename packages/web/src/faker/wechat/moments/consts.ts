import type { IStateFeed } from "@/stateV2/moments";
import dayjs from "dayjs";
import { importedFeeds } from "../imported";
import { MYSELF_ID } from "../user";

export const DEFAULT_FEED: Omit<IStateFeed, "id"> = {
	userId: MYSELF_ID,
	sendTimestamp: dayjs().valueOf(),
	content: {
		type: "text",
		text: [{ type: "paragraph", children: [{ text: "" }] }],
	},
	likeUserIds: [],
	comments: [],
};

export const INIT_FEEDS: IStateFeed[] = importedFeeds;
