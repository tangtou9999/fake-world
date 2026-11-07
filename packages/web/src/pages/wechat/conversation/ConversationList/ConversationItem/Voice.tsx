import VoiceSVG from "@/assets/voice.svg?react";
import type { IConversationTypeVoice } from "@/stateV2/conversation";
import type { IStateProfile } from "@/stateV2/profile";
import { playingVoiceAtom } from "@/stateV2/playingVoice";
import { useAtomValue } from "jotai";
import { memo } from "react";
import { twJoin } from "tailwind-merge";
import CommonBlock from "./CommonBlock";

type Props = {
	id?: string;
	duration: IConversationTypeVoice["duration"];
	senderId: IStateProfile["id"];
	upperText: IConversationTypeVoice["upperText"];
	isRead: IConversationTypeVoice["isRead"];
	role: IConversationTypeVoice["role"];
	showStt: IConversationTypeVoice["showStt"];
	stt: IConversationTypeVoice["stt"];
};

const Voice = ({ id, senderId, upperText, duration, role, isRead, showStt, stt }: Props) => {
	const playing = useAtomValue(playingVoiceAtom) === id && !!id;
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
				<div className={twJoin("flex h-6", role === "mine" ? "flex-row-reverse" : "flex-row")}>
					{playing ? (
						<svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className={twJoin("self-center text-black", role === "mine" && "rotate-180")}>
							<title>正在播放</title>
							<style>{"@keyframes wxva{0%,100%{opacity:.15}30%,70%{opacity:1}}.wxva1{animation:wxva 1.2s infinite}.wxva2{animation:wxva 1.2s .25s infinite}.wxva3{animation:wxva 1.2s .5s infinite}"}</style>
							<circle cx="8.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
							<path className="wxva1" d="M11.2 9.6a3.4 3.4 0 0 1 0 4.8" />
							<path className="wxva2" d="M13.6 7.6a6.4 6.4 0 0 1 0 8.8" />
							<path className="wxva3" d="M16 5.6a9.4 9.4 0 0 1 0 12.8" />
						</svg>
					) : (
						<VoiceSVG
							width={28}
							height={28}
							className={twJoin("self-center", role === "mine" && "rotate-180")}
						/>
					)}
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
					{stt}
				</CommonBlock>
			)}
		</>
	);
};

export default memo(Voice);
