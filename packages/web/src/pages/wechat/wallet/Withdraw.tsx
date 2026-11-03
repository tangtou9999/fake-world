import useModeNavigate from "@/components/useModeNavigate";
import useScreenTopBg from "@/components/useScreenTopBg";
import { balanceRecordsAtom } from "@/stateV2/balanceRecords";
import { bankCardsAtom, selectedBankCardIdAtom } from "@/stateV2/bankCards";
import { walletAtom } from "@/stateV2/wallet";
import { Chevron } from "@/wechatComponents/List";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { nanoid } from "nanoid";
import { useRef, useState } from "react";
import BankLogo from "./BankLogo";
import { appendAmountKey, centsToYuan, feeCentsOf, maxWithdrawCents, yuanToCents } from "./money";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

function CloseIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
			<path
				d="M3 3l12 12M15 3L3 15"
				stroke="currentColor"
				strokeWidth="1.7"
				strokeLinecap="round"
			/>
		</svg>
	);
}

function MoreIcon() {
	return (
		<svg width="22" height="6" viewBox="0 0 22 6" aria-hidden="true">
			<circle cx="3" cy="3" r="1.6" />
			<circle cx="11" cy="3" r="1.6" />
			<circle cx="19" cy="3" r="1.6" />
		</svg>
	);
}

function BackspaceIcon() {
	return (
		<svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true">
			<path
				d="M8 1.5h14.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8L1.8 9 8 1.5z"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.4"
				strokeLinejoin="round"
			/>
			<path d="M12 6l6 6M18 6l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
		</svg>
	);
}

function CheckIcon() {
	return (
		<svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
			<path
				d="M1.5 7.2L6.2 12 16.5 1.5"
				fill="none"
				stroke="#07C160"
				strokeWidth="1.8"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

const keyClass =
	"flex items-center justify-center rounded-[5px] bg-white text-[24px] text-black/90 active:bg-[#E4E4E4]";

const Withdraw = () => {
	const navigate = useModeNavigate();
	const cards = useAtomValue(bankCardsAtom);
	const [selectedId, setSelectedId] = useAtom(selectedBankCardIdAtom);
	const wallet = useAtomValue(walletAtom);
	const setWallet = useSetAtom(walletAtom);
	const setRecords = useSetAtom(balanceRecordsAtom);
	const [amount, setAmount] = useState("");
	const [sheet, setSheet] = useState<null | "bank" | "pin" | "coupon">(null);
	const [moreOpen, setMoreOpen] = useState(false);
	const [pin, setPin] = useState("");
	const submitting = useRef(false);
	const pinTimer = useRef<number>();
	useScreenTopBg("#EDEDED");

	const card = cards.find((item) => item.id === selectedId) ?? cards[0];
	const balanceCents = yuanToCents(wallet.balance) ?? 0;
	const amountCents = yuanToCents(amount);
	const feeCents = amountCents ? feeCentsOf(amountCents) : 0;
	const canSubmit = !!card && !!amountCents && amountCents + feeCents <= balanceCents;

	const closePin = () => {
		window.clearTimeout(pinTimer.current);
		setPin("");
		setSheet(null);
	};

	const finish = (digits: string) => {
		if (submitting.current || digits.length !== 6) return;
		const cents = yuanToCents(amount);
		const current = cards.find((item) => item.id === selectedId) ?? cards[0];
		const balance = yuanToCents(wallet.balance) ?? 0;
		if (!current || !cents) return;
		const fee = feeCentsOf(cents);
		if (cents + fee > balance) return;
		submitting.current = true;
		const id = nanoid(8);
		const now = Date.now();
		setWallet((prev) => ({ ...prev, balance: centsToYuan(balance - cents - fee) }));
		setRecords((prev) => [
			{
				id,
				kind: "withdraw",
				bankName: current.bankName,
				last4: current.last4,
				amountCents: cents,
				feeCents: fee,
				balanceAfterCents: balance - cents - fee,
				timestamp: now,
				arrivalAt: now + 3 * 60 * 60 * 1000,
			},
			...prev,
		]);
		navigate(`/wechat/wallet/balance/withdraw/result/${id}`, { replace: true });
	};

	const pressPin = (key: string) => {
		if (key === "del") {
			window.clearTimeout(pinTimer.current);
			setPin((prev) => prev.slice(0, -1));
			return;
		}
		setPin((prev) => {
			if (prev.length >= 6) return prev;
			const next = prev + key;
			if (next.length === 6) {
				window.clearTimeout(pinTimer.current);
				pinTimer.current = window.setTimeout(() => finish(next), 140);
			}
			return next;
		});
	};

	return (
		<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#EDEDED]">
			<style>{"@keyframes withdraw-caret{0%,45%{opacity:1}55%,100%{opacity:0}}"}</style>
			<div className="grid h-11 shrink-0 grid-cols-3 items-center px-4">
				<button
					type="button"
					aria-label="关闭"
					className="flex h-8 w-8 items-center text-black/80"
					onClick={() => navigate("/wechat/wallet/balance")}
				>
					<CloseIcon />
				</button>
				<div className="text-center font-medium text-[17px]">零钱提现</div>
				<div className="relative flex justify-end">
					<button
						type="button"
						aria-label="更多"
						className="flex h-8 w-8 items-center justify-end fill-black/80"
						onClick={() => setMoreOpen((open) => !open)}
					>
						<MoreIcon />
					</button>
					{moreOpen && (
						<button
							type="button"
							className="absolute top-9 right-0 z-10 whitespace-nowrap rounded-[6px] bg-white px-4 py-2.5 text-[15px] text-black/90 shadow-lg"
							onClick={() => setMoreOpen(false)}
						>
							常见问题
						</button>
					)}
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-auto">
				<button
					type="button"
					className="flex w-full items-center px-4 py-3 text-left"
					onClick={() => {
						setMoreOpen(false);
						setSheet("bank");
					}}
				>
					<div className="w-[92px] shrink-0 text-[16px] text-black/90">到账银行卡</div>
					<div className="flex min-w-0 flex-1 items-center">
						{card ? (
							<>
								<BankLogo name={card.bankName} />
								<div className="ml-2 min-w-0">
									<div className="truncate text-[16px] text-black/90 leading-5">
										{card.bankName}（{card.last4}）
									</div>
									<div className="mt-0.5 text-[12px] text-black/30 leading-4">2小时内到账</div>
								</div>
							</>
						) : (
							<div className="text-[16px] text-black/30">请添加银行卡</div>
						)}
					</div>
					<Chevron />
				</button>

				<div className="mx-2 rounded-[8px] bg-white px-4 pt-4 pb-1">
					<div className="text-[15px] text-black/90">提现金额</div>
					<div className="mt-4 flex items-center" data-testid="withdraw-amount">
						<span className="mr-1 font-medium text-[32px] leading-none">¥</span>
						<span
							className={`font-medium leading-none ${amount.length >= 8 ? "text-[32px]" : "text-[44px]"}`}
						>
							{amount}
						</span>
						<i
							className="ml-[2px] h-9 w-[2px] rounded-full bg-[#07C160]"
							style={{ animation: "withdraw-caret 1.05s steps(1) infinite" }}
						/>
					</div>
					<div className="mt-3 h-px bg-black/10" />
					<div className="py-3 text-[14px] text-black/40 leading-5">
						当前零钱余额{centsToYuan(balanceCents)}元，
						<button
							type="button"
							className="text-wechatLink-3"
							onClick={() => setAmount(centsToYuan(maxWithdrawCents(balanceCents)))}
						>
							全部提现
						</button>
					</div>
					<div className="h-px bg-black/10" />
					<button
						type="button"
						className="flex w-full items-center py-3 text-left"
						onClick={() => setSheet("coupon")}
					>
						<span className="rounded-[3px] bg-[#07C160] px-1 py-px text-[11px] text-white leading-4">
							提现券
						</span>
						<span className="ml-2 min-w-0 flex-1">
							<span className="block text-[15px] text-black/90 leading-5">提现服务费减免</span>
							<span className="mt-0.5 block text-[12px] text-black/30 leading-4">
								领取100提现免费额度
							</span>
						</span>
						<Chevron />
					</button>
				</div>
			</div>

			<div
				className="grid shrink-0 gap-[6px] bg-[#EDEDED] p-[6px]"
				style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr", gridTemplateRows: "repeat(4, 52px)" }}
			>
				{KEYS.map((key, index) => (
					<button
						key={key}
						type="button"
						data-key={key}
						className={keyClass}
						style={{ gridColumn: (index % 3) + 1, gridRow: Math.floor(index / 3) + 1 }}
						onClick={() => setAmount((prev) => appendAmountKey(prev, key))}
					>
						{key}
					</button>
				))}
				<button
					type="button"
					data-key="0"
					className={keyClass}
					style={{ gridColumn: "1 / span 2", gridRow: 4 }}
					onClick={() => setAmount((prev) => appendAmountKey(prev, "0"))}
				>
					0
				</button>
				<button
					type="button"
					data-key="."
					className={keyClass}
					style={{ gridColumn: 3, gridRow: 4 }}
					onClick={() => setAmount((prev) => appendAmountKey(prev, "."))}
				>
					.
				</button>
				<button
					type="button"
					data-key="del"
					aria-label="删除"
					className={keyClass}
					style={{ gridColumn: 4, gridRow: 4 }}
					onClick={() => setAmount((prev) => appendAmountKey(prev, "del"))}
				>
					<BackspaceIcon />
				</button>
				<button
					type="button"
					data-key="ok"
					aria-disabled={!canSubmit}
					className={`flex items-center justify-center rounded-[5px] font-medium text-[18px] text-white ${canSubmit ? "bg-[#07C160] active:opacity-80" : "bg-[#A6D9B8]"}`}
					style={{ gridColumn: 4, gridRow: "1 / span 3" }}
					onClick={() => {
						if (!canSubmit) return;
						setPin("");
						setSheet("pin");
					}}
				>
					确定
				</button>
			</div>

			{sheet === "bank" && (
				<div
					className="absolute inset-0 z-30 flex flex-col justify-end bg-black/50"
					role="dialog"
					aria-label="选择到账银行卡"
				>
					<button
						type="button"
						aria-label="关闭选择"
						className="min-h-0 flex-1"
						onClick={() => setSheet(null)}
					/>
					<div className="max-h-[78%] rounded-t-[12px] bg-white pb-4">
						<div className="grid grid-cols-[40px_1fr_40px] items-center px-3 pt-3">
							<button
								type="button"
								aria-label="关闭"
								className="flex h-8 w-8 items-center text-black/70"
								onClick={() => setSheet(null)}
							>
								<CloseIcon />
							</button>
							<div className="text-center">
								<div className="font-medium text-[17px]">选择到账银行卡</div>
								<div className="mt-1 text-[12px] text-black/30">请留意各银行到账时间</div>
							</div>
							<div />
						</div>
						<div className="mt-2 overflow-auto">
							{cards.map((item) => {
								const selected = item.id === (card?.id ?? "");
								return (
									<button
										key={item.id}
										type="button"
										className="flex w-full items-center px-4 py-3 text-left"
										onClick={() => {
											setSelectedId(item.id);
											setSheet(null);
										}}
									>
										<BankLogo name={item.bankName} size={32} />
										<div className="ml-3 min-w-0 flex-1">
											<div className="text-[16px] text-black/90 leading-5">
												{item.bankName} 储蓄卡（{item.last4}）
											</div>
											<div className="mt-0.5 text-[12px] text-black/30 leading-4">2小时内到账</div>
										</div>
										{selected && <CheckIcon />}
									</button>
								);
							})}
							<button
								type="button"
								className="flex w-full items-center justify-between px-4 py-4 text-left text-[16px] text-black/90"
								onClick={() => navigate("/wechat/my/settings/card/new")}
							>
								<span>添加银行卡提现</span>
								<Chevron />
							</button>
						</div>
					</div>
				</div>
			)}

			{sheet === "coupon" && (
				<div
					className="absolute inset-0 z-30 flex flex-col justify-end bg-black/50"
					role="dialog"
					aria-label="提现券"
				>
					<button
						type="button"
						className="min-h-0 flex-1"
						aria-label="关闭提现券"
						onClick={() => setSheet(null)}
					/>
					<div className="rounded-t-[12px] bg-white px-4 pt-3 pb-8">
						<div className="grid grid-cols-[40px_1fr_40px] items-center">
							<button
								type="button"
								aria-label="关闭"
								className="flex h-8 w-8 items-center text-black/70"
								onClick={() => setSheet(null)}
							>
								<CloseIcon />
							</button>
							<div className="text-center font-medium text-[17px]">提现券</div>
							<div />
						</div>
						<div className="mt-5 flex items-center rounded-[8px] bg-[#F7F7F7] px-3 py-3">
							<span className="rounded-[3px] bg-[#07C160] px-1 py-px text-[11px] text-white">
								提现券
							</span>
							<span className="ml-2">
								<span className="block text-[15px]">提现服务费减免</span>
								<span className="mt-0.5 block text-[12px] text-black/30">领取100提现免费额度</span>
							</span>
						</div>
					</div>
				</div>
			)}

			{sheet === "pin" && amountCents && (
				<div
					className="absolute inset-0 z-30 flex flex-col justify-end bg-black/50"
					role="dialog"
					aria-label="提现"
				>
					<button
						type="button"
						className="min-h-0 flex-1"
						aria-label="关闭密码"
						onClick={closePin}
					/>
					<div className="rounded-t-[12px] bg-white">
						<div className="grid grid-cols-[40px_1fr_40px] items-center px-3 pt-3">
							<button
								type="button"
								aria-label="关闭"
								className="flex h-8 w-8 items-center text-black/70"
								onClick={closePin}
							>
								<CloseIcon />
							</button>
							<div className="text-center font-medium text-[17px]">提现</div>
							<div />
						</div>
						<div className="mt-5 text-center font-medium text-[40px] leading-none">
							¥ {centsToYuan(amountCents)}
						</div>
						<div className="mx-6 mt-5 h-px bg-black/10" />
						<div className="flex items-center justify-between px-6 pt-3 text-[15px] text-black/90">
							<span>服务费</span>
							<span>¥{centsToYuan(feeCents)}</span>
						</div>
						<div className="px-6 pt-1.5 pb-4 text-[13px] text-black/40">费率 0.10%(最低¥0.01)</div>
						<div className="flex justify-center gap-2 px-6 pb-4" data-testid="pin-boxes">
							{Array.from({ length: 6 }, (_, index) => (
								<div
									key={index}
									className="flex h-11 w-11 items-center justify-center rounded-[4px] bg-[#EDEDED]"
								>
									{pin.length > index && <i className="h-2.5 w-2.5 rounded-full bg-black" />}
								</div>
							))}
						</div>
						<div
							className="grid grid-cols-3 gap-[6px] bg-[#EDEDED] p-[6px]"
							style={{ gridTemplateRows: "repeat(4, 52px)" }}
						>
							{KEYS.map((key) => (
								<button
									key={key}
									type="button"
									data-pin={key}
									className={keyClass}
									onClick={() => pressPin(key)}
								>
									{key}
								</button>
							))}
							<div />
							<button type="button" data-pin="0" className={keyClass} onClick={() => pressPin("0")}>
								0
							</button>
							<button
								type="button"
								data-pin="del"
								aria-label="删除"
								className={keyClass}
								onClick={() => pressPin("del")}
							>
								<BackspaceIcon />
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default Withdraw;
