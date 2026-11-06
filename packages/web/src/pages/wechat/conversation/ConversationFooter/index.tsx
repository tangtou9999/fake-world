import Add2OutlinedSVG from "@/assets/add2-outlined.svg?react";
import KeyboardOutlinedSVG from "@/assets/keyboard-outlined.svg?react";
import StickerOutlinedSVG from "@/assets/sticker-outlined.svg?react";
import VoiceSVG from "@/assets/voice-outlined.svg?react";
import { useEffect, useState } from "react";
import { twJoin } from "tailwind-merge";
import BottomPopup from "./BottomPopup";
import EmojiPanel from "./EmojiPanel";
import Input from "./Input";
import MorePanel from "./MorePanel";
import RoleBar from "./RoleBar";

type Panel = "emoji" | "more" | null;

const ConversationFooter = () => {
	const [panel, setPanel] = useState<Panel>(null);
	const [rendered, setRendered] = useState<Exclude<Panel, null>>("emoji");

	useEffect(() => {
		if (panel) setRendered(panel);
	}, [panel]);

	return (
		<div className="flex flex-col">
			<div className="border-t-[0.5px] border-t-[#D6D6D6]">
				<RoleBar />
			</div>
			<div
				className={twJoin(
					"flex flex-col bg-[#F7F7F7] px-2 pt-2",
					panel ? "pb-2" : "pb-[calc(8px+env(safe-area-inset-bottom))]",
				)}
			>
				<div className="flex w-full items-end space-x-2">
					<VoiceSVG fill="#000" className="mb-[3px] h-8 w-8" />
					<Input dismissPanel={() => setPanel(null)} />
					{panel === "emoji" ? (
						<KeyboardOutlinedSVG
							fill="#000"
							className="mb-[3px] h-8 w-8 cursor-pointer"
							onClick={() => setPanel(null)}
						/>
					) : (
						<StickerOutlinedSVG
							fill="#000"
							className="mb-[3px] h-8 w-8 cursor-pointer"
							onClick={() => setPanel((current) => (current === "emoji" ? null : "emoji"))}
						/>
					)}
					<Add2OutlinedSVG
						fill="#000"
						className="mb-[3px] h-8 w-8 cursor-pointer"
						onClick={() => setPanel((current) => (current === "more" ? null : "more"))}
					/>
				</div>
			</div>
			<BottomPopup show={panel !== null}>
				{rendered === "more" ? <MorePanel onSent={() => setPanel(null)} /> : <EmojiPanel />}
			</BottomPopup>
		</div>
	);
};

export default ConversationFooter;
