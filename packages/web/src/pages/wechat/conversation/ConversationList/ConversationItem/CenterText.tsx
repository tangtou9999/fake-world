import type { IConversationTypeSingleUpperText } from "@/stateV2/conversation";
import { CENTER_LINK } from "@/stateV2/friendRequests";
import { memo } from "react";
import { twMerge } from "tailwind-merge";

type Props = {
	extraClassName: IConversationTypeSingleUpperText["extraClassName"];
	upperText: IConversationTypeSingleUpperText["upperText"];
	simpleContent: IConversationTypeSingleUpperText["simpleContent"];
};

const CenterText = ({ extraClassName, upperText, simpleContent }: Props) => {
	return (
		<>
			{upperText && <div className={"m-auto text-black/50 text-xs"}>{upperText}</div>}
			<div className={twMerge("m-auto text-black/50 text-xs", extraClassName)}>
				<div>
					{simpleContent.includes(CENTER_LINK)
						? simpleContent.split(CENTER_LINK).flatMap((part, i, arr) =>
								i < arr.length - 1
									? [part, <span key={i} className="text-[#576B95]">{CENTER_LINK}</span>]
									: [part],
							)
						: simpleContent}
				</div>
			</div>
		</>
	);
};

export default memo(CenterText);
