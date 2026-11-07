import type { IConversationTypeSingleUpperText } from "@/stateV2/conversation";
import { CENTER_LINK, IMAGE_NOTE_LINK } from "@/stateV2/friendRequests";
import { memo } from "react";
import { twMerge } from "tailwind-merge";

type Props = {
	extraClassName: IConversationTypeSingleUpperText["extraClassName"];
	upperText: IConversationTypeSingleUpperText["upperText"];
	simpleContent: IConversationTypeSingleUpperText["simpleContent"];
};

const LINK_RE = new RegExp(`(${CENTER_LINK}|${IMAGE_NOTE_LINK})`);

const CenterText = ({ extraClassName, upperText, simpleContent }: Props) => {
	return (
		<>
			{upperText && <div className={"m-auto mt-2 mb-[17px] text-[14px] leading-5 text-black/50"}>{upperText}</div>}
			<div
				className={twMerge(
					"m-auto text-black/50 text-xs",
					LINK_RE.test(simpleContent) && "max-w-[86%] text-center text-[13px] text-black/40 leading-[19px]",
					extraClassName,
				)}
			>
				{simpleContent.split(LINK_RE).map((part, i) =>
					part === CENTER_LINK || part === IMAGE_NOTE_LINK ? (
						<span key={i} className="text-[#576B95]">
							{part}
						</span>
					) : (
						<span key={i}>{part}</span>
					),
				)}
			</div>
		</>
	);
};

export default memo(CenterText);
