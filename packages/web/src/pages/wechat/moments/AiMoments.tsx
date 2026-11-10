import { h } from "@/components/HashAssets";
import { saveImage } from "@/components/SheetKit";
import { MYSELF_ID } from "@/faker/wechat/user";
import { geminiConfigAtom } from "@/stateV2/gemini";
import { type IFeedComment, type IStateFeed, setFeedListValue } from "@/stateV2/moments";
import { getAllProfilesValueSnapshot } from "@/stateV2/profile";
import {
	type GeminiImage,
	type GeminiTurn,
	callGemini,
	fileToGeminiImage,
	normalizeDeepSeekApiKey,
	parseJsonLoose,
} from "@/utils/gemini";
import { textToSlateChildren } from "@/wechatComponents/SlateText/emojiNames";
import dayjs from "dayjs";
import { useAtomValue } from "jotai";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

/** 朋友圈一次最多 9 张，和微信图片格一致 */
const MAX_PHOTOS = 9;
const AT_FMT = "YYYY-MM-DDTHH:mm";

type MomentPhoto = { hash: string; img: GeminiImage };
type Person = { id: string; name: string };
type CommentDraft = { id: string; from: string; reply: string; text: string };
type Filled = {
	text: string;
	location: string;
	at: string;
	likes: string[];
	comments: { from: string; reply?: string; text: string }[];
};
type ChatMsg = {
	id: string;
	role: "user" | "model";
	text: string;
	error?: boolean;
	filled?: Filled;
};

const toSlate = (text: string) =>
	text
		.split("\n")
		.map((line) => ({ type: "paragraph", children: textToSlateChildren(line) })) as never;

const inputCls = "w-full rounded-[6px] bg-[#F5F5F5] px-3 py-[7px] text-[16px] outline-none";

async function storeMomentPhoto(file: File): Promise<MomentPhoto> {
	const img = await fileToGeminiImage(file);
	const binary = atob(img.data);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	const hash = await saveImage(new File([bytes], "moment.jpg", { type: "image/jpeg" }));
	return { hash, img };
}

function peopleList(): Person[] {
	return getAllProfilesValueSnapshot()
		.slice(0, 60)
		.map((p) => ({
			id: p.id,
			name: p.id === MYSELF_ID ? "我" : p.remark || p.nickname,
		}));
}

const MOMENTS_SYSTEM = `你在帮用户准备一条他自己的微信朋友圈。不要说已经发布。根据对话把结果填进下面的 JSON，信息不够就先追问，不要输出 JSON。

用户说出主题（例如「我现在在北宁，帮我写段旅游文案」）或上传了照片时，先用一两句口语，再给一个代码块：

\`\`\`wxmoment
{"text":"正文","at":"2026-11-10 15:00","location":"越南·北宁","likes":["人物id"],"comments":[{"from":"人物id","text":"评论","replyTo":""}]}
\`\`\`

规则：
- text 是朋友圈正文，口语，可有少量 emoji。用户说「短一点」「换个语气」就改上一版。
- at 是发布时间，格式 YYYY-MM-DD HH:mm，必须早于现在。
- location 只写用户话里提到的地方，用「地区·地点」。北宁写成「越南·北宁」。没提到就用空字符串。不要使用浏览器定位，也不要编用户没说过的地点。
- likes 是点赞人 id 数组，0 到 6 个；comments 是 0 到 3 条。from、replyTo、likes 里的 id 必须从给定人物列表原样照抄。replyTo 没有就用空字符串。
- 配图由页面按上传顺序附上，不要在 JSON 里写图片。有照片时，正文要照着照片里能看到的写。
- 代码块外面不要重复正文。`;

function historyOf(msgs: ChatMsg[]): GeminiTurn[] {
	const turns: GeminiTurn[] = [];
	for (const m of msgs) {
		if (m.error) continue;
		let text = m.text;
		if (m.filled) {
			text += `\n【已填入】正文：${m.filled.text}\n时间：${m.filled.at}\n位置：${m.filled.location}\n点赞：${m.filled.likes.join(",")}\n评论：${m.filled.comments.map((c) => `${c.from}:${c.text}`).join("；")}`;
		}
		if (text.trim()) turns.push({ role: m.role, text });
	}
	while (turns.length && turns[0].role !== "user") turns.shift();
	return turns.slice(-16);
}

type RawDraft = {
	text?: string;
	location?: string;
	at?: string;
	likes?: string[];
	comments?: { from?: string; text?: string; replyTo?: string }[];
};

function parseDraft(raw: string, people: Person[]): { say: string; filled?: Filled } {
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
		const ids = new Set(people.map((p) => p.id));
		const atRaw = item?.at ? dayjs(item.at) : null;
		let at = atRaw?.isValid() ? atRaw : dayjs();
		if (at.valueOf() > Date.now()) at = dayjs();
		const comments = (item?.comments ?? [])
			.filter((c) => c?.text?.trim() && c.from && ids.has(c.from))
			.slice(0, 3)
			.map((c) => ({
				from: c.from as string,
				reply: c.replyTo && ids.has(c.replyTo) ? c.replyTo : "",
				text: String(c.text).trim(),
			}));
		return {
			say: say || "填好了一版，可以在下面改。",
			filled: {
				text,
				location: item?.location?.trim() || "",
				at: at.format(AT_FMT),
				likes: (item?.likes ?? []).filter((id) => ids.has(id)).slice(0, 6),
				comments,
			},
		};
	} catch {
		return { say: say || raw.trim() };
	}
}

function mockEnabled() {
	return import.meta.env.DEV && new URLSearchParams(window.location.search).has("momentsAiMock");
}

/** 开发预览用 ?momentsAiMock=1。正式构建里 DEV 为 false，不会走到这里。 */
function mockMomentsReply(
	text: string,
	history: GeminiTurn[],
	totalPhotos: number,
	people: Person[],
) {
	const blob = [...history.map((h) => h.text), text].join("\n");
	const loc = /北宁/.test(blob) ? "越南·北宁" : "";
	const vague = !/文案|朋友圈|写|短|语气|改|照片|图|北宁|旅游/.test(blob) && totalPhotos === 0;
	if (vague) return "想发什么样的朋友圈？可以说说你在哪，或者想要什么语气。";
	const others = people.filter((p) => p.id !== MYSELF_ID);
	const short = /短一点|太长|简短|短些/.test(text);
	const body = short
		? loc
			? "北宁的风很轻，还想再走一走。"
			: "今天刚刚好。"
		: loc
			? `人在北宁。树荫一块一块的，走慢一点，风都是热的。${totalPhotos ? "照片是刚拍的。" : "把这段路记下来。"}`
			: totalPhotos
				? "随手一拍，今天的光刚好。"
				: "今天想记一笔，把此刻留下来。";
	const likes = others.slice(0, short ? 1 : 2).map((p) => p.id);
	const comments = others[0]
		? [{ from: others[0].id, text: short ? "真好看" : "下次带我一起去", replyTo: "" }]
		: [];
	const at = dayjs().subtract(8, "minute").format("YYYY-MM-DD HH:mm");
	const say = short ? "改短了一版，已经填进下面。" : "按你说的写了一版，已经填进文案、时间和位置。";
	return `${say}\n\n\`\`\`wxmoment\n${JSON.stringify({ text: body, at, location: loc, likes, comments })}\n\`\`\``;
}

async function askMoments(
	prompt: string,
	history: GeminiTurn[],
	images: GeminiImage[],
	totalPhotos: number,
	people: Person[],
) {
	if (mockEnabled()) {
		await new Promise((r) => setTimeout(r, 300));
		return mockMomentsReply(prompt, history, totalPhotos, people);
	}
	const names = people.map((p) => `${p.id} | ${p.name}`).join("\n");
	return callGemini(prompt, {
		system: `${MOMENTS_SYSTEM}\n\n可用人物（id | 名字）：\n${names}\n现在时间：${dayjs().format("YYYY-MM-DD HH:mm")}`,
		history,
		...(images.length ? { images } : {}),
	});
}

const MomentComposer = ({ onClose }: { onClose: () => void }) => {
	const gemini = useAtomValue(geminiConfigAtom);
	const navigate = useNavigate();
	const people = useMemo(() => peopleList(), []);
	const mock = mockEnabled();
	const hasKey =
		mock || !!(gemini.apiKey || gemini.apiKey2 || normalizeDeepSeekApiKey(gemini.deepseekApiKey));
	const [images, setImages] = useState<MomentPhoto[]>([]);
	const [adding, setAdding] = useState(false);
	const [text, setText] = useState("");
	const [at, setAt] = useState(() => dayjs().format(AT_FMT));
	const [location, setLocation] = useState("");
	const [likes, setLikes] = useState<Set<string>>(new Set());
	const [comments, setComments] = useState<CommentDraft[]>([]);
	const [input, setInput] = useState("");
	const [messages, setMessages] = useState<ChatMsg[]>([]);
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState("");
	const bottomRef = useRef<HTMLDivElement>(null);
	const run = useRef(0);
	const live = useRef(true);

	useEffect(() => {
		live.current = true;
		return () => {
			live.current = false;
		};
	}, []);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ block: "end" });
	}, [messages.length, busy]);

	const addPhotos = async (list: FileList | null) => {
		const incoming = Array.from(list ?? []);
		if (!incoming.length || adding) return;
		const room = MAX_PHOTOS - images.length;
		if (room <= 0) {
			setErr("最多 9 张图片");
			return;
		}
		setAdding(true);
		const prepared: MomentPhoto[] = [];
		let failed = 0;
		try {
			for (const file of incoming.slice(0, room)) {
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
			setImages((prev) => [...prev, ...prepared].slice(0, MAX_PHOTOS));
			setErr(
				incoming.length > room
					? "最多 9 张图片"
					: failed
						? prepared.length
							? "有图片读取失败，已跳过"
							: "图片读取失败"
						: "",
			);
		} finally {
			setAdding(false);
		}
	};

	const applyFilled = (filled: Filled) => {
		setText(filled.text);
		setLocation(filled.location);
		setAt(filled.at);
		setLikes(new Set(filled.likes));
		setComments(
			filled.comments.map((c) => ({
				id: nanoid(8),
				from: c.from,
				reply: c.reply || "",
				text: c.text,
			})),
		);
	};

	const send = async () => {
		const typed = input.trim();
		if (!typed || busy || adding || !hasKey) return;
		const prior = messages;
		const shots = images;
		const token = ++run.current;
		const userMsg: ChatMsg = { id: nanoid(8), role: "user", text: typed };
		setInput("");
		setErr("");
		setMessages((m) => [...m, userMsg]);
		setBusy(true);
		try {
			const note = shots.length
				? `\n（已上传 ${shots.length} 张照片，按顺序附在这次请求里。）`
				: "";
			const reply = await askMoments(
				typed + note,
				historyOf(prior),
				shots.map((p) => p.img),
				shots.length,
				people,
			);
			if (!live.current || run.current !== token) return;
			const parsed = parseDraft(reply, people);
			if (parsed.filled) applyFilled(parsed.filled);
			setMessages((m) => [
				...m,
				{ id: nanoid(8), role: "model", text: parsed.say, filled: parsed.filled },
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

	const publish = () => {
		if (!text.trim() && images.length === 0) {
			setErr("写点文案，或先加一张图片");
			return;
		}
		const ts = Math.min(dayjs(at).valueOf() || Date.now(), Date.now());
		const slate = text.trim() ? toSlate(text) : undefined;
		const saved: IFeedComment[] = comments
			.filter((c) => c.text.trim() && people.some((p) => p.id === c.from))
			.map((c, i) => ({
				id: c.id,
				fromUserId: c.from,
				replyUserId: c.reply || undefined,
				text: toSlate(c.text),
				sendTimestamp: Math.min(ts + (i + 1) * 5 * 60_000, Date.now()),
			}));
		const item: IStateFeed = {
			id: nanoid(8),
			userId: MYSELF_ID,
			sendTimestamp: ts,
			content: images.length
				? { type: "textWithImages", text: slate, imagesInfo: images.map((p) => p.hash) }
				: { type: "text", text: slate ?? toSlate("") },
			location: location.trim() || undefined,
			likeUserIds: [...likes].filter((id) => people.some((p) => p.id === id)),
			comments: saved,
		};
		setFeedListValue((prev) => [item, ...prev].sort((a, b) => b.sendTimestamp - a.sendTimestamp));
		document
			.querySelector<HTMLElement>("[data-wheel-id=wechatMomentsLayout]")
			?.scrollTo({ top: 0 });
		onClose();
	};

	const toggleLike = (id: string) => {
		setLikes((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const host = typeof document !== "undefined" ? document.getElementById("screen") : null;
	const page = (
		<div className="absolute inset-0 z-[40] flex flex-col bg-[#EDEDED]">
			<div className="flex h-11 shrink-0 items-center justify-between bg-[#EDEDED] px-4">
				<button type="button" className="text-[16px] text-black/60" onClick={onClose}>
					取消
				</button>
				<div className="font-medium text-[17px]">发朋友圈</div>
				<button type="button" className="font-medium text-[#07C160] text-[16px]" onClick={publish}>
					发布
				</button>
			</div>
			<div className="shrink-0 border-black/5 border-b bg-white px-3 py-2">
				<div className="mb-1 text-[12px] text-black/40">图片 {images.length}/9</div>
				<div className="flex flex-wrap gap-2">
					{images.map((p, i) => (
						<div key={`${p.hash}-${i}`} className="relative h-16 w-16">
							<h.img src={p.hash} alt="" className="h-full w-full rounded-[4px] object-cover" />
							<button
								type="button"
								aria-label="删除图片"
								className="-top-1 -right-1 absolute flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[12px] text-white"
								onClick={() => setImages((prev) => prev.filter((_, k) => k !== i))}
							>
								×
							</button>
						</div>
					))}
					{images.length < MAX_PHOTOS && (
						<label
							aria-label="上传图片"
							className={`flex h-16 w-16 items-center justify-center rounded-[4px] bg-[#F5F5F5] text-[13px] text-black/50 ${adding ? "pointer-events-none opacity-40" : "cursor-pointer"}`}
						>
							{adding ? "…" : "上传"}
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
					)}
				</div>
			</div>
			<div className="min-h-0 flex-1 overflow-auto px-3 py-2">
				<div className="mb-2 text-center text-[12px] text-black/40 leading-5">
					跟 AI 说想发什么。它会把文案、时间、位置、点赞和评论填到下面，你也可以直接改。
				</div>
				{!hasKey && (
					<button
						type="button"
						onClick={() => navigate("/wechat/my/settings/ai/key")}
						className="mx-auto mb-2 block h-9 rounded-[6px] bg-[#07C160] px-4 text-[14px] text-white"
					>
						还没填密钥，去填写
					</button>
				)}
				{messages.length === 0 && hasKey && (
					<div className="mb-2 text-center text-[14px] text-black/35 leading-6">
						「我现在在北宁，帮我写段旅游文案」
						<br />
						「短一点」
					</div>
				)}
				{messages.map((m) => (
					<div
						key={m.id}
						className={`mb-2 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
					>
						<div
							className={`max-w-[82%] whitespace-pre-wrap break-words rounded-[6px] px-3 py-2 text-[15px] leading-[22px] ${m.role === "user" ? "bg-[#95EC69]" : m.error ? "bg-[#FBE9E9] text-[#C62828]" : "bg-white"}`}
						>
							{m.text}
						</div>
					</div>
				))}
				{busy && <div className="mb-2 text-[13px] text-black/40">AI 正在写…</div>}
				<div ref={bottomRef} />
			</div>
			{err && <div className="bg-[#FBE9E9] px-4 py-1 text-[#C62828] text-[13px]">{err}</div>}
			<div className="max-h-[46%] shrink-0 overflow-auto border-black/10 border-t bg-white px-3 py-2">
				<textarea
					aria-label="文案"
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder="这一刻的想法…"
					className={`${inputCls} h-[72px] resize-none leading-6`}
				/>
				<label className="mt-2 flex items-center gap-2 text-[14px] text-black/50">
					时间
					<input
						aria-label="发布时间"
						type="datetime-local"
						value={at}
						onChange={(e) => setAt(e.target.value)}
						className="min-w-0 flex-1 rounded-[6px] bg-[#F5F5F5] px-2 py-[6px] text-[15px] text-black outline-none"
					/>
				</label>
				<label className="mt-2 flex items-center gap-2 text-[14px] text-black/50">
					位置
					<input
						aria-label="位置"
						value={location}
						onChange={(e) => setLocation(e.target.value)}
						placeholder="如 越南·北宁"
						className="min-w-0 flex-1 rounded-[6px] bg-[#F5F5F5] px-2 py-[6px] text-[15px] text-black outline-none"
					/>
				</label>
				<div className="mt-2 text-[13px] text-black/40">点赞</div>
				<div className="mt-1 flex max-h-[72px] flex-wrap gap-1.5 overflow-auto">
					{people.map((p) => (
						<button
							key={p.id}
							type="button"
							aria-label={`点赞 ${p.name}`}
							aria-pressed={likes.has(p.id)}
							onClick={() => toggleLike(p.id)}
							className={`rounded-full px-2.5 py-[3px] text-[13px] ${likes.has(p.id) ? "bg-[#07C160] text-white" : "bg-[#F5F5F5]"}`}
						>
							{p.name}
						</button>
					))}
				</div>
				<div className="mt-2 text-[13px] text-black/40">评论</div>
				<div className="mt-1 space-y-2">
					{comments.map((c, i) => (
						<div key={c.id} className="rounded-[6px] border border-black/10 p-2">
							<div className="flex items-center gap-2">
								<select
									aria-label="评论人"
									value={c.from}
									onChange={(e) =>
										setComments((prev) =>
											prev.map((x, k) => (k === i ? { ...x, from: e.target.value } : x)),
										)
									}
									className="min-w-0 flex-1 rounded-[6px] bg-[#F5F5F5] px-2 py-1 text-[14px]"
								>
									{people.map((p) => (
										<option key={p.id} value={p.id}>
											{p.name}
										</option>
									))}
								</select>
								<button
									type="button"
									aria-label="删除评论"
									className="text-[#FA5151] text-[13px]"
									onClick={() => setComments((prev) => prev.filter((_, k) => k !== i))}
								>
									删除
								</button>
							</div>
							<input
								aria-label="评论内容"
								value={c.text}
								onChange={(e) =>
									setComments((prev) =>
										prev.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)),
									)
								}
								className={`${inputCls} mt-2`}
							/>
						</div>
					))}
					<button
						type="button"
						className="rounded-[6px] border border-black/15 px-3 py-1.5 text-[14px]"
						onClick={() =>
							setComments((prev) => [
								...prev,
								{
									id: nanoid(8),
									from: people.find((p) => p.id !== MYSELF_ID)?.id ?? MYSELF_ID,
									reply: "",
									text: "",
								},
							])
						}
					>
						添加评论
					</button>
				</div>
			</div>
			<div className="flex items-end gap-2 border-black/10 border-t bg-[#F7F7F7] px-3 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))]">
				<textarea
					rows={1}
					aria-label="对 AI 说"
					value={input}
					disabled={!hasKey}
					placeholder="跟 AI 说点什么…"
					onChange={(e) => setInput(e.target.value)}
					className="max-h-[88px] min-h-[40px] flex-1 resize-none rounded-[6px] bg-white px-3 py-[9px] text-[16px] leading-[22px] outline-none"
				/>
				<button
					type="button"
					disabled={busy || adding || !hasKey || !input.trim()}
					onClick={() => void send()}
					className="h-10 shrink-0 rounded-[6px] bg-[#07C160] px-4 text-[16px] text-white disabled:opacity-40"
				>
					发送
				</button>
			</div>
		</div>
	);

	if (host) return createPortal(page, host);
	return <div className="fixed inset-0 z-[40]">{page}</div>;
};

export default MomentComposer;
