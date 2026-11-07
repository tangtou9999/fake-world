import { MYSELF_ID } from "@/faker/wechat/user";
import { geminiConfigAtom } from "@/stateV2/gemini";
import { type IFeedComment, type IStateFeed, setFeedListValue } from "@/stateV2/moments";
import { getAllProfilesValueSnapshot } from "@/stateV2/profile";
import { callGemini, parseJsonLoose } from "@/utils/gemini";
import dayjs from "dayjs";
import { useAtomValue } from "jotai";
import { nanoid } from "nanoid";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

type Raw = {
	userId?: string;
	text?: string;
	at?: string;
	location?: string;
	likes?: string[];
	comments?: { from?: string; text?: string; replyTo?: string }[];
};

const para = (text: string) => [{ type: "paragraph", children: [{ text }] }] as never;

export async function generateMoments(wish: string) {
	const profiles = getAllProfilesValueSnapshot();
	const names = profiles
		.slice(0, 60)
		.map(
			(p) =>
				`${p.id} | ${p.id === MYSELF_ID ? "我自己" : p.remark || p.nickname}${p.description ? ` | ${p.description}` : ""}`,
		)
		.join("\n");
	const now = dayjs();
	const prompt = `你在为微信朋友圈界面生成动态。
现在的真实时间：${now.format("YYYY-MM-DD HH:mm dddd")}
可用的人物（id | 名字 | 描述），发布者、点赞者、评论者只能从这里选，id 必须原样照抄：
${names}

用户的要求：${wish}

规则：
1. 按用户要求的人物、条数、主题生成；没指定发布者就挑合适的人，没指定条数就 3 条。
2. 每条有 at（"YYYY-MM-DD HH:mm"），必须早于现在，绝对不能晚于 ${now.format("YYYY-MM-DD HH:mm")}；多条要分散在不同时间。
3. text 是朋友圈正文，口语化、像真人发的，可含少量 emoji；location 可选。
4. likes 是点赞人 id 数组（0~6 个）；comments 是评论数组 {from, text, replyTo?}，from/replyTo 为人物 id，0~3 条，符合各自身份。
5. 只输出 JSON 数组：[{"userId":"...","text":"...","at":"2026-01-02 10:00","location":"","likes":["id"],"comments":[{"from":"id","text":"..."}]}]`;
	const list = parseJsonLoose<Raw[]>(await callGemini(prompt, { json: true }));
	if (!Array.isArray(list) || list.length === 0) throw new Error("没有生成出内容，换个说法再试一次");
	const valid = new Set(profiles.map((p) => p.id));
	const nowTs = Date.now();
	const feeds: IStateFeed[] = list
		.filter((r) => r?.text)
		.map((r, i) => {
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
		})
		.sort((a, b) => b.sendTimestamp - a.sendTimestamp);
	return feeds;
}

const AiMoments = () => {
	const gemini = useAtomValue(geminiConfigAtom);
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [wish, setWish] = useState("");
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState("");

	const run = async () => {
		if (!wish.trim()) {
			setErr("先写一下想要什么样的朋友圈");
			return;
		}
		setBusy(true);
		setErr("");
		try {
			const feeds = await generateMoments(wish);
			setFeedListValue((prev) => [...feeds, ...prev]);
			setOpen(false);
			setWish("");
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
					<div className="rounded-t-[12px] bg-white p-4 pb-[calc(16px+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
						<div className="mb-2 font-medium text-[16px]">AI 生成朋友圈</div>
						{!(gemini.apiKey || gemini.apiKey2) ? (
							<button type="button" onClick={() => navigate("/wechat/my/settings/ai/key")} className="h-[44px] w-full rounded-[6px] bg-[#07C160] text-[16px] text-white">
								还没填密钥，去填写
							</button>
						) : (
							<>
								<div className="mb-2 text-[12px] text-black/50 leading-5">
									发布者、点赞和评论的人都从你现有的好友里选，时间不会晚于现在。目前只生成文字动态（不含图片）。
								</div>
								<textarea
									className="h-[110px] w-full resize-none rounded-[8px] bg-[#F5F5F5] p-3 text-[16px] outline-none"
									placeholder="例：让三个好友各发一条周末出游的朋友圈，我给其中一条评论；再给我自己发一条加班吐槽"
									value={wish}
									onChange={(e) => setWish(e.target.value)}
								/>
								{err && <div className="mt-3 rounded-[6px] bg-[#FBE9E9] p-2 text-[13px] text-[#C62828] leading-5">{err}</div>}
								<div className="mt-3 flex gap-3">
									<button type="button" disabled={busy} onClick={() => setOpen(false)} className="h-[44px] flex-1 rounded-[6px] bg-black/5 text-[16px]">取消</button>
									<button type="button" disabled={busy} onClick={run} className="h-[44px] flex-1 rounded-[6px] bg-[#07C160] text-[16px] text-white disabled:opacity-50">{busy ? "生成中…" : "生成并发布"}</button>
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
