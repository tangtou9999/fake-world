import { App as AntdApp, Drawer, Tabs } from "antd";
import { useAtom } from "jotai";
import { memo } from "react";
import CommonBlock from "../LeftPanel/CommonBlock";
import MainMenu from "../LeftPanel/MainMenu";
import MetaDataEditor from "../MetaDataEditor";
import useMode from "../useMode";
import ChatRecordsEditor from "./ChatRecordsEditor";
import { mobilePanelAtom } from "./atom";

export const APP_VERSION = "v1.0";

/**
 * 手机端面板：把电脑端左侧（工具）和右侧（编辑器）搬进一个底部抽屉。
 * - 预览模式：在「我 → 设置」里打开，画面干净，方便截图。
 * - 编辑模式：右下角出现「⚙ 面板」按钮，点选内容后点它进入「编辑内容」。
 */
const MobilePanel = () => {
	const [panel, setPanel] = useAtom(mobilePanelAtom);
	const { isEdit } = useMode();
	const open = panel !== null;

	return (
		<>
			{isEdit && !open && (
				<button
					type="button"
					onClick={() => setPanel("edit")}
					className="fixed right-3 bottom-24 z-[900] rounded-full bg-[#07C160] px-4 py-2 text-sm text-white shadow-lg lg:hidden"
				>
					⚙ 面板
				</button>
			)}
			<Drawer
				title={`手机面板 ${APP_VERSION}`}
				placement="bottom"
				height="75%"
				open={open}
				onClose={() => setPanel(null)}
				destroyOnClose
			>
				<AntdApp>
					<Tabs
						activeKey={panel ?? "tools"}
						onChange={(key) => setPanel(key as "tools" | "edit")}
						items={[
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
							{
								key: "edit",
								label: "编辑内容",
								children: (
									<>
										<div className="mb-3 text-gray-500 text-xs">
											先在「工具」里打开编辑模式，关闭面板后在页面上点选要修改的内容，再点右下角「⚙
											面板」回到这里。某一条对话的消息在「工具 →
											聊天记录」里编辑，包括图片、视频以及由谁发送。对话窗口的「+」不再打开编辑器。
										</div>
										<MetaDataEditor />
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
