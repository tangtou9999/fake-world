import atomWithStorage from "./atomWithStorage";
import { mainStore } from "./store";

export type TStateWallet = {
	/** 零钱余额 */
	balance: string;
	/** 零钱通 */
	miniFund: string;
	/** 零钱通收益率，单位 % */
	miniFundYield: string;
	/** 零钱通累计收益 / 昨日收益 / 基金名称 / 理财通两个年化 */
	/** 留空 = 自动按余额和收益率算 */
	miniFundTotal?: string;
	miniFundYesterday?: string;
	miniFundName?: string;
	/** 零钱通开通日期（YYYY-MM-DD），自动算累计收益时用 */
	miniFundSince?: string;
	finCurrent?: string;
	finFixed?: string;
	/** 经营账户余额 */
	business?: string;
};

export const walletAtom = atomWithStorage<TStateWallet>("wallet", {
	balance: "520.00",
	miniFund: "1314.00",
	miniFundYield: "2.75",
	business: "0.38",
	miniFundSince: "2026-07-01",
	miniFundName: "南方现金通货币E",
	finCurrent: "1.39",
	finFixed: "2.28",
});

export const getWalletVauleSnapshot = () => mainStore.get(walletAtom);

/** 零钱通收益：填了就用填的；没填就按「余额 × 7日年化 ÷ 365」每天结算，从开通日算到昨天。 */
export const miniFundEarnings = (w: TStateWallet, today = new Date()) => {
	const bal = Number.parseFloat(w.miniFund) || 0;
	const rate = (Number.parseFloat(w.miniFundYield) || 0) / 100;
	const daily = (bal * rate) / 365;
	const since = w.miniFundSince ? new Date(`${w.miniFundSince}T00:00:00`) : null;
	const start = since && !Number.isNaN(since.getTime()) ? since : new Date(today.getFullYear(), today.getMonth(), today.getDate() - 120);
	const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
	const days = Math.max(0, Math.round((t0 - start.getTime()) / 86400000));
	const given = (v?: string) => (v !== undefined && v.trim() !== "" && !Number.isNaN(Number.parseFloat(v)) ? Number.parseFloat(v) : null);
	const yesterday = given(w.miniFundYesterday) ?? (days > 0 ? daily : 0);
	const total = given(w.miniFundTotal) ?? daily * days;
	return { yesterday: yesterday.toFixed(2), total: total.toFixed(2) };
};
