import { h } from "@/components/HashAssets";
import { saveImage } from "@/components/SheetKit";
import { MYSELF_ID } from "@/faker/wechat/user";
import { geminiConfigAtom } from "@/stateV2/gemini";
import { type IStateFeed, setFeedListValue } from "@/stateV2/moments";
import {
	type GeminiImage,
	type GeminiTurn,
	callGemini,
	fileToGeminiImage,
	normalizeDeepSeekApiKey,
	parseJsonLoose,
} from "@/utils/gemini";
import { textToSlateChildren } from "@/wechatComponents/SlateText/emojiNames";
import { useAtomValue } from "jotai";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

/** 朋友圈一次最多 9 张，和微信图片格一致 */
const MAX_PHOTOS = 9;

type MomentPhoto = { hash: string; img: GeminiImage };

type Draft = { text: string; location?: string; images: string[]; published?: boolean };

type ChatMsg = {
	id: string;
	role: "user" | "model";
	text: string;
	images?: string[];
	error?: boolean;
	draft?: Draft;
};

const toSlate = (text: string) =>
	text
		.split("\n")
		.map((line) => ({ type: "paragraph", children: textToSlateChildren(line) })) as never;

/** 压成最长边 1600 的 JPEG 再写入 HashAssetsDB，避免把原图塞进 localStorage */
async function storeMomentPhoto(file: File): Promise<MomentPhoto> {
	const img = await fileToGeminiImage(file);
	const binary = atob(img.data);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	const hash = await saveImage(new File([bytes], "moment.jpg", { type: "image/jpeg" }));
	return { hash, img };
}

const MOMENTS_SYSTEM = `你在和用户聊天，帮他写一条他自己的微信朋友圈。不要发布，发布由用户点按钮。

什么时候只追问：用户没说清要发什么（比如只说「帮我写一条」）。用一句口语问最关键的一点：在哪、想表达什么、多长、什么语气。一次只问一个。

什么时候给草稿：用户已经说出主题或场景（例如「我现在在北宁，帮我写段旅游文案」），或上传了照片让你写。先用一两句口语回应，再给草稿。用户接着说「短一点」「换个语气」「再文艺一点」时，按要求改上一版，重新给一版完整草稿。

草稿必须是单独一个代码块，整段回复里只能有一个：

\`\`\`wxmoment
{"text":"朋友圈正文","location":"越南·北宁"}
\`\`\`

规则：
- text 是朋友圈正文，像真人随手发的，口语，可有少量 emoji。长短和语气听用户的。
- location 只写用户在对话里提到的地方，用「地区·地点」。用户说在北宁就写「越南·北宁」。没提到任何地方就用空字符串。不要使用浏览器定位，也不要编用户没说过的地点。
- 配图由系统按上传顺序附上，不要在 JSON 里写图片地址。如果这次消息带了照片，正文要照着照片里能看到的来写，不要编造照片里明显没有的具体事物。
- 代码块外面不要再重复整段正文，也不要输出 wxchat、wxops 或聊天记录。`;

function historyOf(msgs: ChatMsg[]): GeminiTurn[] {
	const turns: GeminiTurn[] = [];
	for (const m of msgs) {
		if (m.error) continue;
		let text = m.text;
		if (m.images?.length) text += `（这条附了 ${m.images.length} 张照片）`;
		if (m.draft) text += `\n【当前草稿】${m.draft.text}\n位置：${m.draft.location ?? ""}`;
		if (!text.trim()) continue;
		turns.push({ role: m.role, text });
	}
	while (turns.length && turns[0].role !== "user") turns.shift();
	return turns.slice(-16);
}

type RawDraft = { text?: string; location?: string };

function parseDraft(raw: string): { say: string; draft?: { text: string; location?: string } } {
	const fenced = raw.match(/```(?:wxmoment|json)?\s*([\s\S]*?)```/i);
	let blob = fenced?.[1]?.trim();
	let say = (fenced ? raw.replace(fenced[0], "") : raw).replace(/```/g, "").trim();
	if (!blob) {
		const loose = raw.match(/\{[\s\S]*"text"\s*:[\s\S]*\}/);
		if (loose) {
			blob = loose[0];
			say = raw.replace(loose[0], "").replace(/```/g, "").trim();
		}
	}
	if (!blob) return { say: say || raw.trim() };
	try {
		const parsed = parseJsonLoose<RawDraft | RawDraft[]>(blob);
		const item = Array.isArray(parsed) ? parsed.find((x) => x?.text?.trim()) : parsed;
		const text = item?.text?.trim() ?? "";
		if (!text) return { say: say || raw.trim() };
		return {
			say: say || "写好了一版，要改直接说。",
			draft: { text, location: item?.location?.trim() || undefined },
		};
	} catch {
		return { say: say || raw.trim() };
	}
}

function mockEnabled() {
	return import.meta.env.DEV && new URLSearchParams(window.location.search).has("momentsAiMock");
}

/** 本地没有密钥时，开发预览用 ?momentsAiMock=1 走这条，方便看聊天、草稿和发布。正式构建不会走到这里。 */
function mockMomentsReply(text: string, history: GeminiTurn[], totalPhotos: number) {
	const blob = [...history.map((h) => h.text), text].join("\n");
	const loc = /北宁/.test(blob) ? "越南·北宁" : "";
	const vague = !/文案|朋友圈|写|短|语气|改|照片|图|北宁|旅游/.test(blob) && totalPhotos === 0;
	if (vague) return "想发什么样的朋友圈？可以说说你在哪，或者想要什么语气。";
	const short = /短一点|太长|简短|短些/.test(text);
	const tone = /语气|活泼|正式|文艺|轻松/.test(text);
	let body = short
		? loc
			? "北宁的风很轻，还想再走一走。"
			: "今天刚刚好。"
		: tone && loc
			? "到北宁啦，街灯一亮，连脚步都轻快了。"
			: loc
				? "人在北宁。树荫一块一块的，走慢一点，风都是热的。把这段路记下来。"
				: totalPhotos
					? "随手一拍，今天的光刚好。"
					: "今天想记一笔，把此刻留下来。";
	if (totalPhotos && !short) body += "照片是刚拍的。";
	const say = short
		? "改短了一版。"
		: tone
			? "换了个语气。"
			: "按你说的写了一版，不满意可以直接说怎么改。";
	return `${say}\n\n\`\`\`wxmoment\n${JSON.stringify({ text: body, location: loc })}\n\`\`\``;
}

async function askMoments(
	prompt: string,
	history: GeminiTurn[],
	images: GeminiImage[],
	totalPhotos: number,
) {
	if (mockEnabled()) {
		await new Promise((r) => setTimeout(r, 350));
		return mockMomentsReply(prompt, history, totalPhotos);
	}
	return callGemini(prompt, {
		system: MOMENTS_SYSTEM,
		history,
		...(images.length ? { images } : {}),
	});
}

function publishFeed(draft: Draft) {
	const text = toSlate(draft.text);
	const item: IStateFeed = {
		id: nanoid(8),
		userId: MYSELF_ID,
		sendTimestamp: Date.now(),
		content: draft.images.length
			? { type: "textWithImages", text, imagesInfo: [...draft.images] }
			: { type: "text", text },
		location: draft.location?.trim() || undefined,
	};
	setFeedListValue((prev) => [item, ...prev].sort((a, b) => b.sendTimestamp - a.sendTimestamp));
}

const AiMoments = () => {
	const gemini = useAtomValue(geminiConfigAtom);
	const navigate = useNavigate();
	const mock = mockEnabled();
	const hasKey =
		mock || !!(gemini.apiKey || gemini.apiKey2 || normalizeDeepSeekApiKey(gemini.deepseekApiKey));
	const [open, setOpen] = useState(false);
	const [input, setInput] = useState("");
	const [album, setAlbum] = useState<MomentPhoto[]>([]);
	const [pics, setPics] = useState<MomentPhoto[]>([]);
	const [adding, setAdding] = useState(false);
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState("");
	const [messages, setMessages] = useState<ChatMsg[]>([]);
	const bottomRef = useRef<HTMLDivElement>(null);
	const run = useRef(0);
	const live = useRef(true);
	const photoCount = album.length + pics.length;
	const photoKey = [...album, ...pics].map((p) => p.hash).join("|");

	useEffect(() => {
		live.current = true;
		return () => {
			live.current = false;
		};
	}, []);

	useEffect(() => {
		if (open) bottomRef.current?.scrollIntoView({ block: "end" });
	}, [open, messages.length, busy]);

	useEffect(() => {
		const hashes = photoKey ? photoKey.split("|") : [];
		setMessages((ms) => {
			let idx = -1;
			for (let i = ms.length - 1; i >= 0; i--) {
				if (ms[i].draft && !ms[i].draft?.published) {
					idx = i;
					break;
				}
			}
			if (idx < 0) return ms;
			const cur = ms[idx].draft;
			if (!cur || cur.images.join("|") === photoKey) return ms;
			const next = ms.slice();
			next[idx] = { ...ms[idx], draft: { ...cur, images: hashes } };
			return next;
		});
	}, [photoKey]);

	const addPhotos = async (list: FileList | null) => {
		const incoming = Array.from(list ?? []);
		if (!incoming.length || adding) return;
		const room = MAX_PHOTOS - photoCount;
		if (room <= 0) {
			setErr("最多 9 张图片");
			return;
		}
		const batch = incoming.slice(0, room);
		setAdding(true);
		const prepared: MomentPhoto[] = [];
		let failed = 0;
		try {
			for (const file of batch) {
				if (file.type && !file.type.startsWith("image/")) {
					failed++;
					continue;
				}
				try {
					prepared.push(await storeMomentPhoto(file));
				} catch {
					failed++;
				}
			}
			setPics((prev) => [...prev, ...prepared].slice(0, Math.max(0, MAX_PHOTOS - album.length)));
			if (incoming.length > room) setErr("最多 9 张图片");
			else if (failed) setErr(prepared.length ? "有图片读取失败，已跳过" : "图片读取失败");
			else setErr("");
		} finally {
			setAdding(false);
		}
	};

	const send = async () => {
		const typed = input.trim();
		if ((!typed && !pics.length) || busy || adding || !hasKey) return;
		const batch = pics;
		const nextAlbum = [...album, ...batch].slice(0, MAX_PHOTOS);
		const text = typed || "请看这张图片。";
		const userMsg: ChatMsg = {
			id: nanoid(8),
			role: "user",
			text,
			...(batch.length ? { images: batch.map((p) => p.hash) } : {}),
		};
		const prior = messages;
		const token = ++run.current;
		setInput("");
		setPics([]);
		setAlbum(nextAlbum);
		setErr("");
		setMessages((m) => [...m, userMsg]);
		setBusy(true);
		try {
			const note = nextAlbum.length
				? `\n（这条朋友圈目前有 ${nextAlbum.length} 张照片，按上传顺序。这一次新附上 ${batch.length} 张。）`
				: "";
			const reply = await askMoments(
				text + note,
				historyOf(prior),
				batch.map((p) => p.img),
				nextAlbum.length,
			);
			if (!live.current || run.current !== token) return;
			const parsed = parseDraft(reply);
			setMessages((m) => [
				...m,
				{
					id: nanoid(8),
					role: "model",
					text: parsed.say,
					draft: parsed.draft
						? { ...parsed.draft, images: nextAlbum.map((p) => p.hash) }
						: undefined,
				},
			]);
		} catch (e) {
			if (!live.current || run.current !== token) return;
			setMessages((m) => [
				...m,
				{
					id: nanoid(8),
					role: "model",
					error: true,
					text: e instanceof Error ? e.message : String(e),
				},
			]);
		} finally {
			if (run.current === token) setBusy(false);
		}
	};

	const publish = (id: string) => {
		const msg = messages.find((m) => m.id === id);
		if (!msg?.draft || msg.draft.published || !msg.draft.text.trim()) return;
		publishFeed(msg.draft);
		setMessages((ms) =>
			ms.map((m) =>
				m.id === id && m.draft ? { ...m, draft: { ...m.draft, published: true } } : m,
			),
		);
		document
			.querySelector<HTMLElement>("[data-wheel-id=wechatMomentsLayout]")
			?.scrollTo({ top: 0 });
	};

	const clear = () => {
		if (!messages.length && !album.length && !pics.length) return;
		if (!window.confirm("清空这次对话？还没发布的草稿会丢掉。")) return;
		run.current++;
		setBusy(false);
		setMessages([]);
		setAlbum([]);
		setPics([]);
		setInput("");
		setErr("");
	};

	const host = typeof document !== "undefined" ? document.getElementById("screen") : null;
	const chat = (
		<div className="absolute inset-0 z-[40] flex flex-col bg-[#EDEDED]">
			<div className="relative flex h-11 shrink-0 items-center justify-center bg-[#EDEDED] px-4">
				<button
					type="button"
					aria-label="返回"
					className="absolute left-3 flex h-8 w-8 items-center"
					onClick={() => setOpen(false)}
				>
					<svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
						<path
							d="M10 2L2 10l8 8"
							stroke="#000"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</button>
				<div className="font-medium text-[17px]">AI 生成朋友圈</div>
				<button
					type="button"
					className="absolute right-4 text-[#576B95] text-[15px]"
					onClick={clear}
				>
					清空
				</button>
			</div>
			<div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
				<div className="mx-auto mb-3 max-w-[92%] pt-2 text-center text-[12px] text-black/40 leading-5">
					先和 AI 说想发什么，也可以上传 1-9
					张照片。草稿满意后点「发布」才会发到朋友圈。位置按你话里提到的地方来写。
				</div>
				{!hasKey && (
					<button
						type="button"
						onClick={() => navigate("/wechat/my/settings/ai/key")}
						className="mx-auto mb-3 block h-10 rounded-[6px] bg-[#07C160] px-6 text-[15px] text-white"
					>
						还没填密钥，去填写
					</button>
				)}
				{messages.length === 0 && hasKey && (
					<div className="mt-8 text-center text-[14px] text-black/40 leading-7">
						「我现在在北宁，帮我写段旅游文案」
						<br />
						「短一点」
						<br />
						「换个轻松的语气」
					</div>
				)}
				{messages.map((m) => (
					<div
						key={m.id}
						className={`mb-3 flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
					>
						<div
							className={`max-w-[82%] whitespace-pre-wrap break-words rounded-[6px] px-3 py-[10px] text-[16px] leading-[23px] ${m.role === "user" ? "bg-[#95EC69]" : m.error ? "bg-[#FBE9E9] text-[#C62828]" : "bg-white"}`}
						>
							{m.images?.length ? (
								<div className="mb-1 flex flex-wrap gap-1">
									{m.images.map((hs, i) => (
										<h.img
											key={`${hs}-${i}`}
											src={hs}
											alt=""
											className="h-[72px] w-[72px] rounded-[4px] object-cover"
										/>
									))}
								</div>
							) : null}
							{m.text}
						</div>
						{m.draft && (
							<div className="mt-2 w-[88%] rounded-[8px] bg-white p-3" aria-label="朋友圈草稿">
								<div className="text-[12px] text-black/40">草稿</div>
								<div className="mt-1 whitespace-pre-wrap break-words text-[16px] leading-[23px]">
									{m.draft.text}
								</div>
								{m.draft.location ? (
									<div className="mt-1 text-[13px] text-wechatLink-3">{m.draft.location}</div>
								) : null}
								{m.draft.images.length > 0 && (
									<div className="mt-2 flex flex-wrap gap-1">
										{m.draft.images.map((hs, i) => (
											<h.img
												key={`${hs}-${i}`}
												src={hs}
												alt=""
												className="h-[64px] w-[64px] rounded-[4px] object-cover"
											/>
										))}
									</div>
								)}
								{m.draft.published ? (
									<div className="mt-2 text-[#07C160] text-[13px]">已发布</div>
								) : (
									<button
										type="button"
										aria-label="发布"
										onClick={() => publish(m.id)}
										className="mt-2 h-10 w-full rounded-[6px] bg-[#07C160] text-[15px] text-white"
									>
										发布
									</button>
								)}
							</div>
						)}
					</div>
				))}
				{busy && (
					<div className="mb-3 flex items-center gap-3 text-[14px] text-black/40">
						AI 正在写…
						<button
							type="button"
							className="text-[#576B95]"
							onClick={() => {
								run.current++;
								setBusy(false);
							}}
						>
							停止
						</button>
					</div>
				)}
				<div ref={bottomRef} />
			</div>
			{err && (
				<div className="whitespace-pre-line bg-[#FBE9E9] px-4 py-2 text-[#C62828] text-[13px]">
					{err}
				</div>
			)}
			{photoCount > 0 && (
				<div className="border-black/5 border-t bg-[#F7F7F7] px-3 pt-2">
					<div className="mb-1 text-[12px] text-black/40">配图 {photoCount}/9</div>
					<div className="flex gap-2 overflow-x-auto pb-1">
						{album.map((p, i) => (
							<div key={`a-${p.hash}-${i}`} className="relative shrink-0">
								<h.img src={p.hash} alt="" className="h-14 w-14 rounded-[4px] object-cover" />
								<button
									type="button"
									aria-label="删除图片"
									className="-top-1 -right-1 absolute flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[12px] text-white"
									onClick={() => setAlbum((prev) => prev.filter((_, k) => k !== i))}
								>
									×
								</button>
							</div>
						))}
						{pics.map((p, i) => (
							<div key={`p-${p.hash}-${i}`} className="relative shrink-0">
								<h.img src={p.hash} alt="" className="h-14 w-14 rounded-[4px] object-cover" />
								<button
									type="button"
									aria-label="移除图片"
									className="-top-1 -right-1 absolute flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[12px] text-white"
									onClick={() => setPics((prev) => prev.filter((_, k) => k !== i))}
								>
									×
								</button>
							</div>
						))}
					</div>
				</div>
			)}
			<div className="flex items-end gap-2 border-t-[#D6D6D6] border-t-[0.5px] bg-[#F7F7F7] px-3 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))]">
				<label
					aria-label="上传图片"
					className={`flex h-10 shrink-0 items-center justify-center rounded-[6px] bg-white px-2.5 text-[14px] text-black/80 ${busy || adding || photoCount >= MAX_PHOTOS || !hasKey ? "pointer-events-none opacity-40" : "cursor-pointer"}`}
				>
					{adding ? "处理中…" : "上传图片"}
					<input
						type="file"
						accept="image/*"
						multiple
						hidden
						onChange={(e) => {
							void addPhotos(e.target.files);
							e.target.value = "";
						}}
					/>
				</label>
				<textarea
					rows={1}
					aria-label="对 AI 说"
					className="max-h-[120px] min-h-[40px] flex-1 resize-none rounded-[6px] bg-white px-3 py-[9px] text-[16px] leading-[22px] outline-none"
					value={input}
					disabled={!hasKey}
					placeholder="和 AI 说点什么…"
					onChange={(e) => setInput(e.target.value)}
				/>
				<button
					type="button"
					disabled={busy || adding || !hasKey || (!input.trim() && !pics.length)}
					onClick={() => void send()}
					className="h-10 shrink-0 rounded-[6px] bg-[#07C160] px-4 text-[16px] text-white disabled:opacity-40"
				>
					发送
				</button>
			</div>
		</div>
	);

	return (
		<>
			<div className="flex justify-end px-4 pb-2">
				<button
					type="button"
					onClick={() => setOpen(true)}
					className="h-8 rounded-full bg-[#07C160] px-4 text-[14px] text-white"
				>
					AI 生成朋友圈
				</button>
			</div>
			{open &&
				(host ? createPortal(chat, host) : <div className="fixed inset-0 z-[40]">{chat}</div>)}
		</>
	);
};

export default AiMoments;
