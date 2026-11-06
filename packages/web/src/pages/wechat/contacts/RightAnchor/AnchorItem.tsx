import { omit } from "lodash-es";
import type { ComponentProps } from "react";
import { twJoin } from "tailwind-merge";

type Props = {
	active?: boolean;
};

const AnchorItem = ({ active, children, className, ...rest }: ComponentProps<"div"> & Props) => {
	return (
		<div className="cursor-pointer pr-[3px] pl-3" {...omit(rest, "key")}>
			<div
				className={twJoin(
					"flex h-[16px] w-[16px] items-center justify-center rounded-full text-[11px] leading-none",
					active && "bg-[#07C160] text-white",
					className,
				)}
			>
				{children}
			</div>
		</div>
	);
};

export default AnchorItem;
