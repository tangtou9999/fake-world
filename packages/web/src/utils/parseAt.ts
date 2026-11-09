import dayjs from "dayjs";

/**
 * 宽松解析 AI 写的时间字符串，返回毫秒时间戳；认不出返回 null。
 * 支持：2026-01-06 12:00 / 2026/1/6 12:00 / 2026年1月6日 下午3点20 / 1月6日 12:00（没写年份按最近一次）/ 01-06 12:00 / ISO。
 * 只写日期没写时间时按 12:00。
 */
export const parseAt = (raw?: string | null): number | null => {
	if (!raw) return null;
	const s = String(raw).trim();
	const m = s.match(
		/(?:(\d{4})\s*[年\-/.]\s*)?(\d{1,2})\s*[月\-/.]\s*(\d{1,2})\s*日?\s*[T\s]*(?:(凌晨|早上|上午|中午|下午|晚上|夜里)?\s*(\d{1,2})\s*(?:[:：点时])\s*(\d{1,2})?)?/,
	);
	if (m) {
		const now = dayjs();
		const month = Number(m[2]);
		const day = Number(m[3]);
		let hour = m[5] !== undefined ? Number(m[5]) : 12;
		const minute = m[6] !== undefined ? Number(m[6]) : 0;
		const meridiem = m[4];
		if ((meridiem === "下午" || meridiem === "晚上" || meridiem === "夜里") && hour < 12) hour += 12;
		if (meridiem === "凌晨" && hour === 12) hour = 0;
		const build = (year: number) => dayjs(new Date(year, month - 1, day, hour, minute));
		let d = build(m[1] ? Number(m[1]) : now.year());
		if (!m[1] && d.isAfter(now.add(1, "day"))) d = build(now.year() - 1);
		if (d.isValid() && d.month() === month - 1 && d.date() === day) return d.valueOf();
		return null;
	}
	const fallback = dayjs(s);
	return fallback.isValid() ? fallback.valueOf() : null;
};
