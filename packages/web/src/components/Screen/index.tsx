import { can } from "@/auth/session";
import { useCompactPhone } from "../ScreenSheets";
import { Global, css } from "@emotion/react";
import { type CSSProperties, memo, useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { isDesktop, isMobileOnly } from "react-device-detect";
import { ErrorBoundary } from "react-error-boundary";
import { Outlet, useLocation } from "react-router-dom";

import { refreshMoments } from "@/stateV2/moments/autoRoll";
import Fallback from "../Fallback";
import DetectedOverall from "../NodeDetected/DetectedFloating";
import { getModeValueSnapshot, modeAtom } from "@/stateV2/mode";
import { mainStore } from "@/stateV2/store";
import { showToast } from "@/wechatComponents/Toast";
import StatusBar from "../StatusBar";
import useDeviceConfig from "../useDeviceConfig";

const isChatPath = (path: string) => /^\/wechat\/conversation\/[^/]+$/.test(path);

const Screen = () => {
	const { screenSize } = useDeviceConfig();
	const mode = useAtomValue(modeAtom);
	const compact = useCompactPhone();
	const { pathname } = useLocation();
	const lockChat = isMobileOnly && isChatPath(pathname);
	const [frame, setFrame] = useState<{ height: number; offsetTop: number } | null>(null);

	// iPhone Safari 弹键盘时页面会被顶上去。把聊天容器钉在 visualViewport 里，标题栏留在顶部。
	useEffect(() => {
		if (!lockChat) {
			setFrame(null);
			return;
		}
		const vv = window.visualViewport;
		if (!vv) return;
		let seen = false;
		let lastH = 0;
		const apply = () => {
			const height = vv.height;
			setFrame({ height, offsetTop: vv.offsetTop });
			if (seen && height !== lastH) {
				requestAnimationFrame(() => {
					const list = document.getElementById("conversation-list");
					if (list) list.scrollTop = 9999999;
				});
			}
			seen = true;
			lastH = height;
		};
		const html = document.documentElement;
		const body = document.body;
		const prevHtml = html.style.overflow;
		const prevBody = body.style.overflow;
		html.style.overflow = "hidden";
		body.style.overflow = "hidden";
		apply();
		vv.addEventListener("resize", apply);
		vv.addEventListener("scroll", apply);
		return () => {
			vv.removeEventListener("resize", apply);
			vv.removeEventListener("scroll", apply);
			html.style.overflow = prevHtml;
			body.style.overflow = prevBody;
		};
	}, [lockChat]);

	useEffect(() => {
		refreshMoments();
	}, []);

	// 连点屏幕 3 下：进入 / 退出编辑模式（平时页面不出现任何编辑入口）
	useEffect(() => {
		let taps: { t: number; x: number; y: number }[] = [];
		let swallow = 0;
		const onUp = (e: PointerEvent) => {
			const now = Date.now();
			taps = taps.filter((k) => now - k.t < 650 && Math.hypot(k.x - e.clientX, k.y - e.clientY) < 40);
			taps.push({ t: now, x: e.clientX, y: e.clientY });
			if (taps.length >= 3 && can("editMode")) {
				taps = [];
				swallow = now;
				const next = getModeValueSnapshot() === "edit" ? "preview" : "edit";
				mainStore.set(modeAtom, next);
				showToast({ content: next === "edit" ? "已进入编辑模式" : "已退出编辑模式" });
			}
		};
		const onClick = (e: MouseEvent) => {
			if (swallow && Date.now() - swallow < 400) {
				e.stopPropagation();
				e.preventDefault();
				swallow = 0;
			}
		};
		document.addEventListener("pointerup", onUp, true);
		document.addEventListener("click", onClick, true);
		return () => {
			document.removeEventListener("pointerup", onUp, true);
			document.removeEventListener("click", onClick, true);
		};
	}, []);

	// 手机上把整页钉住：左右滑动不再带着页面晃
	useEffect(() => {
		if (!isMobileOnly) return;
		document.documentElement.classList.add("wx-mobile");
		return () => document.documentElement.classList.remove("wx-mobile");
	}, []);

	const style: CSSProperties = isMobileOnly
		? {
				width: "100vw",
				height: lockChat && frame ? `${frame.height}px` : "calc(100vh - 1px)",
				paddingTop: "max(0px, calc(env(safe-area-inset-top) - 5px))",
				backgroundColor: "var(--screen-top-bg, #EDEDED)",
				...(lockChat && frame
					? {
							position: "fixed" as const,
							left: 0,
							top: 0,
							transform: `translateY(${frame.offsetTop}px)`,
							zIndex: 2,
						}
					: {}),
			}
		: {
				width: screenSize.width,
				height: screenSize.height,
			};

	return (
		<div style={style} className="relative flex flex-col overflow-hidden" id="screen">
			<Global
				styles={css`
          &::-webkit-scrollbar {
            display: none;
          }
        `}
			/>
			<DetectedOverall />
			{(isDesktop || (compact && mode === "edit")) && <StatusBar />}
			<ErrorBoundary FallbackComponent={Fallback}>
				<Outlet />
			</ErrorBoundary>
		</div>
	);
};

export default memo(Screen);
