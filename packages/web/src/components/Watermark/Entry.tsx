import { can } from "@/auth/session";
import { Drawer } from "antd";
import { useState } from "react";
import WatermarkSettings from "./Settings";

/** 桌面左上角的小入口：有「水印设置」权限的账号才看得到 */
const WatermarkEntry = () => {
	const [open, setOpen] = useState(false);
	if (!can("watermark")) return null;
	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="fixed top-0 left-0 z-[2147483200] rounded-br-md bg-black/45 px-[6px] py-[1px] text-[11px] text-white"
			>
				水印
			</button>
			<Drawer title="水印设置" placement="left" width="min(380px, 100vw)" open={open} onClose={() => setOpen(false)} mask={false}>
				<WatermarkSettings />
			</Drawer>
		</>
	);
};

export default WatermarkEntry;
