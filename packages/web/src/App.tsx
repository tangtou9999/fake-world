import { App as AntdApp, ConfigProvider } from "antd";
import { useTranslation } from "react-i18next";

import LeftPanel from "./components/LeftPanel";
import MobilePanel from "./components/MobilePanel";
import RightPanel from "./components/RightPanel";
import Screen from "./components/Screen";
import TopPopover from "./components/TopPopover";
import Tour from "./components/Tour";
import { useCan } from "./auth";
import { ANTD_LANG_MAP } from "./i18n";

const App = () => {
	// 没有「编辑模式」权限的账号看不到电脑端的编辑面板
	const panelsAllowed = useCan("editMode");
	const inShareMode = !!window.__SHARE_KEY__ || !panelsAllowed;
	const { i18n } = useTranslation();

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
			<Tour />
			<AntdApp>
				<MobilePanel />
			</AntdApp>
		</ConfigProvider>
	);
};

export default App;
