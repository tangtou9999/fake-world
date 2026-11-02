import { MOBILE_LIST, SCREEN_SIZE, deviceAtom } from "@/stateV2/device";
import { useSize } from "ahooks";
import { useAtomValue } from "jotai";

export default function useDeviceConfig() {
	const device = useAtomValue(deviceAtom);
	const size = useSize(() => document.querySelector("#center"));
	let screenSize: {
		width: number;
		height: number;
	};
	if (device === MOBILE_LIST.AUTO) {
		const calculatedWidth = size ? size.width - 30 : 0;
		const calculatedHeight = size ? size.height - 140 : 0;
		screenSize = {
			width: calculatedWidth > 430 ? 430 : calculatedWidth,
			height: calculatedHeight > 932 ? 932 : calculatedHeight,
		};
	} else {
		screenSize = SCREEN_SIZE[device];
	}

	// Preserve the selected phone's CSS-pixel viewport. Scale only the desktop
	// preview wrapper so newer and older devices fit the available center panel.
	const previewScale = size
		? Math.min(1, Math.max(0, size.width - 32) / screenSize.width, Math.max(0, size.height - 32) / screenSize.height)
		: 1;

	return {
		screenSize,
		device,
		previewScale: Number.isFinite(previewScale) ? Math.max(0.1, previewScale) : 1,
	};
}
