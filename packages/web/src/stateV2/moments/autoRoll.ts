import { getFeedListValueSnapshot, setFeedListValue } from "./core";

const H = 3_600_000;
const DAY = 24 * H;

const hash = (s: string) => {
	let h = 0;
	for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
	return h;
};

/**
 * 朋友圈保持「新鲜」：
 * 1. 最新一条超过半天没更新（且不超过 30 天），就把近 30 天内的朋友圈整体往后平移，
 *    让最新一条落在「几小时前」，条与条之间的间隔、评论时间都保持不变。
 * 2. 点赞太多会显得所有人互相认识：每条最多留 2~4 个赞（只处理一次）。
 */
export const refreshMoments = () => {
	const now = Date.now();
	const list = getFeedListValueSnapshot();
	if (!list.length) return;
	const newest = Math.max(...list.map((f) => f.sendTimestamp));
	const age = now - newest;
	const needRoll = age > 12 * H && age < 30 * DAY;
	let needTrim = false;
	try {
		needTrim = localStorage.getItem("moments-likes-trim-v1") !== "1";
	} catch {
		// 忽略
	}
	if (!needRoll && !needTrim) return;
	const delta = needRoll ? now - (1.5 + (hash(String(newest)) % 5)) * H - newest : 0;
	const from = newest - 30 * DAY;
	setFeedListValue((prev) =>
		prev.map((f) => {
			let next = f;
			if (delta && f.sendTimestamp >= from) {
				next = {
					...next,
					sendTimestamp: Math.min(now, f.sendTimestamp + delta),
					comments: next.comments?.map((c) => ({ ...c, sendTimestamp: Math.min(now, c.sendTimestamp + delta) })),
				};
			}
			if (needTrim && (next.likeUserIds?.length ?? 0) > 4) {
				const keep = 2 + (hash(f.id) % 3);
				next = { ...next, likeUserIds: next.likeUserIds?.slice(0, keep) };
			}
			return next;
		}),
	);
	try {
		localStorage.setItem("moments-likes-trim-v1", "1");
	} catch {
		// 忽略
	}
};
