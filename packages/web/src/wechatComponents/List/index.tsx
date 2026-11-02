import { omit } from "lodash-es";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { twJoin, twMerge } from "tailwind-merge";

import { canBeDetected } from "@/components/NodeDetected";

type ListItemProps = {
	withJump?: boolean;
	icon?: ReactNode;
	textPrev?: ReactNode;
	textPrevClassName?: string;
	rightClassName?: string;
	/** Content shown between the label and the chevron (thumbnail, subtitle, red dot...) */
	extra?: ReactNode;
};

export const Chevron = ({ className }: { className?: string }) => (
	<svg
		width="8"
		height="14"
		viewBox="0 0 8 14"
		fill="none"
		className={twMerge("ml-2 shrink-0", className)}
		aria-hidden="true"
	>
		<path
			d="M1 1l6 6-6 6"
			stroke="rgba(60,60,67,0.3)"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

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
	extra,
	...rest
}: ComponentPropsWithRef<"div"> & ListItemProps) => {
	const renderTextPrevNode = () => {
		if (icon) {
			return (
				<ListItemPrev className="mr-4 flex h-[22px] w-[22px] shrink-0 items-center justify-center [&_svg]:h-[22px] [&_svg]:w-[22px]">
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
					"relative flex min-h-[54px] flex-1 items-center py-4 pr-4 text-[16px] text-black/90 leading-[22px] after:absolute after:right-0 after:bottom-0 after:left-0 after:h-px after:origin-bottom after:scale-y-50 after:bg-black/10 group-last/item:after:hidden",
					rightClassName,
				)}
			>
				<div className="min-w-0 flex-1">{children}</div>
				{extra}
				<div className="ml-auto shrink-0">{withJump && <Chevron />}</div>
			</div>
		</div>
	);
};

List.Item = ListItem;
List.CanBeDetectedItem = canBeDetected(ListItem);

export default List;
