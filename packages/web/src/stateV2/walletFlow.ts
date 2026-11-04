import { nanoid } from "nanoid";
import { type MoneyRecord, balanceRecordsAtom } from "./balanceRecords";
import { getProfileValueSnapshot } from "./profile";
import { mainStore } from "./store";
import { walletAtom } from "./wallet";

export function yuanToCents(input: string): number {
	const [whole, frac = ""] = input.trim().split(".");
	return Number(whole || 0) * 100 + Number(frac.padEnd(2, "0").slice(0, 2) || 0);
}

export function centsToYuan(cents: number): string {
	const abs = Math.abs(cents);
	return `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/**
 * 聊天里发 / 收红包、转账时同步到零钱：
 * - 我发出：余额够就从零钱扣并记一条明细；余额不够视为银行卡支付，零钱不变。
 * - 我收到：加到零钱并记一条明细。
 */
export function applyMoneyMove(params: {
	kind: MoneyRecord["kind"];
	direction: MoneyRecord["direction"];
	peerId: string;
	amount: string;
}) {
	const amountCents = yuanToCents(params.amount);
	if (amountCents <= 0) return;
	const wallet = mainStore.get(walletAtom);
	const balance = yuanToCents(wallet.balance);
	if (params.direction === "out" && amountCents > balance) return;
	const next = params.direction === "out" ? balance - amountCents : balance + amountCents;
	const peer = getProfileValueSnapshot(params.peerId);
	mainStore.set(walletAtom, { ...wallet, balance: centsToYuan(next) });
	mainStore.set(balanceRecordsAtom, (prev) => [
		{
			id: nanoid(8),
			kind: params.kind,
			direction: params.direction,
			peerId: params.peerId,
			peerName: peer?.remark || peer?.nickname || "",
			amountCents,
			balanceAfterCents: next,
			timestamp: Date.now(),
		},
		...prev,
	]);
}
