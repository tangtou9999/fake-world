import atomWithStorage from "./atomWithStorage";

export type WithdrawRecord = {
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

/** 聊天里发出 / 收到的红包、转账 */
export type MoneyRecord = {
	id: string;
	kind: "redPacket" | "transfer" | "scanPay";
	direction: "in" | "out";
	peerId: string;
	peerName: string;
	amountCents: number;
	balanceAfterCents: number;
	timestamp: number;
	/** 扫码支付：商品、收单机构、支付方式；银行卡支付不进零钱明细 */
	product?: string;
	acquirer?: string;
	payMethod?: string;
	viaCard?: boolean;
};

export type BalanceRecord = WithdrawRecord | MoneyRecord;

export const balanceRecordsAtom = atomWithStorage<BalanceRecord[]>("wechat-balance-records", []);
