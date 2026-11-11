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
	miniFundTotal?: string;
	miniFundYesterday?: string;
	miniFundName?: string;
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
	miniFundTotal: "29.03",
	miniFundYesterday: "0.00",
	miniFundName: "南方现金通货币E",
	finCurrent: "1.39",
	finFixed: "2.28",
});

export const getWalletVauleSnapshot = () => mainStore.get(walletAtom);
