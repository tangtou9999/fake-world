import type { IFeedComment, IStateFeed } from "@/stateV2/moments";
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

export const DEFAULT_FEED_COMMENT: Omit<IFeedComment, "id"> = {
	fromUserId: MYSELF_ID,
	text: [
		{
			type: "paragraph",
			children: [{ text: "这是自动生成的评论，进入编辑模式进行修改或删除" }],
		},
	],
	sendTimestamp: dayjs().valueOf(),
};

export const INIT_FEEDS: IStateFeed[] = importedFeeds;
