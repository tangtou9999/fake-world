import AppleWatchOutlinedSVG from "@/assets/apple-watch-outlined.svg?react";
import MultipleDeviceSVG from "@/assets/display-mobile-outlined.svg?react";
import DisplayOutlinedSVG from "@/assets/display-outlined.svg?react";
import IMacOutlinedSVG from "@/assets/imac-outlined.svg?react";
import PadOutlined from "@/assets/pad-outlined.svg?react";
import { canBeDetected } from "@/components/NodeDetected";
import { DeviceSheet, PhoneEditHit, useCompactPhone } from "@/components/ScreenSheets";
import useMode from "@/components/useMode";
import { EMetaDataType } from "@/stateV2/detectedNode";
import { type ALL_LOGIN_DEVICES, multipleDeviceLoginAtom } from "@/stateV2/multipleDeviceLogin";
import { useAtomValue } from "jotai";
import { type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";
import { twJoin } from "tailwind-merge";

const MultipleDeviceLogin = () => {
	const { visible, devices } = useAtomValue(multipleDeviceLoginAtom);
	const { t } = useTranslation();
	const { isEdit } = useMode();
	const compact = useCompactPhone();
	const [open, setOpen] = useState(false);

	const show = visible && devices.length > 0;
	const phoneEdit = compact && isEdit;

	const DEVICE_RENDER_CONFIG: Record<
		(typeof ALL_LOGIN_DEVICES)[number],
		{
			icon: ReactElement;
			text: string;
		}
	> = {
		iPad: {
			icon: <PadOutlined fill="rgba(0, 0, 0, 0.7)" width={20} height={20} />,
			text: t("wechatPage.main.iPadLogin"),
		},
		Mac: {
			icon: <IMacOutlinedSVG fill="rgba(0, 0, 0, 0.7)" width={20} height={20} />,
			text: t("wechatPage.main.macLogin"),
		},
		Windows: {
			icon: <DisplayOutlinedSVG fill="rgba(0, 0, 0, 0.7)" width={20} height={20} />,
			text: t("wechatPage.main.windowsLogin"),
		},
		Desktop: {
			icon: <DisplayOutlinedSVG fill="rgba(0, 0, 0, 0.7)" width={20} height={20} />,
			text: t("wechatPage.main.desktopLogin"),
		},
		Watch: {
			icon: <AppleWatchOutlinedSVG fill="rgba(0, 0, 0, 0.7)" width={20} height={20} />,
			text: t("wechatPage.main.watchLogin"),
		},
	};

	const renderDevice = () => {
		if (!show) return null;
		const { icon, text } = DEVICE_RENDER_CONFIG[devices[0]];
		return (
			<>
				{icon}
				<span className="ml-5 text-black/60">{text}</span>
			</>
		);
	};

	return (
		<canBeDetected.div
			className={twJoin(
				"relative flex h-11 items-center border-black/10 border-b bg-[#EDEDED] px-4 text-[14px]",
				show || phoneEdit ? "visible" : "hidden",
				!show && phoneEdit && "opacity-60",
			)}
			metaData={{
				type: EMetaDataType.MultipleDeviceLogin,
				treeItemDisplayName: (d) => `多设备登录显示，目前${d.devices.length}个设备`,
			}}
		>
			{devices.length > 1 ? (
				<>
					<MultipleDeviceSVG fill="rgba(0, 0, 0, 0.7)" width={20} height={20} />
					<span className="ml-5 text-black/60">
						{t("wechatPage.main.multipleLogin", {
							number: devices.length,
						})}
					</span>
				</>
			) : show ? (
				renderDevice()
			) : (
				<span className="text-black/45">多设备登录未显示，点此编辑</span>
			)}
			{phoneEdit && <PhoneEditHit label="编辑多设备登录" onOpen={() => setOpen(true)} />}
			{open && <DeviceSheet onClose={() => setOpen(false)} />}
		</canBeDetected.div>
	);
};

export default MultipleDeviceLogin;
