import { Global, css } from "@emotion/react";
import { type CSSProperties, memo, useEffect } from "react";
import { isDesktop, isMobileOnly } from "react-device-detect";
import { ErrorBoundary } from "react-error-boundary";
import { Outlet } from "react-router-dom";

import { refreshMoments } from "@/stateV2/moments/autoRoll";
import Fallback from "../Fallback";
import DetectedOverall from "../NodeDetected/DetectedFloating";
import StatusBar from "../StatusBar";
import useDeviceConfig from "../useDeviceConfig";

const Screen = () => {
	const { screenSize } = useDeviceConfig();

	useEffect(() => {
		refreshMoments();
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
				height: "calc(100vh - 1px)",
				paddingTop: "max(0px, calc(env(safe-area-inset-top) - 5px))",
				backgroundColor: "var(--screen-top-bg, #EDEDED)",
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
			{isDesktop && <StatusBar />}
			<ErrorBoundary FallbackComponent={Fallback}>
				<Outlet />
			</ErrorBoundary>
		</div>
	);
};

export default memo(Screen);
