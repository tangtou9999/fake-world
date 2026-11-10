import { h } from "@/components/HashAssets";
import { Row, Sheet, inputCls, saveImage } from "@/components/SheetKit";
import { EBottomNavBars, bottomNavbarsAtom } from "@/stateV2/bottomNavbars";
import { ALL_LOGIN_DEVICES, getMultipleDeviceLoginValueSnapshot } from "@/stateV2/multipleDeviceLogin";
import { getProfileValueSnapshot } from "@/stateV2/profile";
import { statusBarConfigAtom } from "@/stateV2/statusBar";
import { mainStore } from "@/stateV2/store";
import type { AiChatMessage } from "@/stateV2/aiChat";
import { applyScreenOps, markPhoneSheet, patchDevices, patchNavBadge, patchProfile, patchStatusBar, previewScreenOp } from "@/pages/wechat/my/settings/screenOps";
import type { ScreenOp } from "@/pages/wechat/my/settings/screenOps";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isMobileOnly } from "react-device-detect";

/** 真机，或浏览器窗口已经窄到只剩手机屏幕。宽屏电脑上的下拉编辑不受影响。 */
export const useCompactPhone = () => {
	const [on, setOn] = useState(() => isMobileOnly || window.innerWidth <= 520);
	useEffect(() => {
		const sync = () => setOn(isMobileOnly || window.innerWidth <= 520);
		sync();
		window.addEventListener("resize", sync);
		return () => window.removeEventListener("resize", sync);
	}, []);
	return on;
};

const choice = (label: string, value: string, current: string, onPick: (v: string) => void) => (
	<button type="button" key={value} onClick={() => onPick(value)} className={`mr-2 mb-2 rounded-full px-3 py-1 text-[14px] ${current === value ? "bg-[#07C160] text-white" : "bg-[#F5F5F5]"}`}>
		{label}
	</button>
);

export const StatusBarSheet = ({ onClose }: { onClose: () => void }) => {
	const c0 = mainStore.get(statusBarConfigAtom);
	const [hide, setHide] = useState(c0.hide);
	const [signal, setSignal] = useState(c0.signalIconType);
	const [network, setNetwork] = useState(c0.networkIconType);
	const [battery, setBattery] = useState(c0.batteryIconType);
	return createPortal(
		<Sheet
			title="状态栏"
			onClose={onClose}
			onSave={() => {
				patchStatusBar({ hide, signalIconType: signal, networkIconType: network, batteryIconType: battery });
				onClose();
			}}
		>
			<Row label="隐藏">
				<input aria-label="隐藏状态栏" type="checkbox" className="h-5 w-5 accent-[#07C160]" checked={hide} onChange={(e) => setHide(e.target.checked)} />
			</Row>
			<Row label="信号">
				<div>{choice("单卡", "single", signal, (v) => setSignal(v as never))}{choice("双卡", "double", signal, (v) => setSignal(v as never))}{choice("无", "none", signal, (v) => setSignal(v as never))}</div>
			</Row>
			<Row label="网络">
				<div>{choice("Wi-Fi", "wifi", network, (v) => setNetwork(v as never))}{choice("5G", "5G", network, (v) => setNetwork(v as never))}</div>
			</Row>
			<Row label="电池">
				<div>
					{choice("默认", "normal", battery, (v) => setBattery(v as never))}
					{choice("充电中", "charging", battery, (v) => setBattery(v as never))}
					{choice("低电量", "low", battery, (v) => setBattery(v as never))}
					{choice("省电", "saving", battery, (v) => setBattery(v as never))}
				</div>
			</Row>
		</Sheet>,
		document.body,
	);
};

export const CoverSheet = ({ id, onClose }: { id: string; onClose: () => void }) => {
	const p = getProfileValueSnapshot(id);
	const [img, setImg] = useState(p?.momentsBackgroundInfo ?? "");
	const [like, setLike] = useState(!!p?.momentsBackgroundLike);
	const fileRef = useRef<HTMLInputElement>(null);
	return createPortal(
		<Sheet
			title="朋友圈封面"
			onClose={onClose}
			onSave={() => {
				patchProfile(id, { ...(img ? { momentsBackgroundInfo: img } : {}), momentsBackgroundLike: like });
				onClose();
			}}
		>
			<Row label="封面">
				<button type="button" aria-label="选择封面" className="block w-full" onClick={() => fileRef.current?.click()}>
					{img ? <h.img src={img} className="h-28 w-full rounded-[8px] object-cover" /> : <span className="text-[14px] text-[#576B95]">从相册选择</span>}
				</button>
				<input
					ref={fileRef}
					type="file"
					accept="image/*"
					className="hidden"
					onChange={(e) => {
						const f = e.target.files?.[0];
						e.target.value = "";
						if (f) void saveImage(f).then(setImg);
					}}
				/>
			</Row>
			<Row label="封面赞">
				<input aria-label="点赞封面" type="checkbox" className="h-5 w-5 accent-[#07C160]" checked={like} onChange={(e) => setLike(e.target.checked)} />
			</Row>
		</Sheet>,
		document.body,
	);
};

export const DeviceSheet = ({ onClose }: { onClose: () => void }) => {
	const c0 = getMultipleDeviceLoginValueSnapshot();
	const [visible, setVisible] = useState(c0.visible);
	const [devices, setDevices] = useState<string[]>([...c0.devices]);
	const toggle = (d: string) => setDevices((v) => (v.includes(d) ? v.filter((x) => x !== d) : [...v, d]));
	return createPortal(
		<Sheet
			title="多设备登录"
			onClose={onClose}
			onSave={() => {
				patchDevices({ visible, devices: devices.filter((d): d is (typeof ALL_LOGIN_DEVICES)[number] => (ALL_LOGIN_DEVICES as readonly string[]).includes(d)) });
				onClose();
			}}
		>
			<Row label="显示">
				<input aria-label="显示多设备登录" type="checkbox" className="h-5 w-5 accent-[#07C160]" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
			</Row>
			<Row label="设备">
				<div>
					{ALL_LOGIN_DEVICES.map((d) => (
						<button key={d} type="button" onClick={() => toggle(d)} className={`mr-2 mb-2 rounded-full px-3 py-1 text-[14px] ${devices.includes(d) ? "bg-[#07C160] text-white" : "bg-[#F5F5F5]"}`}>
							{d}
						</button>
					))}
				</div>
			</Row>
		</Sheet>,
		document.body,
	);
};

const TAB_LABEL: Record<EBottomNavBars, string> = {
	[EBottomNavBars.WECHAT]: "微信",
	[EBottomNavBars.ADDRESS_BOOK]: "通讯录",
	[EBottomNavBars.DISCOVER]: "发现",
	[EBottomNavBars.MY]: "我",
};

export const NavBadgeSheet = ({ tab, onClose }: { tab: EBottomNavBars; onClose: () => void }) => {
	const c0 = mainStore.get(bottomNavbarsAtom)[tab];
	const [count, setCount] = useState(String(c0.badgeNumber ?? 0));
	const [hide, setHide] = useState(!!c0.badgeHide);
	const [kind, setKind] = useState<"number" | "dot">(c0.badgeType === "dot" ? "dot" : "number");
	return createPortal(
		<Sheet
			title={`${TAB_LABEL[tab]}角标`}
			onClose={onClose}
			onSave={() => {
				patchNavBadge(tab, { badgeNumber: Math.max(0, Math.round(Number(count) || 0)), badgeHide: hide, badgeType: kind });
				onClose();
			}}
		>
			<Row label="数字">
				<input aria-label="角标数字" inputMode="numeric" className={inputCls} value={count} onChange={(e) => setCount(e.target.value)} />
			</Row>
			<Row label="样式">
				<div>{choice("数字", "number", kind, (v) => setKind(v as never))}{choice("红点", "dot", kind, (v) => setKind(v as never))}</div>
			</Row>
			<Row label="隐藏">
				<input aria-label="隐藏角标" type="checkbox" className="h-5 w-5 accent-[#07C160]" checked={hide} onChange={(e) => setHide(e.target.checked)} />
			</Row>
		</Sheet>,
		document.body,
	);
};

/** 编辑模式下盖在真实控件上，点一下打开手机弹层，不走桌面抽屉 */
export const PhoneEditHit = ({ label, onOpen }: { label: string; onOpen: () => void }) => (
	<button
		type="button"
		aria-label={label}
		className="absolute inset-0 z-20"
		onClick={(e) => {
			e.stopPropagation();
			e.preventDefault();
			markPhoneSheet();
			onOpen();
		}}
	/>
);

export const ScreenEditCard = ({
	screen,
	conversationId,
	onApplied,
}: {
	screen: NonNullable<AiChatMessage["screen"]>;
	conversationId?: string;
	onApplied: (text: string) => void;
}) => (
	<div className="mt-2 w-[88%] rounded-[8px] bg-white p-3">
		<div className="font-medium text-[14px]">变更预览</div>
		<div className="mt-2 space-y-1 rounded-[6px] bg-[#F5F5F5] p-2 text-[13px] leading-5">
			{(screen.lines ?? screen.ops.map((op: ScreenOp) => previewScreenOp(op, { currentId: conversationId }))).map((line, i) => (
				<div key={i}>{line}</div>
			))}
		</div>
		{screen.applied ? (
			<div className="mt-2 text-[13px] text-[#07C160]">✓ {screen.applied}</div>
		) : (
			<button
				type="button"
				className="mt-2 h-10 w-full rounded-[6px] bg-[#07C160] text-[15px] text-white"
				onClick={() => onApplied(applyScreenOps(screen.ops, { currentId: conversationId }).text)}
			>
				确认执行
			</button>
		)}
	</div>
);
