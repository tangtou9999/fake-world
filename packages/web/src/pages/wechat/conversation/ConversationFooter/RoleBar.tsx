import { FILE_HELPER_ID } from "@/faker/wechat/user/fileHelper";
import {
	EConversationType,
	type TConversationItem,
	type TConversationRole,
	fromLastGenerateUpperText,
	inputterConfigAtom,
	setConversationListValue,
} from "@/stateV2/conversation";
import { touchDialogue } from "@/stateV2/fileHelper";
import { geminiConfigAtom } from "@/stateV2/gemini";
import { fileToGeminiImage } from "@/utils/gemini";
import { type ParsedItem, applyParsedItems, generateScript, parseScreenshots, previewLine } from "./importScreenshots";
import { useNavigate } from "react-router-dom";
import { SLATE_INITIAL_VALUE } from "@/wechatComponents/SlateText/utils";
import dayjs from "dayjs";
import { useAtom, useAtomValue } from "jotai";
import { nanoid } from "nanoid";
import { useState } from "react";
import useMode from "@/components/useMode";
import { useConversationAPI } from "../context";

const PREFIX = /^\s*(我|对方|他|她|friend|me)\s*[:：]\s*/i;

const RoleBar = () => {
	const { conversationId, scrollConversationListToBtm } = useConversationAPI();
	const [config, setConfig] = useAtom(inputterConfigAtom);
	const [open, setOpen] = useState(false);
	const [text, setText] = useState("");
	const { isEdit } = useMode();
	const navigate = useNavigate();
	const gemini = useAtomValue(geminiConfigAtom);
	const [aiOpen, setAiOpen] = useState(false);
	const [scene, setScene] = useState("");
	const [aiBusy, setAiBusy] = useState(false);
	const [aiErr, setAiErr] = useState("");
	const [aiTab, setAiTab] = useState<"scene" | "shots">("scene");
	const [shots, setShots] = useState<File[]>([]);
	const [replace, setReplace] = useState(false);
	const [aiDone, setAiDone] = useState("");
	const [preview, setPreview] = useState<ParsedItem[] | null>(null);
	if (!isEdit || conversationId === FILE_HELPER_ID) return null;

	const roleBtn = (role: TConversationRole, label: string) => (
		<button
			type="button"
			onClick={() => setConfig((v) => ({ ...v, sendRole: role }))}
			className={`h-7 rounded-full px-4 text-[14px] ${config.sendRole === role ? "bg-[#07C160] text-white" : "bg-black/5 text-black/60"}`}
		>
			{label}
		</button>
	);

	const importShots = async () => {
		if (shots.length === 0) return;
		setAiBusy(true);
		setAiErr("");
		setAiDone("");
		try {
			const images = await Promise.all(shots.map((f) => fileToGeminiImage(f)));
			const list = await parseScreenshots(images);
			const n = applyParsedItems(conversationId, list, replace);
			setAiDone(`已复刻 ${n} 条消息${replace ? "（已替换原聊天）" : "（已追加到聊天末尾）"}`);
			setShots([]);
			scrollConversationListToBtm();
		} catch (e) {
			setAiErr(e instanceof Error ? e.message : String(e));
		} finally {
			setAiBusy(false);
		}
	};

	const generate = async () => {
		if (!scene.trim()) {
			setAiErr("先写一下剧本或场景");
			return;
		}
		setAiBusy(true);
		setAiErr("");
		try {
			setPreview(await generateScript(conversationId, scene));
		} catch (e) {
			setAiErr(e instanceof Error ? e.message : String(e));
		} finally {
			setAiBusy(false);
		}
	};

	const applyPreview = (rep: boolean) => {
		if (!preview) return;
		const n = applyParsedItems(conversationId, preview, rep, true);
		setAiDone(`已${rep ? "替换为" : "追加"} ${n} 条消息`);
		setPreview(null);
		setScene("");
		setAiErr("");
		setAiOpen(false);
		scrollConversationListToBtm();
	};

	const sendAll = () => {
		let role: TConversationRole = config.sendRole;
		const items: { role: TConversationRole; text: string }[] = [];
		for (const raw of text.split("\n")) {
			if (!raw.trim()) continue;
			const m = raw.match(PREFIX);
			if (m) role = /^(我|me)$/i.test(m[1]) ? "mine" : "friend";
			const body = raw.replace(PREFIX, "").trim();
			if (body) items.push({ role, text: body });
		}
		if (items.length === 0) return;
		const now = dayjs().valueOf();
		setConversationListValue(conversationId, (prev) => [
			...prev,
			...items.map(
				(it, i) =>
					({
						type: EConversationType.text,
						role: it.role,
						id: nanoid(8),
						textContent: [{ type: "paragraph", children: [{ text: it.text }] }],
						sendTimestamp: now + i,
						upperText: i === 0 ? fromLastGenerateUpperText(prev) : undefined,
					}) as unknown as TConversationItem,
			),
		]);
		touchDialogue(conversationId, items[items.length - 1].text);
		void SLATE_INITIAL_VALUE;
		setText("");
		setOpen(false);
		scrollConversationListToBtm();
	};

	return (
		<>
			<div className="flex items-center gap-2 bg-[#F7F7F7] px-3 pt-2">
				<span className="text-[13px] text-black/40">发送人</span>
				{roleBtn("mine", "我")}
				{roleBtn("friend", "对方")}
				<button
					type="button"
					onClick={() => { setPreview(null); setAiErr(""); setAiDone(""); setAiOpen(true); }}
					className="ml-auto h-7 rounded-full bg-[#07C160]/10 px-3 text-[14px] text-[#07C160]"
				>
					AI 生成
				</button>
				<button
					type="button"
					onClick={() => navigate(`/wechat/my/settings/ai/chat?from=${conversationId}`)}
					className="h-7 rounded-full bg-[#07C160]/10 px-3 text-[14px] text-[#07C160]"
				>
					AI 对话
				</button>
				<button
					type="button"
					onClick={() => setOpen(true)}
					className="h-7 rounded-full bg-black/5 px-3 text-[14px] text-black/70"
				>
					批量输入
				</button>
			</div>
			{aiOpen && (
				<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => !aiBusy && setAiOpen(false)}>
					<div className="rounded-t-[12px] bg-white p-4 pb-[calc(16px+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
						<div className="mb-2 font-medium text-[16px]">AI 生成聊天记录</div>
						{!gemini.apiKey ? (
							<>
								<div className="mb-4 text-[14px] text-black/60 leading-6">还没有填 Gemini 密钥，请先到「我 → 设置 → AI 助手」填写。</div>
								<button type="button" onClick={() => navigate("/wechat/my/settings/ai/key")} className="h-[44px] w-full rounded-[6px] bg-[#07C160] text-[16px] text-white">
									去填写密钥
								</button>
							</>
						) : (
							<>
								<div className="mb-3 flex rounded-[8px] bg-black/5 p-[3px] text-[14px]">
									{(
										[
											["scene", "按场景生成"],
											["shots", "截图复刻"],
										] as const
									).map(([k, label]) => (
										<button key={k} type="button" onClick={() => { setAiTab(k); setAiErr(""); setAiDone(""); }} className={`h-8 flex-1 rounded-[6px] ${aiTab === k ? "bg-white font-medium shadow-sm" : "text-black/60"}`}>
											{label}
										</button>
									))}
								</div>
								{aiTab === "shots" ? (
									<>
										<div className="mb-2 text-[12px] text-black/50 leading-5">
											从相册选多张聊天截图（按时间从早到晚选），AI 会按左右气泡、时间、红包、转账原样复刻到当前聊天。图片、表情、视频无法复刻，会变成「[图片]」这样的文字。
										</div>
										<label className="flex h-[88px] cursor-pointer flex-col items-center justify-center rounded-[8px] border border-black/20 border-dashed text-[14px] text-black/60">
											{shots.length ? `已选 ${shots.length} 张，点此重新选择` : "点此从相册选择截图（可多选）"}
											<input type="file" accept="image/*" multiple hidden onChange={(e) => { setShots(Array.from(e.target.files ?? []).slice(0, 12)); setAiDone(""); e.target.value = ""; }} />
										</label>
										<div className="mt-3 flex gap-4 text-[14px]">
											<label className="flex items-center gap-1"><input type="radio" checked={!replace} onChange={() => setReplace(false)} />追加到末尾</label>
											<label className="flex items-center gap-1"><input type="radio" checked={replace} onChange={() => setReplace(true)} />清空后替换</label>
										</div>
										{aiErr && <div className="mt-3 rounded-[6px] bg-[#FBE9E9] p-2 text-[13px] text-[#C62828] leading-5">{aiErr}<button type="button" className="mt-1 block text-[#576B95]" onClick={() => navigate("/wechat/my/settings/ai/key")}>去换模型 / 改密钥 ›</button></div>}
										{aiDone && <div className="mt-3 rounded-[6px] bg-[#E6F6EC] p-2 text-[13px] text-[#0a7a3c] leading-5">{aiDone}</div>}
										<div className="mt-3 flex gap-3">
											<button type="button" disabled={aiBusy} onClick={() => setAiOpen(false)} className="h-[44px] flex-1 rounded-[6px] bg-black/5 text-[16px]">
												{aiDone ? "完成" : "取消"}
											</button>
											<button type="button" disabled={aiBusy || shots.length === 0} onClick={importShots} className="h-[44px] flex-1 rounded-[6px] bg-[#07C160] text-[16px] text-white disabled:opacity-50">
												{aiBusy ? "识别中…" : "识别并复刻"}
											</button>
										</div>
									</>
								) : (
								<>
								{preview ? (
									<>
										<div className="mb-2 text-[12px] text-black/50 leading-5">
											共 {preview.length} 条，时间都不会晚于现在。确认后再放进聊天。
										</div>
										<div className="max-h-[300px] space-y-1 overflow-auto rounded-[8px] bg-[#F5F5F5] p-3 text-[14px] leading-5">
											{preview.map((it, i) => (
												<div key={i}>{previewLine(it)}</div>
											))}
										</div>
										<div className="mt-3 grid grid-cols-3 gap-2">
											<button type="button" onClick={generate} disabled={aiBusy} className="h-[44px] rounded-[6px] bg-black/5 text-[15px] disabled:opacity-50">{aiBusy ? "生成中…" : "重新生成"}</button>
											<button type="button" onClick={() => applyPreview(true)} className="h-[44px] rounded-[6px] bg-black/5 text-[15px]">清空替换</button>
											<button type="button" onClick={() => applyPreview(false)} className="h-[44px] rounded-[6px] bg-[#07C160] text-[15px] text-white">追加到末尾</button>
										</div>
										<button type="button" className="mt-2 w-full text-[13px] text-black/50" onClick={() => setPreview(null)}>返回修改剧本</button>
									</>
								) : (
								<>
								<div className="mb-2 text-[12px] text-black/50 leading-5">
									像写剧本一样描述：谁说几句、停顿多久、新的时间点、谁发红包/转账、外语消息都行。AI 会按剧本执行，时间不会晚于现在。
								</div>
								{scene && (
									<button type="button" className="mb-1 ml-auto block text-[13px] text-[#576B95]" onClick={() => setScene("")}>
										清空
									</button>
								)}
								<textarea
									className="h-[130px] w-full resize-none rounded-[8px] bg-[#F5F5F5] p-3 text-[16px] outline-none"
									placeholder="例：对方说两句催我交周报，我回一句，停顿两小时，对方又说一句，最后我发一个 66 元红包给对方"
									value={scene}
									onChange={(e) => setScene(e.target.value)}
								/>
								{aiErr && <div className="mt-3 rounded-[6px] bg-[#FBE9E9] p-2 text-[13px] text-[#C62828] leading-5">{aiErr}<button type="button" className="mt-1 block text-[#576B95]" onClick={() => navigate("/wechat/my/settings/ai/key")}>去换模型 / 改密钥 ›</button></div>}
								<div className="mt-3 flex gap-3">
									<button type="button" disabled={aiBusy} onClick={() => setAiOpen(false)} className="h-[44px] flex-1 rounded-[6px] bg-black/5 text-[16px]">
										取消
									</button>
									<button type="button" disabled={aiBusy} onClick={generate} className="h-[44px] flex-1 rounded-[6px] bg-[#07C160] text-[16px] text-white disabled:opacity-50">
										{aiBusy ? "生成中…" : "生成预览"}
									</button>
								</div>
								</>
								)}
								</>
								)}
							</>
						)}
					</div>
				</div>
			)}
			{open && (
				<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setOpen(false)}>
					<div className="rounded-t-[12px] bg-white p-4 pb-[calc(16px+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
						<div className="mb-2 font-medium text-[16px]">批量输入聊天记录</div>
						<div className="mb-2 text-[12px] text-black/50 leading-5">
							一行一条。行首写「我：」或「对方：」切换发送人；不写就沿用上一行（第一行用当前选择的发送人）。
						</div>
						<textarea
							className="h-[200px] w-full resize-none rounded-[8px] bg-[#F5F5F5] p-3 text-[16px] outline-none"
							placeholder={"对方：在吗\n对方：帮我转一下\n我：好的\n我：稍等"}
							value={text}
							onChange={(e) => setText(e.target.value)}
						/>
						<div className="mt-3 flex gap-3">
							<button type="button" onClick={() => setOpen(false)} className="h-[44px] flex-1 rounded-[6px] bg-black/5 text-[16px]">
								取消
							</button>
							<button type="button" onClick={sendAll} className="h-[44px] flex-1 rounded-[6px] bg-[#07C160] text-[16px] text-white">
								发送全部
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
};

export default RoleBar;
