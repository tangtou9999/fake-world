import type { Descendant } from "slate";
import type { IStateProfile } from "../profile";

interface IFeedContentText {
	type: "text";
	text: Descendant[];
}

interface IFeedContentTextWithImages {
	type: "textWithImages";
	text?: Descendant[];
	imagesInfo: string[];
}

interface IFeedContentVideo {
	type: "video";
	text?: Descendant[];
	/** 首帧封面 */
	videoInfo: string;
	/** 视频文件，存在本地 Dexie */
	videoFile?: string;
	duration?: number;
}

type IFeedContent = IFeedContentText | IFeedContentTextWithImages | IFeedContentVideo;

export interface IFeedComment {
	id: string;
	text: Descendant[];
	replyUserId?: IStateProfile["id"];
	fromUserId: IStateProfile["id"];
	sendTimestamp: number;
}

export interface IStateFeed {
	id: string;
	userId: IStateProfile["id"];
	sendTimestamp: number;
	content: IFeedContent;
	likeUserIds?: IStateProfile["id"][];
	comments?: IFeedComment[];
	/** 朋友圈位置，例如「南京·玄武湖」 */
	location?: string;
}

export type TStateFeedLst = IStateFeed[];
