import dayjs from "dayjs";
import type { TConversationItem } from "./typing";

const WEEK = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

/** 微信时间标签规则：今天 HH:mm / 昨天 HH:mm / 星期X HH:mm（一周内）/ M月D日 HH:mm / YYYY年M月D日 HH:mm */
export const formatWechatTime = (ts: number, nowTs: number = Date.now()) => {
	const d = dayjs(ts);
	const now = dayjs(nowTs);
	const hm = d.format("HH:mm");
	const days = now.startOf("day").diff(d.startOf("day"), "day");
	if (days <= 0) return hm;
	if (days === 1) return `昨天 ${hm}`;
	if (days < 7) return `${WEEK[d.day()]} ${hm}`;
	if (d.year() === now.year()) return `${d.month() + 1}月${d.date()}日 ${hm}`;
	return `${d.year()}年${d.month() + 1}月${d.date()}日 ${hm}`;
};

/** 旧数据里只存了 "HH:mm" 的标签：若消息不是今天发的，显示时补上「昨天 / 星期X」 */
export const normalizeUpperText = (upper: string | undefined, ts: number | undefined) => {
	if (!upper || !ts || !/^\d{1,2}:\d{2}$/.test(upper)) return upper;
	const d = dayjs(ts);
	if (d.format("H:mm") !== upper.replace(/^0/, "") || d.isSame(dayjs(), "day")) return upper;
	return formatWechatTime(ts);
};

export const fromLastGenerateUpperText = (list: TConversationItem[]) => {
	const last = list[list.length - 1];
	let upperText: undefined | string;
	if (!last || !last.sendTimestamp) upperText = formatWechatTime(Date.now());
	if (last?.sendTimestamp && dayjs().diff(last.sendTimestamp, "minute") >= 4) {
		upperText = formatWechatTime(Date.now());
	}
	return upperText;
};
