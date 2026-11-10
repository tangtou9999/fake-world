import { h } from "@/components/HashAssets";
import { Row, Sheet, inputCls, saveImage } from "@/components/SheetKit";
import { dialogueListAtom } from "@/stateV2/dialogueList";
import { feedListAtom } from "@/stateV2/moments";
import { mainStore } from "@/stateV2/store";
import {
	type IStateProfile,
	friendsTotalCountAtom,
	friendsTotalCountDisplayConfigAtom,
	getAllProfilesValueSnapshot,
	getFriendsTotalCountDisplayConfigValueSnapshot,
	getProfileValueSnapshot,
	setAllProfilesValue,
	setFriendsTotalCountDisplayConfigValue,
} from "@/stateV2/profile";
import { type BalanceRecord, balanceRecordsAtom } from "@/stateV2/balanceRecords";
import { type TTransactionType, USED_ATOM_MAP } from "@/stateV2/transaction";
import { type TStateWallet, walletAtom } from "@/stateV2/wallet";
import { centsToYuan, yuanToCents } from "@/pages/wechat/wallet/money";
import dayjs from "dayjs";
import { nanoid } from "nanoid";
import { patchProfile, patchWallet } from "@/pages/wechat/my/settings/screenOps";
import { useRef, useState } from "react";

const FMT = "YYYY-MM-DDTHH:mm:ss";

/* ───────── 钱包 ───────── */
export const WalletSheet = ({ onClose }: { onClose: () => void }) => {
	const [d, setD] = useState<TStateWallet>(() => ({ ...mainStore.get(walletAtom) }));
	const f = (k: keyof TStateWallet, label: string) => (
		<Row label={label}>
			<input className={inputCls} inputMode="decimal" value={d[k] ?? ""} onChange={(e) => setD({ ...d, [k]: e.target.value })} />
		</Row>
	);
	const fmt = (v?: string) => (v && !Number.isNaN(Number.parseFloat(v)) ? Number.parseFloat(v).toFixed(2) : v);
	return (
		<Sheet
			title="编辑钱包"
			onClose={onClose}
			onSave={() => {
				patchWallet({ ...d, balance: fmt(d.balance) ?? "0.00", miniFund: fmt(d.miniFund) ?? "0.00", business: fmt(d.business) });
				onClose();
			}}
		>
			{f("balance", "零钱余额")}
			{f("business", "经营账户")}
			{f("miniFund", "零钱通余额")}
			{f("miniFundYield", "零钱通收益率%")}
		</Sheet>
	);
};

/* ───────── 零钱明细 ───────── */
export const RecordSheet = ({ id, onClose }: { id?: string; onClose: () => void }) => {
	const rec = id ? mainStore.get(balanceRecordsAtom).find((r) => r.id === id) : undefined;
	const [d, setD] = useState(() => ({
		kind: (rec?.kind ?? "transfer") as BalanceRecord["kind"],
		direction: rec && rec.kind !== "withdraw" ? rec.direction : "out",
		peerName: rec && rec.kind !== "withdraw" ? rec.peerName : "",
		peerId: rec && rec.kind !== "withdraw" ? rec.peerId : "",
		bankName: rec?.kind === "withdraw" ? rec.bankName : "",
		last4: rec?.kind === "withdraw" ? rec.last4 : "",
		amount: centsToYuan(rec?.amountCents ?? 0),
		fee: rec?.kind === "withdraw" ? centsToYuan(rec.feeCents) : "0.00",
		after: centsToYuan(rec?.balanceAfterCents ?? 0),
		at: dayjs(rec?.timestamp ?? Date.now()).format(FMT),
		product: rec && rec.kind === "scanPay" ? rec.product ?? "" : "",
		viaCard: rec && rec.kind === "scanPay" ? !!rec.viaCard : false,
	}));
	const set = (p: Partial<typeof d>) => setD((v) => ({ ...v, ...p }));
	const isWd = d.kind === "withdraw";
	const save = () => {
		const amountCents = yuanToCents(d.amount) ?? 0;
		const balanceAfterCents = yuanToCents(d.after) ?? 0;
		const timestamp = dayjs(d.at).valueOf() || Date.now();
		const next: BalanceRecord = isWd
			? { id: rec?.id ?? nanoid(8), kind: "withdraw", bankName: d.bankName, last4: d.last4, amountCents, feeCents: yuanToCents(d.fee) ?? 0, balanceAfterCents, timestamp, arrivalAt: timestamp + 2 * 3600_000 }
			: {
					...(rec && rec.kind !== "withdraw" ? rec : {}),
					id: rec?.id ?? nanoid(8),
					kind: d.kind as "redPacket" | "transfer" | "scanPay",
					direction: d.direction as "in" | "out",
					peerId: d.peerId,
					peerName: d.peerName,
					amountCents,
					balanceAfterCents,
					timestamp,
					product: d.product || undefined,
					viaCard: d.viaCard || undefined,
				};
		mainStore.set(balanceRecordsAtom, (pv) => (rec ? pv.map((r) => (r.id === rec.id ? next : r)) : [...pv, next]));
		onClose();
	};
	return (
		<Sheet
			title={rec ? "编辑明细" : "新增明细"}
			onClose={onClose}
			onSave={save}
			extra={
				rec && (
					<button
						type="button"
						className="w-full py-2 text-[16px] text-[#FA5151]"
						onClick={() => {
							mainStore.set(balanceRecordsAtom, (pv) => pv.filter((r) => r.id !== rec.id));
							onClose();
						}}
					>
						删除这条明细
					</button>
				)
			}
		>
			<Row label="类型">
				<select className={inputCls} value={d.kind} onChange={(e) => set({ kind: e.target.value as never })}>
					<option value="transfer">转账</option>
					<option value="redPacket">红包</option>
					<option value="scanPay">扫码付款</option>
					<option value="withdraw">提现</option>
				</select>
			</Row>
			{isWd ? (
				<>
					<Row label="银行"><input className={inputCls} value={d.bankName} onChange={(e) => set({ bankName: e.target.value })} /></Row>
					<Row label="卡尾号"><input className={inputCls} value={d.last4} onChange={(e) => set({ last4: e.target.value })} /></Row>
					<Row label="服务费"><input className={inputCls} inputMode="decimal" value={d.fee} onChange={(e) => set({ fee: e.target.value })} /></Row>
				</>
			) : (
				<>
					<Row label="方向">
						<select className={inputCls} value={d.direction} onChange={(e) => set({ direction: e.target.value as never })}>
							<option value="out">支出（发给/转给）</option>
							<option value="in">收入（来自）</option>
						</select>
					</Row>
					<Row label="对方名字"><input className={inputCls} value={d.peerName} onChange={(e) => set({ peerName: e.target.value })} /></Row>
					{d.kind === "scanPay" && (
						<Row label="商品"><input className={inputCls} value={d.product} onChange={(e) => set({ product: e.target.value })} /></Row>
					)}
				</>
			)}
			<Row label="金额"><input className={inputCls} inputMode="decimal" value={d.amount} onChange={(e) => set({ amount: e.target.value })} /></Row>
			<Row label="当时零钱余额"><input className={inputCls} inputMode="decimal" value={d.after} onChange={(e) => set({ after: e.target.value })} /></Row>
			<Row label="时间"><input type="datetime-local" step={1} className={inputCls} value={d.at} onChange={(e) => set({ at: e.target.value })} /></Row>
		</Sheet>
	);
};

/* ───────── 交易详情 ───────── */
const TX_FIELDS: Record<string, [string, string, "text" | "time"][]> = {
	"qr-transfer": [["toUsername", "收款方", "text"]],
	transfer: [["collectionTime", "收款时间", "time"]],
	"red-packet": [["merchantCode", "商户单号", "text"]],
	"credit-card-repayments": [["toCreditCardName", "信用卡", "text"], ["merchantCode", "商户单号", "text"]],
	"pay-reward": [],
};
export const TxSheet = ({ type, onClose }: { type: TTransactionType; onClose: () => void }) => {
	const atom = USED_ATOM_MAP[type] as never;
	const [d, setD] = useState<Record<string, unknown>>(() => ({ ...(mainStore.get(atom) as Record<string, unknown>) }));
	const set = (k: string, v: unknown) => setD((p) => ({ ...p, [k]: v }));
	const extras = TX_FIELDS[type] ?? [];
	return (
		<Sheet
			title="编辑账单"
			onClose={onClose}
			onSave={() => {
				const a = Number.parseFloat(String(d.amount));
				mainStore.set(atom, { ...d, amount: Number.isNaN(a) ? d.amount : a.toFixed(2) } as never);
				onClose();
			}}
		>
			<Row label="金额"><input className={inputCls} inputMode="decimal" value={String(d.amount ?? "")} onChange={(e) => set("amount", e.target.value)} /></Row>
			<Row label="时间"><input type="datetime-local" step={1} className={inputCls} value={dayjs(Number(d.timestamp) || Date.now()).format(FMT)} onChange={(e) => set("timestamp", dayjs(e.target.value).valueOf())} /></Row>
			<Row label="支付方式"><input className={inputCls} value={String(d.payentMethod ?? "")} onChange={(e) => set("payentMethod", e.target.value)} /></Row>
			<Row label="交易单号"><input className={inputCls} value={String(d.code ?? "")} onChange={(e) => set("code", e.target.value)} /></Row>
			{type === "transfer" || type === "red-packet" ? (
				<Row label="对方好友">
					<select className={inputCls} value={String(d.toFriendId ?? "")} onChange={(e) => set("toFriendId", e.target.value)}>
						{getAllProfilesValueSnapshot().map((p) => (
							<option key={p.id} value={p.id}>{p.remark || p.nickname}</option>
						))}
					</select>
				</Row>
			) : null}
			{extras.map(([k, label, kind]) => (
				<Row key={k} label={label}>
					{kind === "time" ? (
						<input type="datetime-local" step={1} className={inputCls} value={dayjs(Number(d[k]) || Date.now()).format(FMT)} onChange={(e) => set(k, dayjs(e.target.value).valueOf())} />
					) : (
						<input className={inputCls} value={String(d[k] ?? "")} onChange={(e) => set(k, e.target.value)} />
					)}
				</Row>
			))}
		</Sheet>
	);
};

/* ───────── 好友总数 ───────── */
export const TotalSheet = ({ onClose }: { onClose: () => void }) => {
	const cfg = getFriendsTotalCountDisplayConfigValueSnapshot();
	const auto = mainStore.get(friendsTotalCountAtom);
	const [t, setT] = useState(cfg.calcuateType);
	const [n, setN] = useState(String(cfg.count ?? auto));
	void friendsTotalCountDisplayConfigAtom;
	return (
		<Sheet
			title="好友总数"
			onClose={onClose}
			onSave={() => {
				setFriendsTotalCountDisplayConfigValue({ calcuateType: t, count: Math.max(0, Number.parseInt(n) || 0) });
				onClose();
			}}
		>
			<Row label="方式">
				<select className={inputCls} value={t} onChange={(e) => setT(e.target.value as never)}>
					<option value="auto">自动（按实际好友数）</option>
					<option value="static">自定义数字</option>
				</select>
			</Row>
			{t === "static" && <Row label="显示人数"><input className={inputCls} inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} /></Row>}
		</Sheet>
	);
};

/* ───────── 好友资料 ───────── */
export const FriendSheet = ({ id, onClose, isMyself }: { id: string; onClose: () => void; isMyself?: boolean }) => {
	const p0 = getProfileValueSnapshot(id) as IStateProfile;
	const [d, setD] = useState(() => ({
		nickname: p0.nickname ?? "",
		remark: p0.remark ?? "",
		wechat: p0.wechat ?? "",
		avatarInfo: p0.avatarInfo,
		gender: p0.gender ?? "",
		hideGender: !!p0.hideGender,
		area: p0.area ?? "",
		signature: p0.signature ?? "",
		description: p0.description ?? "",
		phone: (p0.phone ?? []).join("，"),
		tags: (p0.tags ?? []).join("，"),
		privacy: p0.privacy,
		momentsPrivacy: p0.momentsPrivacy,
		tickleText: p0.tickleText ?? "",
		isStarred: !!p0.isStarred,
		hideThumbnail: !!p0.hideThumbnail,
		coin: p0.coin !== undefined ? String(p0.coin) : "",
		ringtone: p0.ringtone ?? "",
		thumbs: [...(p0.thumbnailInfo ?? [])],
		qr: p0.qrCodeImage ?? "",
	}));
	const thumbRef = useRef<HTMLInputElement>(null);
	const qrRef = useRef<HTMLInputElement>(null);
	const set = (p: Partial<typeof d>) => setD((v) => ({ ...v, ...p }));
	const txt = (k: "nickname" | "remark" | "wechat" | "area" | "signature" | "description" | "phone" | "tags" | "tickleText", label: string, ph?: string) => (
		<Row label={label}><input className={inputCls} placeholder={ph} value={d[k]} onChange={(e) => set({ [k]: e.target.value })} /></Row>
	);
	const split = (s: string) => s.split(/[,，、\s]+/).filter(Boolean);
	const chk = (k: "hideGender" | "isStarred" | "hideThumbnail", label: string) => (
		<Row label={label}><input type="checkbox" className="h-5 w-5 accent-[#07C160]" checked={d[k]} onChange={(e) => set({ [k]: e.target.checked })} /></Row>
	);
	return (
		<Sheet
			title={isMyself ? "编辑我的资料" : "编辑好友资料"}
			onClose={onClose}
			onSave={() => {
				patchProfile(id, {
					nickname: d.nickname,
					remark: d.remark || null,
					wechat: d.wechat,
					avatarInfo: d.avatarInfo,
					gender: (d.gender || null) as "male" | "female" | null,
					hideGender: d.hideGender,
					area: d.area || null,
					signature: d.signature || null,
					description: d.description || null,
					phone: split(d.phone),
					tags: split(d.tags),
					privacy: d.privacy,
					momentsPrivacy: d.momentsPrivacy,
					tickleText: d.tickleText || null,
					isStarred: d.isStarred,
					hideThumbnail: d.hideThumbnail,
					coin: d.coin.trim() === "" ? null : Math.max(0, Math.round(Number(d.coin) || 0)),
					ringtone: d.ringtone || null,
					thumbnailInfo: d.thumbs,
					qrCodeImage: d.qr || null,
				});
				onClose();
			}}
			extra={
				!isMyself && (
					<button
						type="button"
						className="w-full py-2 text-[16px] text-[#FA5151]"
						onClick={() => {
							if (!window.confirm("删除好友会同时删除与该好友的对话和朋友圈，确定？")) return;
							setAllProfilesValue((pv) => pv.filter((v) => v.id !== id));
							mainStore.set(dialogueListAtom, (pv) => pv.filter((v) => v.friendId !== id));
							mainStore.set(feedListAtom, (pv) => pv.filter((v) => v.userId !== id));
							onClose();
							history.back();
						}}
					>
						删除好友
					</button>
				)
			}
		>
			<Row label="头像">
				<label className="flex items-center gap-3">
					<h.img src={d.avatarInfo} className="h-12 w-12 rounded object-cover" />
					<span className="text-[14px] text-[#07C160]">点击更换</span>
					<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) set({ avatarInfo: await saveImage(f) }); }} />
				</label>
			</Row>
			{txt("nickname", "昵称")}
			{txt("remark", "备注")}
			{txt("wechat", "微信号")}
			<Row label="性别">
				<select className={inputCls} value={d.gender} onChange={(e) => set({ gender: e.target.value })}>
					<option value="">未设置</option>
					<option value="male">男</option>
					<option value="female">女</option>
				</select>
			</Row>
			{chk("hideGender", "隐藏性别")}
			{txt("area", "地区")}
			{txt("signature", "个性签名")}
			{txt("description", "描述")}
			{txt("phone", "手机号", "多个用逗号隔开")}
			{txt("tags", "标签", "多个用逗号隔开")}
			{txt("tickleText", "拍一拍文案")}
			{chk("isStarred", "星标朋友")}
			<Row label="朋友权限">
				<select className={inputCls} value={d.privacy} onChange={(e) => set({ privacy: e.target.value as never })}>
					<option value="all">聊天、朋友圈等</option>
					<option value="chatsOnly">仅聊天</option>
					<option value="hideMyPosts">不让他看我</option>
					<option value="hideFriendPosts">不看他</option>
				</select>
			</Row>
			<Row label="朋友圈范围">
				<select className={inputCls} value={d.momentsPrivacy} onChange={(e) => set({ momentsPrivacy: e.target.value as never })}>
					<option value="all">全部</option>
					<option value="lastSixMonths">最近半年</option>
					<option value="lastOneMonth">最近一个月</option>
					<option value="lastThreeDays">最近三天</option>
				</select>
			</Row>
			{chk("hideThumbnail", "隐藏朋友圈缩略图")}
			<Row label="朋友圈缩略图">
				<div className="flex flex-wrap items-center gap-2">
					{d.thumbs.map((src, i) => (
						<button key={`${src}-${i}`} type="button" aria-label="移除这张缩略图" onClick={() => set({ thumbs: d.thumbs.filter((_, j) => j !== i) })}>
							<h.img src={src} className="h-12 w-12 rounded-[4px] object-cover" />
						</button>
					))}
					<button type="button" className="h-12 rounded-[4px] bg-[#F5F5F5] px-2 text-[13px] text-[#576B95]" onClick={() => thumbRef.current?.click()}>
						添加
					</button>
				</div>
				<input
					ref={thumbRef}
					type="file"
					accept="image/*"
					className="hidden"
					onChange={(e) => {
						const f = e.target.files?.[0];
						e.target.value = "";
						if (f) void saveImage(f).then((hash) => set({ thumbs: [...d.thumbs, hash] }));
					}}
				/>
			</Row>
			<Row label="微信豆">
				<input aria-label="微信豆" inputMode="numeric" className={inputCls} value={d.coin} onChange={(e) => set({ coin: e.target.value })} />
			</Row>
			<Row label="来电铃声">
				<input aria-label="来电铃声" className={inputCls} value={d.ringtone} onChange={(e) => set({ ringtone: e.target.value })} />
			</Row>
			{isMyself && (
				<Row label="二维码">
					<button type="button" className="text-[14px] text-[#576B95]" onClick={() => qrRef.current?.click()}>
						{d.qr ? "已选择，点此更换" : "从相册选择"}
					</button>
					<input
						ref={qrRef}
						type="file"
						accept="image/*"
						className="hidden"
						onChange={(e) => {
							const f = e.target.files?.[0];
							e.target.value = "";
							if (f) void saveImage(f).then((hash) => set({ qr: hash }));
						}}
					/>
				</Row>
			)}
		</Sheet>
	);
};
