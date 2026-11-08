import useMode from "@/components/useMode";
import BackFilledSVG from "@/assets/back-filled.svg?react";
import { h } from "@/components/HashAssets";
import useScreenTopBg from "@/components/useScreenTopBg";
import {
	EConversationType,
	type TConversationItem,
	fromLastGenerateUpperText,
	setConversationListValue,
} from "@/stateV2/conversation";
import { profileAtom } from "@/stateV2/profile";
import { currentSenderId, isGroupId } from "@/stateV2/group";
import { applyMoneyMove } from "@/stateV2/walletFlow";
import { Chevron } from "@/wechatComponents/List";
import dayjs from "dayjs";
import { useAtomValue } from "jotai";
import { nanoid } from "nanoid";
import { type ReactNode, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { touchDialogue } from "@/stateV2/fileHelper";

type Kind = "redPacket" | "transfer";
type Sender = "mine" | "friend";

const validAmount = (v: string) => /^\d{1,7}(\.\d{1,2})?$/.test(v) && Number(v) > 0;

function useSend(kind: Kind) {
	const { id = "" } = useParams<{ id: string }>();
	const navigate = useNavigate();
	return (params: { sender: Sender; amount: string; note: string; done: boolean }) => {
		const amount = Number(params.amount).toFixed(2);
		const base = {
			id: nanoid(8),
			role: params.sender,
			originalSender: params.sender,
			amount,
			note: params.note || undefined,
			sendTimestamp: dayjs().valueOf(),
			...(params.sender === "friend" && isGroupId(id) ? { senderId: currentSenderId(id) } : {}),
		} as const;
		setConversationListValue(id, (prev) => {
			const upperText = fromLastGenerateUpperText(prev);
			const item =
				kind === "redPacket"
					? {
							...base,
							type: EConversationType.redPacket,
							redPacketStatus: params.done ? "accepted" : "awaiting",
							upperText,
						}
					: {
							...base,
							type: EConversationType.transfer,
							transferStatus: params.done ? "accepted" : "awaiting",
							upperText,
						};
			return [...prev, item as TConversationItem];
		});
		// 同步到零钱：我发出 → 扣；对方发的且已领取 → 加
		if (params.sender === "mine") {
			applyMoneyMove({ kind, direction: "out", peerId: id, amount });
		} else if (params.done) {
			applyMoneyMove({ kind, direction: "in", peerId: id, amount });
		}
		touchDialogue(id, kind === "redPacket" ? "[微信红包]" : "[转账]");
		navigate(`/wechat/conversation/${id}`, { replace: true });
	};
}

const Seg = ({
	value,
	options,
	onChange,
}: {
	value: string;
	options: { label: string; value: string }[];
	onChange: (v: string) => void;
}) => (
	<div className="flex rounded-[6px] bg-black/5 p-[2px]">
		{options.map((o) => (
			<button
				key={o.value}
				type="button"
				className={`rounded-[5px] px-3 py-[5px] text-[14px] ${value === o.value ? "bg-white text-black/90 shadow-sm" : "bg-transparent text-black/50"}`}
				onClick={() => onChange(o.value)}
			>
				{o.label}
			</button>
		))}
	</div>
);

/** 模拟设置：谁发的 + 状态（真微信里没有，这是 fake world 的控制项） */
const FakeControls = ({
	sender,
	setSender,
	done,
	setDone,
	kind,
}: {
	sender: Sender;
	setSender: (v: Sender) => void;
	done: boolean;
	setDone: (v: boolean) => void;
	kind: Kind;
}) => (
	<div className="mt-3 flex flex-wrap items-center justify-between gap-y-2 text-[13px] text-black/40">
		<Seg
			value={sender}
			onChange={(v) => setSender(v as Sender)}
			options={[
				{ label: "我发的", value: "mine" },
				{ label: "对方发的", value: "friend" },
			]}
		/>
		<Seg
			value={done ? "done" : "wait"}
			onChange={(v) => setDone(v === "done")}
			options={[
				{ label: kind === "redPacket" ? "待领取" : "待收款", value: "wait" },
				{ label: kind === "redPacket" ? "已领取" : "已收款", value: "done" },
			]}
		/>
	</div>
);

const Nav = ({ title, right }: { title?: string; right?: ReactNode }) => {
	const { id = "" } = useParams<{ id: string }>();
	const navigate = useNavigate();
	return (
		<div className="grid h-11 shrink-0 grid-cols-3 items-center bg-[#EDEDED] px-4">
			<BackFilledSVG
				fill="black"
				className="-ml-0.5 h-6 w-6 cursor-pointer"
				onClick={() => navigate(`/wechat/conversation/${id}`, { replace: true })}
			/>
			<div className="text-center font-medium text-[17.5px]">{title}</div>
			<div className="flex justify-end">{right}</div>
		</div>
	);
};

export const RedPacketSend = () => {
	useScreenTopBg("#EDEDED");
	const send = useSend("redPacket");
	const [amount, setAmount] = useState("");
	const [note, setNote] = useState("");
	const { isEdit } = useMode();
	const [sender, setSender] = useState<Sender>("mine");
	const [done, setDone] = useState(false);
	const ok = validAmount(amount);

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-[#EDEDED]">
			<Nav
				title="发红包"
				right={
					<svg width="18" height="5" viewBox="0 0 22 6" aria-hidden="true">
						<circle cx="3" cy="3" r="2.2" />
						<circle cx="11" cy="3" r="2.2" />
						<circle cx="19" cy="3" r="2.2" />
					</svg>
				}
			/>
			<div className="min-h-0 flex-1 overflow-auto px-[15px] pt-[10px]">
				<div className="flex h-[54px] items-center rounded-[6px] bg-white px-[15px]">
					<span className="text-[17px] text-black/90">金额</span>
					<span className="ml-auto flex items-center text-[17px] text-black/30">
						¥
						<input
							inputMode="decimal"
							placeholder="0.00"
							value={amount}
							onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
							className="w-[110px] bg-transparent text-right text-black/90 outline-none placeholder:text-black/25"
						/>
					</span>
				</div>
				<div className="mt-[12px] flex h-[62px] items-center rounded-[6px] bg-white px-[15px]">
					<input
						placeholder="恭喜发财，大吉大利"
						value={note}
						onChange={(e) => setNote(e.target.value)}
						className="min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-black/25"
					/>
					<svg width="26" height="26" viewBox="0 0 26 26" fill="none" className="ml-2" aria-hidden="true">
						<circle cx="12" cy="13" r="9" stroke="#777" strokeWidth="1.6" />
						<path d="M7.5 14.5c1 2.800 3 4 4.500 4s3.500-1.200 4.500-4z" stroke="#777" strokeWidth="1.5" strokeLinejoin="round" />
						<circle cx="9" cy="10.500" r="1.100" fill="#777" />
						<circle cx="15" cy="10.500" r="1.100" fill="#777" />
						<path d="M21 17v7M17.500 20.500h7" stroke="#777" strokeWidth="1.5" strokeLinecap="round" />
					</svg>
				</div>
				<div className="mt-[12px] flex h-[62px] items-center rounded-[6px] bg-white px-[15px] text-[17px]">
					红包封面
					<span className="ml-auto">
						<Chevron />
					</span>
				</div>
				<div className="mt-[62px] flex items-start justify-center text-black/90">
					<span className="mt-[9px] mr-[8px] font-bold text-[34px] leading-none">¥</span>
					<span className="font-semibold text-[56px] leading-[64px]">
						{amount ? Number(amount || 0).toFixed(2).replace(/^NaN$/, "0.00") : "0.00"}
					</span>
				</div>
				<button
					type="button"
					disabled={!ok}
					className={`mx-auto mt-[22px] flex h-[46px] w-[178px] items-center justify-center rounded-[6px] text-[17px] text-white ${ok ? "bg-[#FF6146]" : "bg-[#FF6146]/70"}`}
					onClick={() => ok && send({ sender: isEdit ? sender : "mine", amount, note: note.trim() || "恭喜发财，大吉大利", done: isEdit && done })}
				>
					塞钱进红包
				</button>
				{isEdit && <FakeControls sender={sender} setSender={setSender} done={done} setDone={setDone} kind="redPacket" />}
			</div>
			<div className="pb-[calc(24px+env(safe-area-inset-bottom))] text-center text-[15px] text-black/40">
				未领取的红包，将于24小时后发起退款
			</div>
		</div>
	);
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
const keyCls =
	"flex items-center justify-center rounded-[5px] bg-white text-[24px] text-black/90 active:bg-[#E4E4E4]";

export const TransferSend = () => {
	useScreenTopBg("#EDEDED");
	const { id = "" } = useParams<{ id: string }>();
	const profile = useAtomValue(profileAtom(id));
	const send = useSend("transfer");
	const [amount, setAmount] = useState("");
	const [note, setNote] = useState("");
	const [editNote, setEditNote] = useState(false);
	const { isEdit } = useMode();
	const [sender, setSender] = useState<Sender>("mine");
	const [done, setDone] = useState(false);
	const ok = validAmount(amount);
	const name = profile?.remark || profile?.nickname || "";
	const mask = profile?.nickname ? `(*${profile.nickname.slice(-1)})` : "";

	const press = (key: string) =>
		setAmount((cur) => {
			if (key === "del") return cur.slice(0, -1);
			if (key === ".") return cur.includes(".") ? cur : `${cur || "0"}.`;
			if (cur === "0") return key;
			const next = cur + key;
			const [w, f] = next.split(".");
			if (w.length > 7 || (f && f.length > 2)) return cur;
			return next;
		});

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-[#EDEDED]">
			<Nav />
			<div className="flex shrink-0 items-start px-[31px] pt-[14px] pb-[22px]">
				<div className="min-w-0 flex-1">
					<div className="truncate font-medium text-[17px] text-black/90 leading-6">
						转账给 {name} {mask}
					</div>
					<div className="mt-[3px] text-[16px] text-black/40 leading-5">
						微信号： {profile?.wechat}
					</div>
				</div>
				<span className="h-[42px] w-[42px] shrink-0 overflow-hidden rounded-[5px] bg-[#ddd]">
					{profile?.avatarInfo && <h.img src={profile.avatarInfo} className="h-full w-full object-cover" />}
				</span>
			</div>
			<div className="min-h-0 flex-1 overflow-auto rounded-t-[17px] bg-white px-[31px] pt-[26px]">
				<div className="text-[15px] text-black/90">转账金额</div>
				<div className="mt-[13px] flex h-[60px] items-center border-black/10 border-b">
					<span className="mr-[10px] font-semibold text-[34px] leading-none">¥</span>
					<span className="font-semibold text-[44px] leading-none">{amount}</span>
					<i
						className="ml-[2px] h-[52px] w-[2px] rounded-full bg-[#07C160]/60"
						style={{ animation: "tr-caret 1.05s steps(1) infinite" }}
					/>
				</div>
				<style>{"@keyframes tr-caret{0%,45%{opacity:1}55%,100%{opacity:0}}"}</style>
				<div className="mt-[22px] text-[15px] text-[#576B95]">
					{editNote ? (
						<input
							autoFocus
							value={note}
							maxLength={20}
							placeholder="添加转账说明"
							onChange={(e) => setNote(e.target.value)}
							onBlur={() => setEditNote(false)}
							className="w-full bg-transparent text-black/90 outline-none"
						/>
					) : (
						<button type="button" className="bg-transparent p-0 text-[#576B95]" onClick={() => setEditNote(true)}>
							{note || "添加转账说明"}
						</button>
					)}
				</div>
				{isEdit && <FakeControls sender={sender} setSender={setSender} done={done} setDone={setDone} kind="transfer" />}
			</div>
			<div
				className="grid shrink-0 gap-[6px] bg-[#F7F7F7] p-[6px] pb-[calc(6px+env(safe-area-inset-bottom))]"
				style={{ gridTemplateColumns: "repeat(4,1fr)", gridTemplateRows: "repeat(4,52px)" }}
			>
				{KEYS.map((k, i) => (
					<button
						key={k}
						type="button"
						className={keyCls}
						style={{ gridColumn: (i % 3) + 1, gridRow: Math.floor(i / 3) + 1 }}
						onClick={() => press(k)}
					>
						{k}
					</button>
				))}
				<button type="button" className={keyCls} style={{ gridColumn: "1 / span 2", gridRow: 4 }} onClick={() => press("0")}>
					0
				</button>
				<button type="button" className={keyCls} style={{ gridColumn: 3, gridRow: 4 }} onClick={() => press(".")}>
					.
				</button>
				<button type="button" aria-label="删除" className={keyCls} style={{ gridColumn: 4, gridRow: 1 }} onClick={() => press("del")}>
					<svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true">
						<path d="M8 1.500h14.500a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8L1.800 9 8 1.500z" fill="#111" />
						<path d="M12 6l6 6M18 6l-6 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
					</svg>
				</button>
				<button
					type="button"
					className={`flex items-center justify-center rounded-[5px] text-[18px] text-white ${ok ? "bg-[#07C160]" : "bg-[#07C160]/60"}`}
					style={{ gridColumn: 4, gridRow: "2 / span 3" }}
					onClick={() => ok && send({ sender: isEdit ? sender : "mine", amount, note: note.trim(), done: isEdit && done })}
				>
					转账
				</button>
			</div>
		</div>
	);
};
