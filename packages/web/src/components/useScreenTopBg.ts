import { useLayoutEffect } from "react";

/**
 * 手机全屏（添加到主屏幕）时，状态栏区域会露出 #screen 的背景。
 * 页面顶部不是灰色（比如「我」页面是白色）时，用它把状态栏区域改成同色。
 */
export default function useScreenTopBg(color: string) {
	useLayoutEffect(() => {
		const el = document.getElementById("screen");
		el?.style.setProperty("--screen-top-bg", color);
		return () => {
			el?.style.removeProperty("--screen-top-bg");
		};
	}, [color]);
}
