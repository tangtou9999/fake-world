/** 服务费 = max(¥0.01, 金额 × 0.10%)，以分为整数计算。 */
export function feeCentsOf(amountCents: number): number {
	if (amountCents <= 0) return 0;
	return Math.max(1, Math.round(amountCents / 1000));
}

export function yuanToCents(input: string): number | null {
	const value = input.trim();
	if (!value || value === ".") return null;
	if (!/^\d+(\.\d{0,2})?$/.test(value)) return null;
	const [whole, frac = ""] = value.split(".");
	const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
	if (!Number.isSafeInteger(cents)) return null;
	return cents;
}

export function centsToYuan(cents: number): string {
	const sign = cents < 0 ? "-" : "";
	const abs = Math.abs(cents);
	return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** 全部提现：金额 + 服务费不超过余额的最大金额。 */
export function maxWithdrawCents(balanceCents: number): number {
	let lo = 0;
	let hi = Math.max(0, balanceCents);
	let best = 0;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (mid + feeCentsOf(mid) <= balanceCents) {
			best = mid;
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}
	return best;
}

export function appendAmountKey(current: string, key: string): string {
	if (key === "del") return current.slice(0, -1);
	if (key === ".") {
		if (current.includes(".")) return current;
		return `${current || "0"}.`;
	}
	if (current === "0") return key;
	const next = current + key;
	const [whole, frac] = next.split(".");
	if (whole.length > 8) return current;
	if (frac && frac.length > 2) return current;
	return next;
}

export function formatArrival(timestamp: number): string {
	const date = new Date(timestamp);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `预计${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}前到账`;
}

export function formatRecordTime(timestamp: number): string {
	const date = new Date(timestamp);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
