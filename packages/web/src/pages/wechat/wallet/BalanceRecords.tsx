import { h } from "@/components/HashAssets";
import useModeNavigate from "@/components/useModeNavigate";
import useScreenTopBg from "@/components/useScreenTopBg";
import { type BalanceRecord, balanceRecordsAtom } from "@/stateV2/balanceRecords";
import { getProfileValueSnapshot } from "@/stateV2/profile";
import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { centsToYuan } from "./money";

type Row = {
	key: string;
	title: string;
	timestamp: number;
	deltaCents: number;
	balanceCents: number;
	icon: ReactNode;
};

const Circle = ({ bg, children }: { bg: string; children: ReactNode }) => (
	<span
		className="flex h-[43px] w-[43px] shrink-0 items-center justify-center rounded-full"
		style={{ background: bg }}
	>
		{children}
	</span>
);

const FeeIcon = () => (
	<Circle bg="#50C747">
		<svg width="26" height="22" viewBox="0 0 26 22" aria-hidden="true">
			<path
				d="M13 1C6.4 1 1.5 5 1.5 10c0 2.7 1.4 5 3.7 6.600L4.5 20l3.8-1.900c1.5.5 3 .8 4.7.8 6.6 0 11.5-4 11.5-9S19.6 1 13 1Z"
				fill="#fff"
			/>
			<path
				d="M8 10.200l3.6 3.300L18.5 7"
				fill="none"
				stroke="#50C747"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	</Circle>
);

const CoinIcon = () => (
	<Circle bg="#FFC800">
		<span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#FBDF66] font-bold text-[#FFC800] text-[18px] leading-none">
			¥
		</span>
	</Circle>
);

const RedPacketIcon = () => (
	<Circle bg="#DD5E4D">
		<svg width="22" height="24" viewBox="0 0 22 24" aria-hidden="true">
			<path d="M3 1.500h16a2 2 0 0 1 2 2V8c-3.2 2.2-6 3.2-10 3.200S4.2 10.2 1 8V3.500a2 2 0 0 1 2-2Z" fill="#fff" />
			<path d="M1 10.600c3.2 2.2 6 3.2 10 3.200s6.8-1 10-3.200V20.500a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2Z" fill="#fff" />
			<circle cx="11" cy="10.8" r="2" fill="#DD5E4D" />
		</svg>
	</Circle>
);

const PeerIcon = ({ peerId }: { peerId: string }) => {
	const avatar = getProfileValueSnapshot(peerId)?.avatarInfo;
	return (
		<span className="h-[43px] w-[43px] shrink-0 overflow-hidden rounded-full bg-[#E5E5E5]">
			{avatar && <h.img src={avatar} className="h-full w-full object-cover" />}
		</span>
	);
};

function toRows(records: BalanceRecord[]): Row[] {
	const rows: Row[] = [];
	for (const record of records) {
		if (record.kind === "withdraw") {
			const total = record.amountCents + record.feeCents;
			rows.push({
				key: `${record.id}-fee`,
				title: "提现服务费",
				timestamp: record.timestamp,
				deltaCents: -record.feeCents,
				balanceCents: record.balanceAfterCents,
				icon: <FeeIcon />,
			});
			rows.push({
				key: `${record.id}-wd`,
				title: `零钱提现-到${record.bankName}（${record.last4}）`,
				timestamp: record.timestamp,
				deltaCents: -record.amountCents,
				balanceCents: record.balanceAfterCents + record.feeCents,
				icon: <CoinIcon />,
			});
			void total;
		} else {
			const out = record.direction === "out";
			rows.push({
				key: record.id,
				title:
					record.kind === "redPacket"
						? out
							? `微信红包-发给${record.peerName}`
							: `微信红包-来自${record.peerName}`
						: out
							? `转账-转给${record.peerName}`
							: `转账-来自${record.peerName}`,
				timestamp: record.timestamp,
				deltaCents: out ? -record.amountCents : record.amountCents,
				balanceCents: record.balanceAfterCents,
				icon: record.kind === "redPacket" ? <RedPacketIcon /> : <PeerIcon peerId={record.peerId} />,
			});
		}
	}
	return rows;
}

const pad = (n: number) => String(n).padStart(2, "0");

const Chevron = () => (
	<svg width="14" height="8" viewBox="0 0 14 8" fill="none" className="ml-2" aria-hidden="true">
		<path d="M1 1l6 6 6-6" stroke="#111" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

const BalanceRecords = () => {
	const navigate = useModeNavigate();
	const records = useAtomValue(balanceRecordsAtom);
	useScreenTopBg("#EDEDED");

	const rows = toRows(records).sort((a, b) => b.timestamp - a.timestamp);
	const groups: { month: string; rows: Row[] }[] = [];
	for (const row of rows) {
		const d = new Date(row.timestamp);
		const month = `${d.getFullYear()}年${d.getMonth() + 1}月`;
		const last = groups[groups.length - 1];
		if (last?.month === month) last.rows.push(row);
		else groups.push({ month, rows: [row] });
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-white">
			<div className="relative flex h-11 shrink-0 items-center justify-center bg-[#EDEDED] px-4">
				<button
					type="button"
					aria-label="关闭"
					className="absolute left-5 flex h-8 w-8 items-center text-black/80"
					onClick={() => navigate("/wechat/wallet/balance")}
				>
					<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
						<path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
					</svg>
				</button>
				<div className="font-medium text-[17.5px]">零钱明细</div>
			</div>
			<div className="min-h-0 flex-1 overflow-auto">
				{groups.length === 0 ? (
					<div className="pt-24 text-center text-[15px] text-black/30">暂无零钱明细</div>
				) : (
					groups.map((group) => (
						<div key={group.month}>
							<div className="flex h-[55px] items-center bg-[#F7F7F7] px-[22px] text-[17px] text-black/90">
								{group.month}
								<Chevron />
							</div>
							{group.rows.map((row) => {
								const d = new Date(row.timestamp);
								const income = row.deltaCents > 0;
								return (
									<div
										key={row.key}
										className="flex h-[77px] items-center border-black/10 border-b px-[22px]"
									>
										{row.icon}
										<div className="ml-[18px] min-w-0 flex-1">
											<div className="truncate text-[17px] text-black/90 leading-6">{row.title}</div>
											<div className="mt-[3px] text-[15px] text-black/40 leading-5">
												{d.getMonth() + 1}月{d.getDate()}日 {pad(d.getHours())}:{pad(d.getMinutes())}
											</div>
										</div>
										<div className="ml-3 shrink-0 text-right">
											<div
												className={`font-semibold text-[20px] leading-6 ${income ? "text-[#FFB400]" : "text-black/90"}`}
											>
												{income ? "+" : "−"}
												{centsToYuan(Math.abs(row.deltaCents))}
											</div>
											<div className="mt-[3px] text-[15px] text-black/40 leading-5">
												零钱余额 {centsToYuan(row.balanceCents)}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					))
				)}
			</div>
		</div>
	);
};

export default BalanceRecords;
