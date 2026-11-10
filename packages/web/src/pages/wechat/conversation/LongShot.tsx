import {
	ConversationTypeLabel,
	EConversationType,
	type TConversationItem,
	conversationListAtom,
	formatWechatTime,
	getConversationListValueSnapshot,
} from "@/stateV2/conversation";
import { getAllProfilesValueSnapshot } from "@/stateV2/profile";
import { MYSELF_ID } from "@/faker/wechat/user";
import { slateToPlain } from "@/wechatComponents/SlateText/emojiNames";
import { useConversationAPI } from "./context";
import { Node } from "slate";
import { useAtomValue } from "jotai";
import { toPng } from "html-to-image";
import { useState } from "react";

const snippet = (item: TConversationItem) => {
	if (item.type === EConversationType.text) {
		return item.textContent.map((n) => Node.string(n)).join("").replace(/\s+/g, " ").trim();
	}
	if (item.type === EConversationType.centerText) return item.simpleContent;
	if (item.type === EConversationType.transfer) return `转账 ${item.amount}`;
	if (item.type === EConversationType.redPacket) return item.note || "红包";
	if (item.type === EConversationType.image) return "[图片]";
	if (item.type === EConversationType.voice) return "[语音]";
	if (item.type === EConversationType.video) return "[视频]";
	return ConversationTypeLabel[item.type] ?? "消息";
};

const lineOf = (item: TConversationItem, index: number) => {
	const who = item.role === "mine" ? "我" : "对方";
	const text = snippet(item).slice(0, 18);
	return `${index + 1}. ${[item.upperText, who, text].filter(Boolean).join(" ")}`;
};

const waitImages = (root: HTMLElement) =>
	Promise.all(
		[...root.querySelectorAll("img")].map(
			(img) =>
				img.complete
					? Promise.resolve()
					: new Promise<void>((resolve) => {
							img.onload = () => resolve();
							img.onerror = () => resolve();
						}),
		),
	);

/** 外链图片一旦留在节点里，浏览器会拒绝把整张长图画出来。能读到的先画进画布，读不到的用灰块占位。 */
const bakeImages = (root: HTMLElement) => {
	for (const img of root.querySelectorAll("img")) {
		img.removeAttribute("srcset");
		const canvas = document.createElement("canvas");
		const w = img.naturalWidth || 40;
		const h = img.naturalHeight || 40;
		canvas.width = Math.max(1, w);
		canvas.height = Math.max(1, h);
		const ctx = canvas.getContext("2d");
		if (!ctx) continue;
		let baked = false;
		if (img.naturalWidth > 0) {
			try {
				ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
				img.src = canvas.toDataURL(w * h > 40000 ? "image/jpeg" : "image/png", 0.9);
				baked = true;
			} catch {
				baked = false;
			}
		}
		if (!baked) {
			ctx.fillStyle = "#d8d8d8";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			img.src = canvas.toDataURL("image/png");
		}
	}
};

const grayPixel = () => {
	const canvas = document.createElement("canvas");
	canvas.width = 4;
	canvas.height = 4;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		ctx.fillStyle = "#d8d8d8";
		ctx.fillRect(0, 0, 4, 4);
	}
	return canvas.toDataURL("image/png");
};

const paintHost = async (host: HTMLElement, width: number) => {
	document.body.appendChild(host);
	try {
		await waitImages(host);
		bakeImages(host);
		const cssHeight = Math.max(host.scrollHeight, 1);
		const pixelRatio = Math.max(1, Math.min(2, 16000 / cssHeight));
		try {
			return await toPng(host, {
				pixelRatio,
				backgroundColor: "#EDEDED",
				width,
				height: cssHeight,
				skipFonts: true,
				imagePlaceholder: grayPixel(),
				style: {
					position: "relative",
					left: "0px",
					top: "0px",
					right: "auto",
					bottom: "auto",
					inset: "auto",
					insetInline: "auto",
					insetBlock: "auto",
					transform: "none",
				},
			});
		} catch (e) {
			const reason = e instanceof Error ? e.message : e instanceof Event ? e.type : String(e);
			throw new Error(`生成失败（${width}×${cssHeight}）：${reason || "未知错误"}`);
		}
	} finally {
		host.remove();
	}
};

/** 把当前屏幕上的标题栏和选中消息克隆出来，不带编辑栏、多选底色 */
const captureChat = async (ids: string[]) => {
	const list = document.getElementById("conversation-list");
	if (!list) throw new Error("找不到聊天内容");
	const byId = new Map<string, HTMLElement>();
	list.querySelectorAll<HTMLElement>("[data-conversation-id]").forEach((el) => {
		const id = el.getAttribute("data-conversation-id");
		if (id && !byId.has(id)) byId.set(id, el);
	});
	const nodes = ids.map((id) => byId.get(id)).filter((el): el is HTMLElement => !!el);
	if (!nodes.length) throw new Error("没有可导出的消息");

	const width = list.clientWidth || 390;
	const host = document.createElement("div");
	host.setAttribute("data-longshot", "1");
	host.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;background:#EDEDED;display:flex;flex-direction:column;pointer-events:none;`;

	const status = document.querySelector<HTMLElement>("#screen > .flex.items-center.justify-between");
	if (status && !status.classList.contains("hidden")) host.appendChild(status.cloneNode(true));

	const header = list.previousElementSibling;
	if (header) {
		const copy = header.cloneNode(true) as HTMLElement;
		copy.querySelectorAll(".fixed").forEach((el) => el.remove());
		host.appendChild(copy);
	}

	const body = document.createElement("div");
	body.className = "space-y-4 bg-[#EDEDED] p-3";
	for (const node of nodes) {
		const copy = node.cloneNode(true) as HTMLElement;
		copy.classList.remove("cursor-grab");
		copy.style.background = "transparent";
		copy.style.cursor = "default";
		body.appendChild(copy);
	}
	host.appendChild(body);
	return paintHost(host, width);
};

const plainMessage = (item: TConversationItem) => {
	if (item.type === EConversationType.text) return item.textContent.map((n) => slateToPlain(n as never)).join("");
	if (item.type === EConversationType.centerText) return item.simpleContent;
	if (item.type === EConversationType.transfer) return `转账 ¥${item.amount}`;
	if (item.type === EConversationType.redPacket) return item.note || "红包";
	if (item.type === EConversationType.image) return "";
	if (item.type === EConversationType.voice) return "语音";
	return ConversationTypeLabel[item.type] ?? "";
};

const el = (tag: string, style: string, text?: string) => {
	const node = document.createElement(tag);
	node.style.cssText = style;
	if (text) node.textContent = text;
	return node;
};

/** 不在这个聊天页时，按同样的标题栏 / 气泡 / 时间 / 头像拼一张长图，再走同一套导出。 */
const syntheticHost = (conversationId: string, ids: string[]) => {
	const profiles = getAllProfilesValueSnapshot();
	const nameOf = (id: string) => profiles.find((p) => p.id === id);
	const peer = nameOf(conversationId);
	const me = nameOf(MYSELF_ID);
	const title = peer?.remark || peer?.nickname || "聊天";
	const want = new Set(ids);
	const items = getConversationListValueSnapshot(conversationId).filter((v) => want.has(v.id));
	const width = 390;
	const host = document.createElement("div");
	host.setAttribute("data-longshot", "1");
	host.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;background:#EDEDED;display:flex;flex-direction:column;pointer-events:none;`;
	host.appendChild(el("div", "height:28px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:#EDEDED;font-size:14px;font-weight:600;", ""));
	host.lastElementChild!.textContent = "";
	const status = host.lastElementChild as HTMLElement;
	status.appendChild(el("span", "", "9:41"));
	status.appendChild(el("span", "", "●●●"));
	const header = el("div", "height:44px;display:flex;align-items:center;justify-content:center;background:#EDEDED;border-bottom:1px solid rgba(0,0,0,.1);font-size:17px;font-weight:500;", title);
	host.appendChild(header);
	const body = el("div", "background:#EDEDED;padding:12px;display:flex;flex-direction:column;gap:16px;");
	for (const item of items) {
		const mine = item.role === "mine";
		const who = mine ? me : nameOf((item as { senderId?: string }).senderId || conversationId);
		const block = el("div", "display:flex;flex-direction:column;");
		const time = item.upperText || (item.sendTimestamp ? formatWechatTime(item.sendTimestamp) : "");
		if (time) block.appendChild(el("div", "text-align:center;color:rgba(0,0,0,.45);font-size:13px;margin-bottom:8px;", time));
		const row = el("div", `display:flex;align-items:flex-start;gap:8px;${mine ? "flex-direction:row-reverse;" : ""}`);
		const avatar = document.createElement("img");
		avatar.src = who?.avatarInfo || "";
		avatar.style.cssText = "width:40px;height:40px;border-radius:4px;object-fit:cover;background:#d8d8d8;flex:none;";
		row.appendChild(avatar);
		const bubble = el("div", `max-width:240px;border-radius:4px;padding:10px;font-size:16px;line-height:22px;white-space:pre-wrap;word-break:break-word;background:${mine ? "#8CE97F" : "#fff"};`);
		if (item.type === EConversationType.image) {
			const pic = document.createElement("img");
			pic.src = item.imageInfo;
			pic.style.cssText = "width:140px;border-radius:4px;display:block;";
			bubble.appendChild(pic);
		} else bubble.textContent = plainMessage(item);
		row.appendChild(bubble);
		block.appendChild(row);
		body.appendChild(block);
	}
	host.appendChild(body);
	return { host, width };
};

/** 按消息 id 导出长图。当前就在这个聊天页时直接截屏幕上的气泡，否则按数据重绘后再导出。 */
export const exportConversationPng = async (conversationId: string, ids: string[]) => {
	const here = location.hash.includes(`/conversation/${conversationId}`) && document.getElementById("conversation-list");
	if (here) {
		try {
			return await captureChat(ids);
		} catch {
			/* 页面上没找到这些气泡时，改用数据重绘 */
		}
	}
	const { host, width } = syntheticHost(conversationId, ids);
	return paintHost(host, width);
};

const openInNewPage = (dataUrl: string) => {
	const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>聊天长截图</title><style>html,body{margin:0;background:#000}p{margin:0;padding:12px 16px;color:#fff;text-align:center;font:15px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}img{width:100%;height:auto;display:block}</style></head><body><p>长按图片，选择「存储图像」</p><img src="${dataUrl}" alt="聊天长截图"></body></html>`;
	const url = URL.createObjectURL(new Blob([page], { type: "text/html" }));
	const opened = window.open(url, "_blank");
	if (!opened) {
		const a = document.createElement("a");
		a.href = dataUrl;
		a.target = "_blank";
		a.rel = "noopener";
		a.click();
	}
};

const downloadPng = (dataUrl: string) => {
	const a = document.createElement("a");
	a.href = dataUrl;
	a.download = "聊天长截图.png";
	a.click();
};

/** 编辑模式底部栏里的「长截图」。预览模式不渲染。 */
const LongShot = () => {
	const { conversationId } = useConversationAPI();
	const list = useAtomValue(conversationListAtom(conversationId));
	const [open, setOpen] = useState(false);
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState("");
	const [preview, setPreview] = useState("");

	const show = () => {
		setErr("");
		setFrom(list[0]?.id ?? "");
		setTo(list[list.length - 1]?.id ?? "");
		setOpen(true);
	};

	const run = async () => {
		const a = list.findIndex((item) => item.id === from);
		const b = list.findIndex((item) => item.id === to);
		if (a < 0 || b < 0) {
			setErr("请选择起点和终点");
			return;
		}
		const ids = list.slice(Math.min(a, b), Math.max(a, b) + 1).map((item) => item.id);
		setBusy(true);
		setErr("");
		try {
			const url = await captureChat(ids);
			setOpen(false);
			setPreview(url);
		} catch (e) {
			setErr(e instanceof Error ? e.message : "生成失败");
		} finally {
			setBusy(false);
		}
	};

	return (
		<>
			<button type="button" onClick={show} className="h-7 rounded-full bg-[#07C160]/10 px-3 text-[14px] text-[#07C160]">
				长截图
			</button>
			{open && (
				<div className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/40" onClick={() => !busy && setOpen(false)}>
					<div className="rounded-t-[12px] bg-white p-4 pb-[calc(16px+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
						<div className="mb-1 font-medium text-[16px]">长截图</div>
						<div className="mb-3 text-[13px] leading-5 text-black/45">从起点到终点拼成一张图，默认是全部消息。标题栏、气泡、时间和头像会保留，编辑按钮不会出现在图里。</div>
						{list.length === 0 ? (
							<div className="mb-4 text-[14px] text-black/60">当前没有消息</div>
						) : (
							<>
								<label className="mb-3 block text-[13px] text-black/50">
									起点
									<select aria-label="长截图起点" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-10 w-full rounded-[6px] bg-black/5 px-2 text-[14px] text-black/80">
										{list.map((item, i) => (
											<option key={item.id} value={item.id}>
												{lineOf(item, i)}
											</option>
										))}
									</select>
								</label>
								<label className="mb-3 block text-[13px] text-black/50">
									终点
									<select aria-label="长截图终点" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-10 w-full rounded-[6px] bg-black/5 px-2 text-[14px] text-black/80">
										{list.map((item, i) => (
											<option key={item.id} value={item.id}>
												{lineOf(item, i)}
											</option>
										))}
									</select>
								</label>
							</>
						)}
						{err && <div className="mb-2 text-[13px] text-[#FA5151]">{err}</div>}
						<button type="button" disabled={busy || list.length === 0} onClick={() => void run()} className="h-[44px] w-full rounded-[6px] bg-[#07C160] text-[16px] text-white disabled:opacity-40">
							{busy ? "正在生成…" : "生成长图"}
						</button>
					</div>
				</div>
			)}
			{preview && (
				<div className="fixed inset-0 z-[80] flex flex-col bg-black/80 px-4 py-6" onClick={() => setPreview("")}>
					<div className="mx-auto flex min-h-0 w-full max-w-[440px] flex-1 flex-col" onClick={(e) => e.stopPropagation()}>
						<div className="mb-2 text-center text-[14px] leading-5 text-white">iPhone 可长按图片保存。也可以新开一页或下载 PNG。</div>
						<div className="min-h-0 flex-1 overflow-auto rounded-[8px] bg-[#EDEDED]">
							<img src={preview} alt="聊天长截图" className="block w-full" />
						</div>
						<div className="mt-3 flex gap-2">
							<button type="button" onClick={() => openInNewPage(preview)} className="h-11 flex-1 rounded-[8px] bg-white text-[16px] text-black">
								新页面打开
							</button>
							<button type="button" onClick={() => downloadPng(preview)} className="h-11 flex-1 rounded-[8px] bg-[#07C160] text-[16px] text-white">
								下载 PNG
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
};

export default LongShot;
