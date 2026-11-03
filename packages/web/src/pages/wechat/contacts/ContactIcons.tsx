import type { SVGProps } from "react";

const base = "h-10 w-10 shrink-0 rounded-[5px]";

/** 公众号：蓝底、白色翻开的书 */
export const OfficialIcon = ({ className }: { className?: string }) => (
	<svg viewBox="0 0 40 40" className={className ?? base} aria-hidden="true">
		<rect width="40" height="40" fill="#1B7FEF" />
		<path
			d="M9.6 13.2c0-1.1.9-1.7 1.9-1.4l7.4 2.1v14.1l-7.6-3.3c-1-.4-1.7-1.3-1.7-2.4Z"
			fill="#fff"
		/>
		<path
			d="M30.4 13.2c0-1.1-.9-1.7-1.9-1.4l-7.4 2.1v14.1l7.6-3.3c1-.4 1.7-1.3 1.7-2.4Z"
			fill="#fff"
		/>
	</svg>
);

/** 服务号：亮蓝底、两个并排的白色菱形 */
export const ServiceIcon = ({ className }: { className?: string }) => (
	<svg viewBox="0 0 40 40" className={className ?? base} aria-hidden="true">
		<rect width="40" height="40" fill="#14A9FF" />
		<path
			d="M15.4 12.2 20.2 20l-4.8 7.8L10.6 20Z"
			fill="#fff"
			stroke="#fff"
			strokeWidth="1.6"
			strokeLinejoin="round"
		/>
		<path
			d="M24.6 12.2 29.4 20l-4.8 7.8L19.8 20Z"
			fill="#fff"
			stroke="#fff"
			strokeWidth="1.6"
			strokeLinejoin="round"
		/>
	</svg>
);

/** 企业微信联系人：深蓝底、白色线框对话气泡加一个小菱形 */
export const WecomIcon = ({ className }: { className?: string }) => (
	<svg viewBox="0 0 40 40" className={className ?? base} aria-hidden="true">
		<rect width="40" height="40" fill="#2D7DD8" />
		<path
			d="M19.2 11c-5.2 0-9.4 3.3-9.4 7.5 0 2.2 1.2 4.2 3 5.6l-.9 3.3 3.8-1.9c1.1.3 2.3.5 3.5.5 5.2 0 9.4-3.3 9.4-7.5S24.400 11 19.200 11Z"
			fill="none"
			stroke="#fff"
			strokeWidth="1.8"
			strokeLinejoin="round"
		/>
		<path
			d="M28.700 22.600l2.800 2.800-2.800 2.800-2.800-2.800Z"
			fill="#2D7DD8"
			stroke="#fff"
			strokeWidth="1.5"
			strokeLinejoin="round"
		/>
	</svg>
);

export type IconProps = SVGProps<SVGSVGElement>;
