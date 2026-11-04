import { activatedNodeAtom } from "@/stateV2/detectedNode";
import { getModeValueSnapshot } from "@/stateV2/mode";
import { App as AntdApp, Button, Drawer, Tabs } from "antd";
import { useAtom } from "jotai";
import { memo, useEffect } from "react";
import { isMobileOnly } from "react-device-detect";
import CommonBlock from "../LeftPanel/CommonBlock";
import MainMenu from "../LeftPanel/MainMenu";
import MetaDataEditor from "../MetaDataEditor";
import useMode from "../useMode";
import ChatRecordsEditor from "./ChatRecordsEditor";
import { mobilePanelAtom } from "./atom";

export const APP_VERSION = "v1.2";

const isPreviewNow = () => getModeValueSnapshot() === "preview";

const floatingBtn =
	"rounded-full px-4 py-2 text-sm shadow-lg lg:hidden pointer-events-auto active:opacity-80";

/**
 * 手机端编辑模式：
 * - 「我 → 设置」打开设置页，可管理提现银行卡，或从那里进入编辑模式。
 * - 编辑模式下点页面上的任意内容，底部自动弹出对应的编辑表单（页面上半部分仍可继续点选）。
 * - 右下角「⚙ 工具」打开截图、聊天记录等工具，「完成」退出编辑模式。
 */
const MobilePanel = () => {
	const [panel, setPanel] = useAtom(mobilePanelAtom);
	const [activatedNode, setActivatedNode] = useAtom(activatedNodeAtom);
	const { isEdit, setMode } = useMode();
	const open = panel !== null;

	// 手机上任意页面快速连点三下，进入当前页面的编辑模式
	const { message } = AntdApp.useApp();
	useEffect(() => {
		if (!isMobileOnly) return;
		let taps: { t: number; x: number; y: number }[] = [];
		const onClick = (e: MouseEvent) => {
			const target = e.target as HTMLElement | null;
			if (!isPreviewNow() || target?.closest("input,textarea,[contenteditable=true],.ant-drawer")) {
				taps = [];
				return;
			}
			const now = Date.now();
			taps = [...taps, { t: now, x: e.clientX, y: e.clientY }].filter(
				(p) => now - p.t < 700 && Math.hypot(p.x - e.clientX, p.y - e.clientY) < 60,
			);
			if (taps.length >= 3) {
				taps = [];
				e.preventDefault();
				e.stopPropagation();
				setMode("edit");
				message.info("已进入编辑模式：点页面上任意内容就能修改", 2.5);
			}
		};
		document.addEventListener("click", onClick, true);
		return () => document.removeEventListener("click", onClick, true);
	}, []);

	// 点选了内容就弹出编辑表单
	useEffect(() => {
		if (isEdit && activatedNode) setPanel("edit");
	}, [isEdit, activatedNode]);

	// 退出编辑模式时收起面板
	useEffect(() => {
		if (!isEdit && panel === "edit") setPanel(null);
	}, [isEdit]);

	const finish = () => {
		setPanel(null);
		setActivatedNode(null);
		setMode("preview");
	};

	return (
		<>
			{isEdit && !open && (
				<div className="pointer-events-none fixed right-3 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[900] flex flex-col items-end gap-2">
					<button
						type="button"
						onClick={() => setPanel("tools")}
						className={`${floatingBtn} bg-[#07C160] text-white`}
					>
						⚙ 工具
					</button>
					<button
						type="button"
						onClick={finish}
						className={`${floatingBtn} bg-white text-black/80`}
					>
						完成
					</button>
				</div>
			)}
			<Drawer
				title={`编辑模式 ${APP_VERSION}`}
				placement="bottom"
				height="52%"
				mask={false}
				open={open}
				onClose={() => {
					setPanel(null);
					setActivatedNode(null);
				}}
				extra={
					<Button size="small" onClick={finish}>
						完成
					</Button>
				}
				destroyOnClose
			>
				<AntdApp>
					<Tabs
						activeKey={panel ?? "edit"}
						onChange={(key) => setPanel(key as "tools" | "edit")}
						items={[
							{
								key: "edit",
								label: "编辑内容",
								children: (
									<>
										<div className="mb-3 text-gray-500 text-xs">
											点页面上的任意内容就能直接修改，这个面板不会挡住上半部分，可以接着点别的。某一条对话里的消息（文字、图片、视频、转账、红包）在「工具
											→ 聊天记录」里编辑。改完点右上角「完成」。
										</div>
										<MetaDataEditor />
									</>
								),
							},
							{
								key: "tools",
								label: "工具",
								children: (
									<>
										<ChatRecordsEditor />
										<CommonBlock />
										<MainMenu />
									</>
								),
							},
						]}
					/>
				</AntdApp>
			</Drawer>
		</>
	);
};

export default memo(MobilePanel);
