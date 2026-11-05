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
import { getConversationListValueSnapshot } from "@/stateV2/conversation";
import { geminiConfigAtom } from "@/stateV2/gemini";
import { getMyProfileValueSnapshot, getProfileValueSnapshot } from "@/stateV2/profile";
import { callGemini, fileToGeminiImage, parseJsonLoose } from "@/utils/gemini";
import ModelPicker from "../../my/settings/ModelPicker";
import { applyParsedItems, parseScreenshots } from "./importScreenshots";
import { Node } from "slate";
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
	const [count, setCount] = useState("10");
	const [aiBusy, setAiBusy] = useState(false);
	const [aiErr, setAiErr] = useState("");
	const [aiTab, setAiTab] = useState<"scene" | "shots">("scene");
	const [shots, setShots] = useState<File[]>([]);
	const [replace, setReplace] = useState(false);
	const [aiDone, setAiDone] = useState("");
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
		setAiBusy(true);
		setAiErr("");
		try {
			const friend = getProfileValueSnapshot(conversationId);
			const me = getMyProfileValueSnapshot();
			const history = getConversationListValueSnapshot(conversationId)
				.filter((v) => v.type === EConversationType.text)
				.slice(-12)
				.map((v) => {
					const t = (v as unknown as { textContent: Parameters<typeof Node.string>[0][] }).textContent
						.map((n) => Node.string(n))
						.join("");
					return `${v.role === "mine" ? "我" : "对方"}：${t}`;
				})
				.join("\n");
			const n = Math.min(Math.max(Number.parseInt(count) || 10, 2), 30);
			const prompt = `你在为一个微信聊天界面的演示生成对话内容。
对方：${friend?.remark || friend?.nickname || "朋友"}${friend?.description ? `（${friend.description}）` : ""}${friend?.signature ? `，签名：${friend.signature}` : ""}
我：${me?.nickname || "我"}
已有的最近聊天（可能为空，请自然衔接，不要重复）：
${history || "（暂无）"}

场景要求：${scene || "日常闲聊"}

请生成 ${n} 条左右的微信聊天消息，对话要有来有回，口语化、简短，每条一句话，符合各自身份的语气，不要旁白、不要编号、不要表情描述。
只输出 JSON 数组，格式：[{"who":"friend","text":"..."},{"who":"me","text":"..."}]，who 只能是 friend（对方）或 me（我）。`;
			const raw = await callGemini(prompt, { json: true });
			const list = parseJsonLoose<{ who: string; text: string }[]>(raw);
			const lines = list
				.filter((v) => v?.text)
				.map((v) => `${v.who === "me" ? "我" : "对方"}：${String(v.text).replace(/\n/g, " ")}`);
			if (lines.length === 0) throw new Error("没有生成出内容，再试一次");
			setText(lines.join("\n"));
			setAiOpen(false);
			setOpen(true);
		} catch (e) {
			setAiErr(e instanceof Error ? e.message : String(e));
		} finally {
			setAiBusy(false);
		}
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
					onClick={() => setAiOpen(true)}
					className="ml-auto h-7 rounded-full bg-[#07C160]/10 px-3 text-[14px] text-[#07C160]"
				>
					AI 生成
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
								<div className="mb-3">
									<div className="mb-1 text-[12px] text-black/50">当前模型（点一下切换）</div>
									<ModelPicker />
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
										{aiErr && <div className="mt-3 rounded-[6px] bg-[#FBE9E9] p-2 text-[13px] text-[#C62828] leading-5">{aiErr}</div>}
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
								<div className="mb-2 text-[12px] text-black/50 leading-5">
									会参考对方的资料和最近的聊天。生成后先放进「批量输入」里，你可以改完再发送。
								</div>
								<textarea
									className="h-[110px] w-full resize-none rounded-[8px] bg-[#F5F5F5] p-3 text-[16px] outline-none"
									placeholder="描述场景，例如：同事催我交周报，我在拖延，语气半开玩笑"
									value={scene}
									onChange={(e) => setScene(e.target.value)}
								/>
								<div className="mt-3 flex items-center text-[15px]">
									<span className="mr-3 text-black/60">条数</span>
									<input
										className="h-9 w-[70px] rounded-[6px] bg-[#F5F5F5] px-3 text-center outline-none"
										inputMode="numeric"
										value={count}
										onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))}
									/>
								</div>
								{aiErr && <div className="mt-3 rounded-[6px] bg-[#FBE9E9] p-2 text-[13px] text-[#C62828] leading-5">{aiErr}</div>}
								<div className="mt-3 flex gap-3">
									<button type="button" disabled={aiBusy} onClick={() => setAiOpen(false)} className="h-[44px] flex-1 rounded-[6px] bg-black/5 text-[16px]">
										取消
									</button>
									<button type="button" disabled={aiBusy} onClick={generate} className="h-[44px] flex-1 rounded-[6px] bg-[#07C160] text-[16px] text-white disabled:opacity-50">
										{aiBusy ? "生成中…" : "生成"}
									</button>
								</div>
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
