import VoiceProfileEditor from "@/pages/wechat/my/settings/VoiceProfileEditor";
import { EConversationType, getConversationListValueSnapshot } from "@/stateV2/conversation";
import { convVoicesAtom, geminiConfigAtom, resolveProfile } from "@/stateV2/gemini";
import { geminiSpeak, playSequence, stopSpeaking, unlockAudio } from "@/utils/tts";
import { useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

/** 这个聊天里「对方」和「我」的声音档案（覆盖全局默认），以及一键连播所有语音 */
const VoiceSheet = ({ conversationId, onClose }: { conversationId: string; onClose: () => void }) => {
	const setAll = useSetAtom(convVoicesAtom);
	const gemini = useAtomValue(geminiConfigAtom);
	const navigate = useNavigate();
	const [role, setRole] = useState<"friend" | "mine">("friend");
	const [note, setNote] = useState("");

	const trial = async () => {
		unlockAudio();
		setNote("正在请求 Gemini 声音…");
		const n = await geminiSpeak("（笑）喂，你到哪儿了？我这边都准备好了。", resolveProfile(role, conversationId));
		setNote(n ?? "播放中。");
	};

	const playAll = async () => {
		unlockAudio();
		const list = (getConversationListValueSnapshot(conversationId) as unknown as { type: unknown; role: string; stt?: string }[]).filter((v) => v.type === EConversationType.voice && v.stt?.trim());
		if (!list.length) {
			setNote("这个聊天里还没有带文字的语音消息。");
			return;
		}
		setNote(`正在合成 ${list.length} 条语音…`);
		const n = await playSequence(list.map((v) => ({ text: v.stt as string, profile: resolveProfile(v.role === "mine" ? "mine" : "friend", conversationId) })));
		setNote(n ?? `连播中（${list.length} 条）。`);
	};

	return (
		<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
			<div className="flex max-h-[85%] flex-col rounded-t-[12px] bg-white pb-[calc(12px+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
				<div className="px-4 pt-4 pb-2 font-medium text-[16px]">这个聊天的声音</div>
				{!gemini.apiKey ? (
					<div className="p-4">
						<div className="mb-4 text-[14px] text-black/60 leading-6">还没有填 Gemini 密钥，请先到「我 → 设置 → AI 助手」填写。</div>
						<button type="button" onClick={() => navigate("/wechat/my/settings/ai/key")} className="h-[44px] w-full rounded-[6px] bg-[#07C160] text-[16px] text-white">
							去填写密钥
						</button>
					</div>
				) : (
					<div className="min-h-0 flex-1 overflow-auto">
						<div className="mx-4 mb-2 flex rounded-[8px] bg-black/5 p-[3px] text-[14px]">
							{(["friend", "mine"] as const).map((r) => (
								<button key={r} type="button" onClick={() => setRole(r)} className={`h-8 flex-1 rounded-[6px] ${role === r ? "bg-white font-medium shadow-sm" : "text-black/60"}`}>
									{r === "friend" ? "对方的声音" : "我的声音"}
								</button>
							))}
						</div>
						<VoiceProfileEditor
							key={role}
							value={resolveProfile(role, conversationId)}
							onChange={(p) => setAll((v) => ({ ...v, [conversationId]: { ...v[conversationId], [role]: p } }))}
							onTrial={() => void trial()}
							hint="只对这个聊天生效，没改的项沿用「设置 → AI 模型与声音」里的默认。"
						/>
						<div className="flex gap-3 px-4 pt-3">
							<button
								type="button"
								onClick={() =>
									setAll((v) => {
										const c = { ...v[conversationId] };
										delete c[role];
										return { ...v, [conversationId]: c };
									})
								}
								className="h-[42px] flex-1 rounded-[6px] bg-black/5 text-[15px]"
							>
								恢复默认
							</button>
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
