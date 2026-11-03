import atomWithStorage from "./atomWithStorage";

export type BalanceRecord = {
	id: string;
	kind: "withdraw";
	bankName: string;
	last4: string;
	amountCents: number;
	feeCents: number;
	balanceAfterCents: number;
	timestamp: number;
	arrivalAt: number;
};

export const balanceRecordsAtom = atomWithStorage<BalanceRecord[]>("wechat-balance-records", []);
