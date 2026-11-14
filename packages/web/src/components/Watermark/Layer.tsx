import { can, readSession } from "@/auth/session";
import { type Watermark, WM_DEFAULT, watermarkAtom, withDefaults } from "@/stateV2/watermark";
import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const LAYER_ID = "wm-layer";
const isChatPath = (path: string) => /^\/wechat\/conversation\/[^/]+$/.test(path);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const measure = (text: string, size: number, bold: boolean) => {
	const g = document.createElement("canvas").getContext("2d");
	if (!g) return text.length * size;
	g.font = `${bold ? 700 : 400} ${size}px -apple-system, "PingFang SC", sans-serif`;
	return g.measureText(text).width;
};

export const buildSvg = (w: Watermark, label: string) => {
	const tw = Math.max(20, measure(label, w.size, w.bold));
	const W = tw + w.gapX;
	const H = w.size * 1.25 + w.gapY;
	const stroke = Math.max(1, w.size / 22);
	const paint =
		w.style === "solid"
			? `fill="${w.color}" fill-opacity="${w.opacity}"`
			: w.style === "hollow"
				? `fill="none" stroke="${w.color}" stroke-opacity="${w.opacity}" stroke-width="${stroke}"`
				: `fill="${w.color}" fill-opacity="${w.opacity * 0.35}" stroke="${w.color}" stroke-opacity="${w.opacity}" stroke-width="${stroke}"`;
	const t = (x: number, y: number) =>
		`<text x="${x}" y="${y}" ${paint} font-size="${w.size}" font-weight="${w.bold ? 700 : 400}" font-family="-apple-system,'PingFang SC','Microsoft YaHei',sans-serif">${esc(label)}</text>`;
	const tile = w.stagger ? `${t(0, w.size)}${t(W / 2, H + w.size)}${t(-W / 2, H + w.size)}` : t(0, w.size);
	const ph = w.stagger ? H * 2 : H;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style="display:block"><defs><pattern id="wmp" width="${W}" height="${ph}" patternUnits="userSpaceOnUse" patternTransform="rotate(${w.angle})">${tile}</pattern></defs><rect width="100%" height="100%" fill="url(#wmp)"/></svg>`;
};

const LAYER_STYLE = "position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;user-select:none;-webkit-user-select:none;z-index:2147483000;overflow:hidden;display:block;visibility:visible;opacity:1;";

/** 水印盖在整个手机屏幕上（所以截图、导出的图里都会有），被删掉或改样式会自动恢复 */
const WatermarkLayer = () => {
	const stored = useAtomValue(watermarkAtom);
	const { pathname } = useLocation();
	// 没有「水印设置」权限的账号：强制带默认水印，改不了、关不掉
	const w = can("watermark") ? withDefaults(stored) : WM_DEFAULT;
	const show = w.on && (w.scope === "all" || isChatPath(pathname));
	const tail = w.trace ? (readSession()?.user.phone.slice(-4) ?? "") : "";
	const label = `${w.text}${tail ? ` ${tail}` : ""}`.trim() || " ";
	const key = JSON.stringify([show, w, label]);

	useEffect(() => {
		const host = document.getElementById("screen");
		if (!host) return;
		const remove = () => document.getElementById(LAYER_ID)?.remove();
		if (!show) {
			remove();
			return;
		}
		const html = buildSvg(w, label);
		let snap = "";
		const mount = () => {
			let el = document.getElementById(LAYER_ID) as HTMLDivElement | null;
			if (!el || el.parentElement !== host) {
				el?.remove();
				el = document.createElement("div");
				el.id = LAYER_ID;
				host.appendChild(el);
			}
			if (el.getAttribute("style") !== LAYER_STYLE) el.setAttribute("style", LAYER_STYLE);
			if (snap === "" || el.innerHTML !== snap) {
				el.innerHTML = html;
				snap = el.innerHTML;
			}
			return el;
		};
		mount();
		// 有人在开发者工具里删掉 / 隐藏水印：立刻补回去
		const mo = new MutationObserver(() => mount());
		mo.observe(host, { childList: true, attributes: true, subtree: true, characterData: true });
		const timer = window.setInterval(() => {
			mount();
		}, 1500);
		return () => {
			mo.disconnect();
			window.clearInterval(timer);
		};
	}, [key]);

	return null;
};

export default WatermarkLayer;
