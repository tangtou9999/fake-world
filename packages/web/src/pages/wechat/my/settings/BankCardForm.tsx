import BackFilledSVG from "@/assets/back-filled.svg?react";
import useModeNavigate from "@/components/useModeNavigate";
import useScreenTopBg from "@/components/useScreenTopBg";
import { type BankCard, bankCardsAtom, selectedBankCardIdAtom } from "@/stateV2/bankCards";
import { useAtom } from "jotai";
import { nanoid } from "nanoid";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const BankCardForm = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useModeNavigate();
	const [cards, setCards] = useAtom(bankCardsAtom);
	const [selectedId, setSelectedId] = useAtom(selectedBankCardIdAtom);
	const creating = id === "new";
	const current = cards.find((card) => card.id === id);
	const [bankName, setBankName] = useState(current?.bankName ?? "");
	const [last4, setLast4] = useState(current?.last4 ?? "");
	const [confirmDelete, setConfirmDelete] = useState(false);
	useScreenTopBg("#EDEDED");

	useEffect(() => {
		if (creating) {
			setBankName("");
			setLast4("");
		} else {
			const found = cards.find((card) => card.id === id);
			setBankName(found?.bankName ?? "");
			setLast4(found?.last4 ?? "");
		}
		setConfirmDelete(false);
	}, [id]);

	const name = bankName.trim();
	const canSave = name.length > 0 && /^\d{4}$/.test(last4);

	const save = () => {
		if (!canSave) return;
		if (creating) {
			const next: BankCard = { id: nanoid(8), bankName: name, last4 };
			setCards((prev) => [...prev, next]);
			setSelectedId(next.id);
		} else if (current) {
			setCards((prev) =>
				prev.map((card) => (card.id === current.id ? { ...card, bankName: name, last4 } : card)),
			);
		}
		navigate(-1);
	};

	const remove = () => {
		if (!current) return;
		if (!confirmDelete) {
			setConfirmDelete(true);
			return;
		}
		setCards((prev) => prev.filter((card) => card.id !== current.id));
		if (selectedId === current.id) {
			setSelectedId(cards.find((card) => card.id !== current.id)?.id ?? "");
		}
		navigate(-1);
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-[#EDEDED]">
			<div className="grid h-11 shrink-0 grid-cols-3 items-center px-4">
				<BackFilledSVG
					fill="black"
					className="-ml-0.5 h-6 w-6 cursor-pointer"
					onClick={() => navigate(-1)}
				/>
				<div className="text-center font-medium text-[17px]">
					{creating ? "添加银行卡" : "编辑银行卡"}
				</div>
			</div>
			{!creating && !current ? (
				<div className="pt-24 text-center text-[15px] text-black/40">银行卡不存在</div>
			) : (
				<div className="px-4 pt-4">
					<label className="block text-[13px] text-black/40">
						银行名称
						<input
							value={bankName}
							maxLength={20}
							onChange={(event) => setBankName(event.target.value)}
							placeholder="如 中国银行"
							className="mt-1 h-11 w-full rounded-[8px] bg-white px-3 text-[16px] text-black/90 outline-none"
						/>
					</label>
					<label className="mt-4 block text-[13px] text-black/40">
						卡号后四位
						<input
							value={last4}
							inputMode="numeric"
							maxLength={4}
							onChange={(event) => setLast4(event.target.value.replace(/\D/g, "").slice(0, 4))}
							placeholder="如 9320"
							className="mt-1 h-11 w-full rounded-[8px] bg-white px-3 text-[16px] text-black/90 outline-none"
						/>
					</label>
					<button
						type="button"
						disabled={!canSave}
						onClick={save}
						className="mt-6 h-11 w-full rounded-[8px] bg-[#07C160] text-[17px] text-white disabled:bg-[#A6D9B8]"
					>
						保存
					</button>
					{!creating && (
						<button
							type="button"
							onClick={remove}
							className="mt-4 w-full text-center text-[#FA5151] text-[16px]"
						>
							{confirmDelete ? "确认删除" : "删除该银行卡"}
						</button>
					)}
				</div>
			)}
		</div>
	);
};

export default BankCardForm;
