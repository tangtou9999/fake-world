import VoiceSVG from "@/assets/voice.svg?react";
import type { IConversationTypeVoice } from "@/stateV2/conversation";
import type { IStateProfile } from "@/stateV2/profile";
import { playingVoiceAtom } from "@/stateV2/playingVoice";
import { realVoiceUrl } from "@/auth/realSync";
import { showToast } from "@/wechatComponents/Toast";
import { useAtom } from "jotai";
import { memo } from "react";
import { twJoin } from "tailwind-merge";
import CommonBlock from "./CommonBlock";

type Props = {
	id?: string;
	duration: IConversationTypeVoice["duration"];
	voiceBlob?: string;
	senderId: IStateProfile["id"];
	upperText: IConversationTypeVoice["upperText"];
	isRead: IConversationTypeVoice["isRead"];
	role: IConversationTypeVoice["role"];
	showStt: IConversationTypeVoice["showStt"];
	stt: IConversationTypeVoice["stt"];
};

let realAudio: HTMLAudioElement | null = null;

const Voice = ({ id, voiceBlob, senderId, upperText, duration, role, isRead, showStt, stt }: Props) => {
	const [playingId, setPlayingId] = useAtom(playingVoiceAtom);
	const playing = playingId === id && !!id;
	const play = async () => {
		if (!voiceBlob || !id) return;
		if (playing) {
			realAudio?.pause();
			setPlayingId(null);
			return;
		}
		try {
			realAudio?.pause();
			const a = new Audio(await realVoiceUrl(voiceBlob));
			realAudio = a;
			a.onended = () => setPlayingId((c) => (c === id ? null : c));
			setPlayingId(id);
			await a.play();
		} catch {
			setPlayingId(null);
			showToast({ content: "语音播放失败" });
		}
	};
	return (
		<>
			<CommonBlock
				senderId={senderId}
				upperText={upperText}
				innerBlockClassName="w-full group-[.friend]:bg-white group-[.mine]:bg-[#8CE97F] group-[.friend]:before:bg-white group-[.mine]:before:bg-[#8CE97F]"
				blockStyle={{
					width: `${duration <= 10 ? 33 + duration * 2.2 : 52}%`,
					maxWidth: "52%",
				}}
				extraElement={
					!isRead &&
					role === "friend" && (
						<div className="-right-5 -translate-y-1/2 absolute top-1/2">
							<div className="h-2 w-2 rounded-full bg-wechatRed-3" />
						</div>
					)
				}
			>
				<div onClick={voiceBlob ? () => void play() : undefined} className={twJoin("flex h-6", role === "mine" ? "flex-row-reverse" : "flex-row")}>
					<VoiceSVG
						width={31}
						height={31}
						className={twJoin("wx-voice self-center", role === "mine" && "rotate-180", playing && "wx-voice-playing")}
					/>
					<span className="self-center text-sm">{duration}&quot;</span>
				</div>
			</CommonBlock>
			{showStt && !!stt && (
				<CommonBlock
					hideAvatar
					upperText={undefined}
					senderId={senderId}
					innerBlockClassName="bg-white"
					blockClassName="!mt-1"
				>
					{stt.replace(/^\s*[（(][^）)]{1,12}[）)]\s*/, "")}
				</CommonBlock>
			)}
		</>
	);
};

export default memo(Voice);
