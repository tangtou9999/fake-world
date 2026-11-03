import atomWithStorage from "./atomWithStorage";

export type BankCard = {
	id: string;
	bankName: string;
	last4: string;
};

export const DEFAULT_BANK_CARDS: BankCard[] = [
	{ id: "boc-9320", bankName: "中国银行", last4: "9320" },
	{ id: "jsb-4760", bankName: "江苏银行", last4: "4760" },
	{ id: "jsrc-9565", bankName: "江苏农商联合银行", last4: "9565" },
	{ id: "ccb-2207", bankName: "建设银行", last4: "2207" },
	{ id: "cmb-1058", bankName: "招商银行", last4: "1058" },
];

export const bankCardsAtom = atomWithStorage<BankCard[]>("wechat-bank-cards", DEFAULT_BANK_CARDS);

export const selectedBankCardIdAtom = atomWithStorage<string>(
	"wechat-selected-bank-card",
	DEFAULT_BANK_CARDS[0].id,
);
