import { h } from "@/components/HashAssets";
import { saveImage } from "@/components/SheetKit";
import { MYSELF_ID } from "@/faker/wechat/user";
import { geminiConfigAtom } from "@/stateV2/gemini";
import { type IFeedComment, type IStateFeed, setFeedListValue } from "@/stateV2/moments";
import { getAllProfilesValueSnapshot } from "@/stateV2/profile";
import { type GeminiImage, callGemini, fileToGeminiImage, parseJsonLoose } from "@/utils/gemini";
import dayjs from "dayjs";
import { useAtomValue } from "jotai";
import { nanoid } from "nanoid";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

type Raw = {
	userId?: string;
	text?: string;
	at?: string;
	location?: string;
	likes?: string[];
	comments?: { from?: string; text?: string; replyTo?: string }[];
	hasPhotos?: boolean;
};

/** 朋友圈一次最多 9 张，和微信图片格一致 */
const MAX_PHOTOS = 9;

type MomentPhoto = { hash: string; img: GeminiImage };

const para = (text: string) => [{ type: "paragraph", children: [{ text }] }] as never;

/** 压成最长边 1600 的 JPEG 再写入 HashAssetsDB，避免把原图塞进 localStorage */
async function storeMomentPhoto(file: File): Promise<MomentPhoto> {
	const img = await fileToGeminiImage(file);
	const binary = atob(img.data);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	const hash = await saveImage(new File([bytes], "moment.jpg", { type: "image/jpeg" }));
	return { hash, img };
}

function momentPrompt(wish: string, names: string, nowLabel: string, weekdayLabel: string, photoCount: number) {
	const photoRule =
		photoCount > 0
			? `\n6. 用户按顺序上传了 ${photoCount} 张照片（已附在这次请求里，第 1 张到第 ${photoCount} 张）。这些照片只属于一条动态：给那一条加上 "hasPhotos": true（只能有一条）。没指定这条由谁发时，userId 用我自己。它的 at 最接近现在，但不得晚于 ${nowLabel}。text 要结合照片里能看到的内容来写，不要编造照片里明显没有的具体事物。其他条不要写 hasPhotos。不要在 JSON 里写图片地址。`
			: "";
	return `你在为微信朋友圈界面生成动态。
现在的真实时间：${weekdayLabel}
可用的人物（id | 名字 | 描述），发布者、点赞者、评论者只能从这里选，id 必须原样照抄：
${names}

用户的要求：${wish}

规则：
1. 按用户要求的人物、条数、主题生成；没指定发布者就挑合适的人，没指定条数就 3 条。
2. 每条有 at（"YYYY-MM-DD HH:mm"），必须早于现在，绝对不能晚于 ${nowLabel}；多条要分散在不同时间。
3. text 是朋友圈正文，口语化、像真人发的，可含少量 emoji；location 可选。
4. likes 是点赞人 id 数组（0~6 个）；comments 是评论数组 {from, text, replyTo?}，from/replyTo 为人物 id，0~3 条，符合各自身份。
5. 只输出 JSON 数组：[{"userId":"...","text":"...","at":"2026-01-02 10:00","location":"","likes":["id"],"comments":[{"from":"id","text":"..."}]}]${photoRule}`;
}

async function requestMoments(prompt: string, images?: GeminiImage[]) {
	const list = parseJsonLoose<Raw[]>(
		await callGemini(prompt, { json: true, ...(images?.length ? { images } : {}) }),
	);
	if (!Array.isArray(list) || list.length === 0) throw new Error("没有生成出内容，换个说法再试一次");
	return list;
}

export async function generateMoments(wish: string, photos: MomentPhoto[] = []) {
	const profiles = getAllProfilesValueSnapshot();
	const names = profiles
		.slice(0, 60)
		.map(
			(p) =>
				`${p.id} | ${p.id === MYSELF_ID ? "我自己" : p.remark || p.nickname}${p.description ? ` | ${p.description}` : ""}`,
		)
		.join("\n");
	const now = dayjs();
	const nowLabel = now.format("YYYY-MM-DD HH:mm");
	const weekdayLabel = now.format("YYYY-MM-DD HH:mm dddd");
	const promptFor = (count: number) => momentPrompt(wish, names, nowLabel, weekdayLabel, count);
	let list: Raw[];
	try {
		list = await requestMoments(promptFor(photos.length), photos.length ? photos.map((p) => p.img) : undefined);
	} catch (e) {
		if (!photos.length) throw e;
		list = await requestMoments(promptFor(0));
	}
	const valid = new Set(profiles.map((p) => p.id));
	const nowTs = Date.now();
	const rows = list.filter((r) => r?.text);
	const feeds: IStateFeed[] = rows.map((r, i) => {
		const d = r.at ? dayjs(r.at) : null;
		let ts = d?.isValid() ? d.valueOf() : nowTs - (i + 1) * 3_600_000;
		if (ts > nowTs) ts = nowTs - (i + 1) * 60_000;
		const comments: IFeedComment[] = (r.comments ?? [])
			.filter((c) => c?.text && c.from && valid.has(c.from))
			.map((c, j) => ({
				id: nanoid(8),
				text: para(String(c.text)),
				fromUserId: c.from as string,
				replyUserId: c.replyTo && valid.has(c.replyTo) ? c.replyTo : undefined,
				sendTimestamp: Math.min(nowTs, ts + (j + 1) * 5 * 60_000),
			}));
		return {
			id: nanoid(8),
			userId: r.userId && valid.has(r.userId) ? r.userId : MYSELF_ID,
			sendTimestamp: ts,
			content: { type: "text", text: para(String(r.text)) },
			likeUserIds: (r.likes ?? []).filter((id) => valid.has(id)),
			comments,
			location: r.location || undefined,
		} as IStateFeed;
	});
	if (photos.length && feeds.length) {
		let idx = rows.findIndex((r) => r.hasPhotos === true);
		if (idx < 0) idx = feeds.reduce((best, f, i) => (f.sendTimestamp >= feeds[best].sendTimestamp ? i : best), 0);
		const cur = feeds[idx];
		feeds[idx] = {
			...cur,
			content: { type: "textWithImages", text: cur.content.text, imagesInfo: photos.map((p) => p.hash) },
		};
	}
	return feeds.sort((a, b) => b.sendTimestamp - a.sendTimestamp);
}

const AiMoments = () => {
	const gemini = useAtomValue(geminiConfigAtom);
	const navigate = useNavigate();
	const fileRef = useRef<HTMLInputElement>(null);
	const [open, setOpen] = useState(false);
	const [wish, setWish] = useState("");
	const [photos, setPhotos] = useState<MomentPhoto[]>([]);
	const [adding, setAdding] = useState(false);
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState("");

	const addPhotos = async (list: FileList | null) => {
		const incoming = Array.from(list ?? []);
		if (!incoming.length || adding) return;
		const room = MAX_PHOTOS - photos.length;
		if (room <= 0) {
			setErr("最多 9 张图片");
			return;
		}
		const batch = incoming.slice(0, room);
		const overflow = incoming.length > room;
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
			setPhotos((prev) => [...prev, ...prepared].slice(0, MAX_PHOTOS));
			if (overflow) setErr("最多 9 张图片");
			else if (failed) setErr(prepared.length ? "有图片读取失败，已跳过" : "图片读取失败");
			else setErr("");
		} finally {
			setAdding(false);
		}
	};

	const run = async () => {
		if (!wish.trim() && photos.length === 0) {
			setErr("先写一下想要什么样的朋友圈");
			return;
		}
		setBusy(true);
		setErr("");
		try {
			const feeds = await generateMoments(wish.trim() ? wish : "根据我上传的照片发一条朋友圈", photos);
			setFeedListValue((prev) => [...feeds, ...prev]);
			setOpen(false);
			setWish("");
			setPhotos([]);
		} catch (e) {
			setErr(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	};

	return (
		<>
			<div className="flex justify-end px-4 pb-2">
				<button type="button" onClick={() => setOpen(true)} className="h-8 rounded-full bg-[#07C160] px-4 text-[14px] text-white">
					AI 生成朋友圈
				</button>
			</div>
			{open && (
				<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => !busy && setOpen(false)}>
					<div className="max-h-[90vh] overflow-y-auto rounded-t-[12px] bg-white p-4 pb-[calc(16px+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
						<div className="mb-2 font-medium text-[16px]">AI 生成朋友圈</div>
						{!(gemini.apiKey || gemini.apiKey2) ? (
							<button type="button" onClick={() => navigate("/wechat/my/settings/ai/key")} className="h-[44px] w-full rounded-[6px] bg-[#07C160] text-[16px] text-white">
								还没填密钥，去填写
							</button>
						) : (
							<>
								<div className="mb-2 text-[12px] text-black/50 leading-5">
									发布者、点赞和评论的人都从你现有的好友里选，时间不会晚于现在。可以上传 1-9 张照片，按选择顺序出现在其中一条动态里。
								</div>
								<textarea
									className="h-[110px] w-full resize-none rounded-[8px] bg-[#F5F5F5] p-3 text-[16px] outline-none"
									placeholder="例：让三个好友各发一条周末出游的朋友圈，我给其中一条评论；再给我自己发一条加班吐槽"
									value={wish}
									onChange={(e) => setWish(e.target.value)}
								/>
								<div className="mt-3">
									<button
										type="button"
										disabled={busy || adding || photos.length >= MAX_PHOTOS}
										onClick={() => fileRef.current?.click()}
										className="h-[44px] rounded-[6px] bg-black/5 px-4 text-[16px] disabled:opacity-50"
									>
										{adding ? "处理中…" : photos.length ? `上传图片（${photos.length}/9）` : "上传图片"}
									</button>
									<input
										ref={fileRef}
										type="file"
										accept="image/*"
										multiple
										className="hidden"
										onChange={(e) => {
											void addPhotos(e.target.files);
											e.target.value = "";
										}}
									/>
								</div>
								{photos.length > 0 && (
									<div className="mt-2 flex flex-wrap gap-2">
										{photos.map((p, i) => (
											<div key={`${p.hash}-${i}`} className="relative h-[64px] w-[64px]">
												<h.img src={p.hash} alt="" className="h-full w-full rounded-[4px] object-cover" />
												<button
													type="button"
													aria-label="删除图片"
													disabled={busy}
													className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-black/70 text-[12px] text-white"
													onClick={() => setPhotos((prev) => prev.filter((_, k) => k !== i))}
												>
													×
												</button>
											</div>
										))}
									</div>
								)}
								{err && <div className="mt-3 rounded-[6px] bg-[#FBE9E9] p-2 text-[13px] text-[#C62828] leading-5">{err}</div>}
								<div className="mt-3 flex gap-3">
									<button type="button" disabled={busy} onClick={() => setOpen(false)} className="h-[44px] flex-1 rounded-[6px] bg-black/5 text-[16px]">取消</button>
									<button type="button" disabled={busy || adding} onClick={run} className="h-[44px] flex-1 rounded-[6px] bg-[#07C160] text-[16px] text-white disabled:opacity-50">{busy ? "生成中…" : "生成并发布"}</button>
								</div>
							</>
						)}
					</div>
				</div>
			)}
		</>
	);
};

export default AiMoments;
