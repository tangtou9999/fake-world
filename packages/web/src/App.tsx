import { App as AntdApp, ConfigProvider, Drawer, FloatButton } from "antd";
import { SettingOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { activatedNodeAtom } from "./stateV2/detectedNode";
import { useTranslation } from "react-i18next";

import LeftPanel from "./components/LeftPanel";
import RightPanel from "./components/RightPanel";
import MetaDataEditor from "./components/MetaDataEditor";
import useMode from "./components/useMode";
import Screen from "./components/Screen";
import TopPopover from "./components/TopPopover";
import Tour from "./components/Tour";
import { ANTD_LANG_MAP } from "./i18n";

const App = () => {
	const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
	const { isEdit, setMode } = useMode();
	const activatedNode = useAtomValue(activatedNodeAtom);
	const setActivatedNode = useSetAtom(activatedNodeAtom);
	const inShareMode = !!window.__SHARE_KEY__;
	const { i18n } = useTranslation();

	useEffect(() => {
		if (isEdit && activatedNode) setMobileEditorOpen(true);
	}, [activatedNode, isEdit]);

	const toggleMobileEdit = () => {
		if (isEdit) {
			setMode("preview");
			setActivatedNode(null);
			setMobileEditorOpen(false);
			return;
		}
		setActivatedNode(null);
		setMode("edit");
		setMobileEditorOpen(false);
	};

	return (
		<ConfigProvider locale={ANTD_LANG_MAP[i18n.language as keyof typeof ANTD_LANG_MAP]}>
			<div className="grid min-h-screen grid-cols-3 max-lg:grid-cols-1">
				{!inShareMode && (
					<AntdApp className="max-lg:hidden">
						<LeftPanel />
					</AntdApp>
				)}
				<div
					className="flex items-center justify-center overflow-auto border-orange-400 border-r border-l border-dashed max-lg:border-none"
					id="center"
				>
					<div className="border">
						<TopPopover>
							<Screen />
						</TopPopover>
					</div>
				</div>
				{!inShareMode && <RightPanel />}
			</div>
			{!inShareMode && (
				<>
					<FloatButton
						icon={<SettingOutlined />}
						type="primary"
						tooltip="编辑设置"
						className="!bottom-6 !right-4 lg:!hidden"
						onClick={() => setMobileEditorOpen(true)}
					/>
					<Drawer
						title={
							<div className="flex items-center justify-between gap-3 pr-6">
								<span>WeChat 编辑设置</span>
								<button type="button" className="rounded-md bg-green-600 px-3 py-1 text-sm font-medium text-white" onClick={toggleMobileEdit}>
									{isEdit ? "退出编辑模式" : "开始编辑"}
								</button>
							</div>
						}
						placement="bottom"
						open={mobileEditorOpen}
						onClose={() => { if (isEdit) setActivatedNode(null); setMobileEditorOpen(false); }}
						height="78vh"
						styles={{ body: { overflowY: "auto", paddingBottom: "calc(20px + env(safe-area-inset-bottom))" } }}
						className="mobile-editor-drawer"
					>
						<div className="mobile-editor-content">
							<div className="mb-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm leading-6 text-gray-700">
								<div className="mb-1 font-semibold text-green-800">手机编辑操作</div>
								{isEdit ? "编辑模式已开启。点选手机页面中带有编辑数据的区域，系统会自动打开此面板。" : "点击“开始编辑”后即可点选手机页面中的可编辑区域；再次点击按钮可退出编辑模式。"}
								<div className="mt-3 flex flex-wrap gap-2">
									<button type="button" className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white" onClick={() => { setActivatedNode(null); setMobileEditorOpen(false); }}>关闭面板，去点选页面</button>
									{isEdit && <button type="button" className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" onClick={toggleMobileEdit}>退出编辑模式</button>}
								</div>
							</div>
							<MetaDataEditor />
						</div>
					</Drawer>
				</>
			)}
			<Tour />
		</ConfigProvider>
	);
};

export default App;
