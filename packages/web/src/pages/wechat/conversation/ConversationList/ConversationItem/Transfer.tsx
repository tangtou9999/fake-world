import Done2SVG from "@/assets/done2-outlined.svg?react";
import ErrorSVG from "@/assets/error-outlined.svg?react";
import Previous2SVG from "@/assets/previous2-outlined.svg?react";
import Transfer2SVG from "@/assets/transfer2-outlined.svg?react";
import type { IConversationTypeTransfer } from "@/stateV2/conversation";
import { type IStateProfile, profileAtom } from "@/stateV2/profile";
import { useAtomValue } from "jotai";
import { get, isEmpty } from "lodash-es";
import { type ComponentType, type SVGProps, memo } from "react";
import { twJoin } from "tailwind-merge";
import { TRANSFER_TEXT_NOTE_MAP } from "../consts";
import CommonBlock from "./CommonBlock";

type Props = {
	role: IConversationTypeTransfer["role"];
	upperText: IConversationTypeTransfer["upperText"];
	senderId: IStateProfile["id"];
	transferStatus: IConversationTypeTransfer["transferStatus"];
	amount: IConversationTypeTransfer["amount"];
	note: IConversationTypeTransfer["note"];
	originalSender: IConversationTypeTransfer["originalSender"];
	transferTo?: string;
};

const SVG_COMPONENT_MAP: Record<
	IConversationTypeTransfer["transferStatus"],
	ComponentType<SVGProps<SVGSVGElement>>
> = {
	awaiting: Transfer2SVG,
	accepted: Done2SVG,
	rejected: Previous2SVG,
	expired: ErrorSVG,
};

const Transfer = ({
	upperText,
	senderId,
	transferStatus,
	amount,
	note,
	originalSender,
	role,
	transferTo,
}: Props) => {
	const target = useAtomValue(profileAtom(transferTo ?? ""));
	const targetName = target?.remark || target?.nickname;
	const SVGComp = SVG_COMPONENT_MAP[transferStatus];
	const getTransferNote = () => {
		// 群聊：写明转给了谁
		if (transferTo && targetName) {
			if (transferStatus === "awaiting") return isEmpty(note) ? `转账给${targetName}` : note;
			if (transferStatus === "accepted") return `${targetName}已收款`;
		}
		if (transferStatus === "awaiting") {
			return isEmpty(note)
				? get(TRANSFER_TEXT_NOTE_MAP, [originalSender, role, "awaiting"], "")
				: note;
		}
		return get(TRANSFER_TEXT_NOTE_MAP, [originalSender, role, transferStatus], "");
	};

	return (
		<CommonBlock
			upperText={upperText}
			senderId={senderId}
			blockClassName="w-auto max-w-none"
			innerBlockClassName={twJoin(
				"h-[83px] w-[243px] max-w-none rounded-[6px] p-0",
				transferStatus === "awaiting" && "bg-wechatOrange-3 before:bg-wechatOrange-3",
				(transferStatus === "accepted" || transferStatus === "rejected") &&
					"bg-[#FACE9C] before:bg-[#FACE9C]",
				transferStatus === "expired" && "bg-[#FACE9C] before:bg-[#FACE9C] saturate-60",
			)}
		>
			<div className="relative h-full text-white">
				<div className="flex items-start px-[10px] pt-[10px]">
					<span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center">
						<SVGComp fill="white" width={50} height={50} className="max-w-none shrink-0" />
					</span>
					<div className="ml-[9px] flex min-w-0 flex-1 flex-col overflow-hidden">
						<div className="font-medium text-[17px] leading-[22px]">
							¥<span className="ml-[1px]">{Number.isFinite(Number(amount)) ? Number(amount).toFixed(2) : amount}</span>
						</div>
						<span className="line-clamp-1 text-[13px] leading-4">{getTransferNote()}</span>
					</div>
				</div>
				<span className="absolute bottom-[10px] left-[10px] text-[11px] text-white/80 leading-[14px]">
					转账
				</span>
			</div>
		</CommonBlock>
	);
};

export default memo(Transfer);
