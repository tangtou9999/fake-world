import { omit } from "lodash-es";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { twJoin, twMerge } from "tailwind-merge";

import ArrowOutlinedSVG from "@/assets/arrow-outlined.svg?react";
import { canBeDetected } from "@/components/NodeDetected";

type ListItemProps = {
	withJump?: boolean;
	icon?: ReactNode;
	textPrev?: ReactNode;
	textPrevClassName?: string;
	rightClassName?: string;
};

export const List = ({ children, className }: ComponentPropsWithRef<"div">) => {
	return <div className={twJoin("flex flex-col bg-white", className)}>{children}</div>;
};

const ListItemPrev = ({ children, className }: ComponentPropsWithRef<"div">) => {
	return <div className={twMerge("ml-4", className)}>{children}</div>;
};

export const ListItem = ({
	children,
	className,
	withJump,
	icon,
	textPrev,
	textPrevClassName,
	rightClassName,
	...rest
}: ComponentPropsWithRef<"div"> & ListItemProps) => {
	const renderTextPrevNode = () => {
		if (icon) {
			return (
				<ListItemPrev className="mr-4 flex h-6 w-6 shrink-0 items-center justify-center [&_svg]:h-6 [&_svg]:w-6">
					{icon}
				</ListItemPrev>
			);
		}
		if (textPrev) {
			return <ListItemPrev className={textPrevClassName}>{textPrev}</ListItemPrev>;
		}
		return <ListItemPrev />;
	};

	return (
		<div
			className={twMerge(
				"group/item relative flex items-center",
				(withJump || rest.onClick) && "cursor-pointer",
				className,
			)}
			{...omit(rest, "className", "children")}
		>
			{renderTextPrevNode()}
			<div
				className={twMerge(
					"relative flex min-h-[56px] flex-1 items-center py-4 pr-4 text-[17px] text-black/90 leading-[22px] after:absolute after:right-0 after:bottom-0 after:left-0 after:h-px after:origin-bottom after:scale-y-50 after:bg-black/10 group-last/item:after:hidden",
					rightClassName,
				)}
			>
				<div className="min-w-0 flex-1">{children}</div>
				<div className="ml-auto shrink-0">
					{withJump && <ArrowOutlinedSVG fill="rgba(0,0,0,0.3)" className="ml-1 h-3 w-3" />}
				</div>
			</div>
		</div>
	);
};

List.Item = ListItem;
List.CanBeDetectedItem = canBeDetected(ListItem);

export default List;
