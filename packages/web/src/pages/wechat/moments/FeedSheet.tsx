import { h } from "@/components/HashAssets";
import { hashAssetsDB } from "@/db";
import { MYSELF_ID } from "@/faker/wechat/user";
import { type IFeedComment, type IStateFeed, getFeedListValueSnapshot, setFeedListValue } from "@/stateV2/moments";
import { getAllProfilesValueSnapshot } from "@/stateV2/profile";
import { getFileMD5 } from "@/utils";
import { slateToPlain, textToSlateChildren } from "@/wechatComponents/SlateText/emojiNames";
import dayjs from "dayjs";
import { nanoid } from "nanoid";
import { useMemo, useRef, useState } from "react";

const FMT = "YYYY-MM-DDTHH:mm";
const inputCls = "w-full rounded-[6px] bg-[#F5F5F5] px-3 py-[7px] text-[16px] outline-none";
const toSlate = (text: string) => text.split("\n").map((line) => ({ type: "paragraph", children: textToSlateChildren(line) })) as never;
const toPlain = (nodes?: unknown[]) => (nodes ?? []).map((n) => slateToPlain(n as never)).join("\n");

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
	<div className="flex items-start gap-3 border-black/5 border-b py-2">
		<div className="w-[72px] shrink-0 pt-[7px] text-[14px] text-black/50">{label}</div>
		<div className="min-w-0 flex-1">{children}</div>
	</div>
);

/** 手机端「编辑朋友圈」：发布者、时间、正文、位置、图片、点赞、评论都在这里改；feedId 为空 = 发一条新的 */
const FeedSheet = ({ feedId, onClose }: { feedId?: string; onClose: () => void }) => {
	const profiles = useMemo(() => getAllProfilesValueSnapshot(), []);
	const nameOf = (id: string) => (id === MYSELF_ID ? "我" : profiles.find((p) => p.id === id)?.remark || profiles.find((p) => p.id === id)?.nickname || id);
	const feed = feedId ? getFeedListValueSnapshot().find((f) => f.id === feedId) : undefined;
	const fileRef = useRef<HTMLInputElement>(null);
	const [d, setD] = useState(() => ({
		userId: feed?.userId ?? MYSELF_ID,
		at: dayjs(feed?.sendTimestamp ?? Date.now()).format(FMT),
		text: toPlain(feed?.content.text as unknown[] | undefined),
		location: feed?.location ?? "",
		images: feed?.content.type === "textWithImages" ? [...feed.content.imagesInfo] : ([] as string[]),
		likes: new Set<string>(feed?.likeUserIds ?? []),
		comments: (feed?.comments ?? []).map((c) => ({ id: c.id, from: c.fromUserId, reply: c.replyUserId ?? "", text: toPlain(c.text as unknown[]), ts: c.sendTimestamp })),
	}));
	const isVideo = feed?.content.type === "video";
	const set = (p: Partial<typeof d>) => setD((v) => ({ ...v, ...p }));

	const addImages = async (files: FileList | null) => {
		if (!files) return;
		const next = [...d.images];
		for (const f of Array.from(files).slice(0, 9 - next.length)) {
			const hash = await getFileMD5(f);
			await hashAssetsDB.images.put({ id: hash, file: f });
			next.push(hash);
		}
		set({ images: next });
	};

	const save = () => {
		const ts = Math.min(dayjs(d.at).valueOf() || Date.now(), Date.now());
		const comments: IFeedComment[] = d.comments
			.filter((c) => c.text.trim())
			.map((c, i) => ({ id: c.id, fromUserId: c.from, replyUserId: c.reply || undefined, text: toSlate(c.text), sendTimestamp: c.ts || Math.min(ts + (i + 1) * 5 * 60_000, Date.now()) }));
		const base = {
			userId: d.userId,
			sendTimestamp: ts,
			location: d.location.trim() || undefined,
			likeUserIds: [...d.likes],
			comments,
		};
		const text = d.text.trim() ? toSlate(d.text) : undefined;
		setFeedListValue((prev) => {
			const content: IStateFeed["content"] = isVideo && feed ? ({ ...feed.content, text } as IStateFeed["content"]) : d.images.length ? { type: "textWithImages", text, imagesInfo: d.images } : { type: "text", text: text ?? toSlate("") };
			const item: IStateFeed = { id: feed?.id ?? nanoid(8), ...base, content };
			const list = feed ? prev.map((f) => (f.id === feed.id ? item : f)) : [item, ...prev];
			return [...list].sort((a, b) => b.sendTimestamp - a.sendTimestamp);
		});
		onClose();
	};

	const remove = () => {
		if (!feed || !window.confirm("删除这条朋友圈？")) return;
		setFeedListValue((prev) => prev.filter((f) => f.id !== feed.id));
		onClose();
	};

	const people = profiles.map((p) => p.id);
	const select = (value: string, onChange: (v: string) => void, withEmpty?: string) => (
		<select value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 rounded-[6px] bg-[#F5F5F5] px-2 py-[7px] text-[15px]">
			{withEmpty !== undefined && <option value="">{withEmpty}</option>}
			{people.map((id) => (
				<option key={id} value={id}>{nameOf(id)}</option>
			))}
		</select>
	);

	return (
		<div className="fixed inset-0 z-[1100] flex flex-col justify-end bg-black/40" onClick={onClose}>
			<div className="flex max-h-[90%] flex-col rounded-t-[14px] bg-white pb-[env(safe-area-inset-bottom)]" onClick={(e) => e.stopPropagation()}>
				<div className="flex h-12 shrink-0 items-center justify-between border-black/5 border-b px-4">
					<button type="button" className="text-[16px] text-black/60" onClick={onClose}>取消</button>
					<div className="font-medium text-[16px]">{feed ? "编辑朋友圈" : "发朋友圈"}</div>
					<button type="button" className="font-medium text-[16px] text-[#07C160]" onClick={save}>{feed ? "保存" : "发表"}</button>
				</div>
				<div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
					<Row label="发布人">{select(d.userId, (v) => set({ userId: v }))}</Row>
					<Row label="发布时间"><input aria-label="发布时间" type="datetime-local" value={d.at} onChange={(e) => set({ at: e.target.value })} className={inputCls} /></Row>
					<Row label="正文"><textarea aria-label="朋友圈正文" value={d.text} onChange={(e) => set({ text: e.target.value })} className={`${inputCls} h-[110px] resize-none leading-6`} placeholder="表情写成 [微笑] 这样" /></Row>
					<Row label="位置"><input aria-label="位置" value={d.location} onChange={(e) => set({ location: e.target.value })} placeholder="如 南京·玄武湖" className={inputCls} /></Row>
					{isVideo ? (
						<Row label="视频"><div className="pt-[7px] text-[13px] text-black/40">视频不能在这里替换</div></Row>
					) : (
						<Row label="图片">
							<div className="flex flex-wrap gap-2">
								{d.images.map((src, i) => (
									<div key={`${src}-${i}`} className="relative h-[64px] w-[64px]">
										<h.img src={src} className="h-full w-full rounded-[4px] object-cover" />
										<button type="button" aria-label="删除图片" className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-black/70 text-[12px] text-white" onClick={() => set({ images: d.images.filter((_, k) => k !== i) })}>×</button>
									</div>
								))}
								{d.images.length < 9 && (
									<button type="button" aria-label="添加图片" className="h-[64px] w-[64px] rounded-[4px] bg-[#F5F5F5] text-[28px] text-black/30" onClick={() => fileRef.current?.click()}>+</button>
								)}
								<input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void addImages(e.target.files); e.target.value = ""; }} />
							</div>
						</Row>
					)}
					<Row label="点赞">
						<div className="flex max-h-[120px] flex-wrap gap-2 overflow-auto">
							{people.map((id) => (
								<button key={id} type="button" onClick={() => { const s = new Set(d.likes); s.has(id) ? s.delete(id) : s.add(id); set({ likes: s }); }} className={`rounded-full px-3 py-[4px] text-[14px] ${d.likes.has(id) ? "bg-[#07C160] text-white" : "bg-[#F5F5F5]"}`}>{nameOf(id)}</button>
							))}
						</div>
					</Row>
					<Row label="评论">
						<div className="space-y-2">
							{d.comments.map((c, i) => (
								<div key={c.id} className="rounded-[6px] border border-black/10 p-2">
									<div className="flex items-center gap-2 text-[14px]">
										{select(c.from, (v) => set({ comments: d.comments.map((x, k) => (k === i ? { ...x, from: v } : x)) }))}
										<span className="text-black/40">回复</span>
										{select(c.reply, (v) => set({ comments: d.comments.map((x, k) => (k === i ? { ...x, reply: v } : x)) }), "（无）")}
										<button type="button" aria-label="删除评论" className="ml-auto text-[#FA5151]" onClick={() => set({ comments: d.comments.filter((_, k) => k !== i) })}>删除</button>
									</div>
									<input aria-label="评论内容" value={c.text} onChange={(e) => set({ comments: d.comments.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })} className={`${inputCls} mt-2`} placeholder="评论内容" />
								</div>
							))}
							<button type="button" className="rounded-[6px] border border-black/15 px-3 py-2 text-[14px]" onClick={() => set({ comments: [...d.comments, { id: nanoid(8), from: people.find((p) => p !== d.userId) ?? MYSELF_ID, reply: "", text: "", ts: 0 }] })}>
								+ 添加评论
							</button>
						</div>
					</Row>
					{feed && <button type="button" className="mt-3 rounded-[6px] border border-[#FA5151] px-4 py-2 text-[14px] text-[#FA5151]" onClick={remove}>删除这条朋友圈</button>}
				</div>
			</div>
		</div>
	);
};

export default FeedSheet;
