import { isNil } from "lodash-es";
import type { CSSProperties, PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";

type Props = {
	type?: "number" | "dot";
	className?: string;
	text?: number;
	style?: CSSProperties;
	hidden?: boolean;
};

const Badge = ({
	type = "number",
	style,
	text,
	className,
	children,
	hidden,
}: PropsWithChildren<Props>) => {
	// 数字角标：没有数字或数字为 0 时不显示（全部已读后不能剩一个 0）
	if (hidden || (type === "number" && (isNil(text) || !(Number(text) > 0)))) {
		return <>{children}</>;
	}
	const isOneText = text?.toString().length === 1;
	return (
		<div className="relative">
			{children}
			{type === "dot" && (
				<div
					className={twMerge(
						"-right-1 -top-1 absolute h-[10px] w-[10px] rounded-full bg-[#FA5151]",
						className,
					)}
					style={style}
				/>
			)}
			{type === "number" && (
				<div
					className={twMerge(
						"-right-2 -top-2 absolute flex items-center justify-center rounded-full bg-[#FA5151] font-bold text-[11px] text-white",
						isOneText ? "h-4 w-4 leading-4" : "h-4 px-[5px] leading-4",
						className,
					)}
				>
					{text}
				</div>
			)}
		</div>
	);
};

export default Badge;
