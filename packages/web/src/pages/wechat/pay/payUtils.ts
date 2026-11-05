import type { BalanceRecord } from "@/stateV2/balanceRecords";

const pad = (n: number) => String(n).padStart(2, "0");

export const fmtFull = (ts: number) => {
	const d = new Date(ts);
	return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const fmtShort = (ts: number) => {
	const d = new Date(ts);
	const now = new Date();
	const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
	if (d.toDateString() === now.toDateString()) return hm;
	return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
};

/** 用记录 id + 时间生成稳定的假单号 */
export const orderNo = (r: BalanceRecord, prefix = "4200") => {
	const d = new Date(r.timestamp);
	const base = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
	let h = 0;
	for (const c of r.id) h = (h * 31 + c.charCodeAt(0)) % 1000000007;
	return `${prefix}${String(h).padStart(10, "0")}${base}`.slice(0, 28);
};

export const productOf = (r: Exclude<BalanceRecord, { kind: "withdraw" }>) =>
	r.kind === "redPacket" ? "微信红包" : r.kind === "transfer" ? "转账" : r.product || "商品";

export const fmtDash = (ts: number) => {
	const d = new Date(ts);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
