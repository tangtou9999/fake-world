const base = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", strokeWidth: 1.5 } as const;
const line = { strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** 经营账户：小店 + 硬币 */
export const BusinessIcon = () => (
	<svg {...base} stroke="#FFC300" {...line} aria-hidden="true">
		<path d="M4 9V4.5h13.5V9M4 9l-.8 2.4c-.3 1 .4 1.9 1.4 1.9s1.7-.8 1.7-1.7c0 .9.8 1.7 1.8 1.7s1.8-.8 1.8-1.7c0 .9.8 1.7 1.8 1.7s1.7-.9 1.7-1.9L17.5 9M4 13.3V20h7" />
		<circle cx="17" cy="17.5" r="4" stroke="#FA9D3B" />
		<path d="M15.6 15.8l1.4 1.7 1.4-1.7M15.6 17.7h2.8M15.6 18.9h2.8M17 17.5v2.3" stroke="#FA9D3B" strokeWidth="1" />
	</svg>
);

/** 分付：三个叠放的圆 + 勾 */
export const FenfuIcon = () => (
	<svg {...base} stroke="#07C160" {...line} aria-hidden="true">
		<circle cx="9" cy="8" r="4.5" />
		<circle cx="5.8" cy="14" r="3.8" />
		<circle cx="14.5" cy="15.5" r="5" fill="#fff" />
		<path d="M12.4 15.6l1.6 1.6 3-3.4" />
	</svg>
);

/** 支付设置：齿轮 */
export const GearIcon = () => (
	<svg {...base} stroke="#1485EE" {...line} aria-hidden="true">
		<path d="M10.2 3h3.6l.6 2.3 1.6.9 2.2-.7 1.8 3.1-1.7 1.6v1.8l1.7 1.6-1.8 3.1-2.2-.7-1.6.9-.6 2.3h-3.6l-.6-2.3-1.6-.9-2.2.7-1.8-3.1 1.7-1.6v-1.8L4 8.6l1.8-3.1 2.2.7 1.6-.9z" />
		<circle cx="12" cy="12" r="3" />
	</svg>
);

/** 身份信息：证件 */
export const IdCardIcon = () => (
	<svg {...base} stroke="#1485EE" {...line} aria-hidden="true">
		<rect x="2.5" y="4.5" width="19" height="15" rx="1.2" />
		<circle cx="8.5" cy="10.5" r="2" />
		<path d="M5 16.5c.4-2 1.9-3 3.5-3s3.1 1 3.5 3zM14.5 9.5h4M14.5 12.5h4" />
	</svg>
);

/** 客服中心：对话气泡 + 勾 */
export const ServiceCenterIcon = () => (
	<svg {...base} stroke="#07C160" {...line} aria-hidden="true">
		<path d="M12 3.5c4.7 0 8.5 3.1 8.5 7s-3.8 7-8.5 7c-1 0-1.9-.1-2.8-.4L5 20l.8-3.6C4 15 3.5 12.9 3.5 10.500c0-3.900 3.8-7 8.5-7z" />
		<path d="M8.800 10.800l2.200 2.200 4-4.400" />
	</svg>
);
