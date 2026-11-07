import { TRIAL_TEXT } from "@/pages/wechat/my/settings/VoiceLibrary";
import { EConversationType, getConversationListValueSnapshot } from "@/stateV2/conversation";
import { DEFAULT_VOICE, convVoicesAtom, geminiConfigAtom, normPace, normScene, resolveProfile, voicePresetsAtom } from "@/stateV2/gemini";
import { geminiSpeak, playSequence, stopSpeaking, unlockAudio } from "@/utils/tts";
import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

/** 这个聊天里「对方」和「我」各用声音库里的哪个声音，以及一键连播所有语音 */
const VoiceSheet = ({ conversationId, onClose }: { conversationId: string; onClose: () => void }) => {
	const [all, setAll] = useAtom(convVoicesAtom);
	const presets = useAtomValue(voicePresetsAtom);
	const gemini = useAtomValue(geminiConfigAtom);
	const navigate = useNavigate();
	const [note, setNote] = useState("");
	const has = !!(gemini.apiKey || gemini.apiKey2);

	const trial = async (role: "friend" | "mine") => {
		unlockAudio();
		setNote("正在请求 Gemini 声音…");
		const n = await geminiSpeak(TRIAL_TEXT, resolveProfile(role, conversationId));
		setNote(n ?? "播放中。");
	};

	const playAll = async () => {
		unlockAudio();
		const list = (getConversationListValueSnapshot(conversationId) as unknown as { type: unknown; role: string; stt?: string; scene?: string; pace?: string; tone?: string }[]).filter((v) => v.type === EConversationType.voice && v.stt?.trim());
		if (!list.length) {
			setNote("这个聊天里还没有带文字的语音消息。");
			return;
		}
		setNote(`正在合成 ${list.length} 条语音…`);
		const n = await playSequence(list.map((v) => ({ text: v.stt as string, profile: resolveProfile(v.role === "mine" ? "mine" : "friend", conversationId), tone: v.tone, fx: { ...(normScene(v.scene) ? { scene: normScene(v.scene) } : {}), ...(normPace(v.pace) ? { pace: normPace(v.pace) } : {}) } })));
		setNote(n ?? `连播中（${list.length} 条）。`);
	};

	const row = (role: "friend" | "mine", label: string) => {
		const cur = all[conversationId]?.[role];
		return (
			<div className="border-black/5 border-b px-4 py-3 last:border-b-0">
				<div className="text-[16px]">{label}</div>
				<div className="mt-2 flex items-center gap-2">
					<select
						className="h-10 min-w-0 flex-1 rounded-[6px] bg-[#F5F5F5] px-2 text-[15px] outline-none"
						value={typeof cur === "string" ? cur : ""}
						onChange={(e) =>
							setAll((v) => {
								const c = { ...v[conversationId] };
								if (e.target.value) c[role] = e.target.value;
								else delete c[role];
								return { ...v, [conversationId]: c };
							})
						}
					>
						<option value="">跟随默认（{resolveProfile(role).voice || DEFAULT_VOICE[role]}）</option>
						{presets.map((p) => (
							<option key={p.id} value={p.id}>
								{p.name}
							</option>
						))}
					</select>
					<button type="button" onClick={() => void trial(role)} className="h-10 shrink-0 rounded-[6px] bg-[#07C160] px-4 text-[15px] text-white">
						试听
					</button>
				</div>
			</div>
		);
	};

	return (
		<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
			<div className="flex max-h-[85%] flex-col rounded-t-[12px] bg-white pb-[calc(12px+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
				<div className="px-4 pt-4 pb-2 font-medium text-[16px]">这个聊天的声音</div>
				{!has ? (
					<div className="p-4">
						<div className="mb-4 text-[14px] text-black/60 leading-6">还没有填 Gemini 密钥，请先到「我 → 设置 → AI 助手」填写。</div>
						<button type="button" onClick={() => navigate("/wechat/my/settings/ai/key")} className="h-[44px] w-full rounded-[6px] bg-[#07C160] text-[16px] text-white">
							去填写密钥
						</button>
					</div>
				) : (
					<div className="min-h-0 flex-1 overflow-auto">
						<div className="px-4 pb-1 text-[12px] text-black/40 leading-5">从「声音库」里给这个聊天选声音。声音库在「设置 → AI 模型与声音」里新建、试听、命名保存。</div>
						{row("friend", "对方的声音")}
						{row("mine", "我的声音")}
						<button type="button" onClick={() => navigate("/wechat/my/settings/ai/key")} className="mx-4 mt-2 text-[14px] text-[#576B95]">
							去声音库新建 / 修改声音 ›
						</button>
						<div className="flex gap-3 px-4 pt-3">
							<button type="button" onClick={() => void playAll()} className="h-[42px] flex-1 rounded-[6px] bg-[#07C160]/10 text-[15px] text-[#07C160]">
								连播全部语音
							</button>
							<button type="button" onClick={stopSpeaking} className="h-[42px] w-[64px] rounded-[6px] bg-black/5 text-[15px]">
								停止
							</button>
						</div>
						{note && <div className="px-4 pt-2 text-[12px] text-[#576B95] leading-5">{note}</div>}
					</div>
				)}
				<button type="button" onClick={onClose} className="mx-4 mt-3 h-[44px] rounded-[6px] bg-black/5 text-[16px]">
					完成
				</button>
			</div>
		</div>
	);
};

export default VoiceSheet;
