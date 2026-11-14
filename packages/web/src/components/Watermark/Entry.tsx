import { can } from "@/auth/session";
import { watermarkOpenAtom } from "@/stateV2/watermark";
import { Drawer } from "antd";
import { useAtom } from "jotai";
import WatermarkSettings from "./Settings";

/** 水印设置面板。入口是编辑模式顶部浮条里的「水印」按钮（三连击后出现） */
const WatermarkEntry = () => {
	const [open, setOpen] = useAtom(watermarkOpenAtom);
	if (!can("watermark")) return null;
	return (
		<Drawer title="水印设置" placement="left" width="min(380px, 100vw)" open={open} onClose={() => setOpen(false)} mask={false}>
			<WatermarkSettings />
		</Drawer>
	);
};

export default WatermarkEntry;
