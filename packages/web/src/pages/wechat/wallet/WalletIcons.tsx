const base24 = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", strokeWidth: 1.5 } as const;
const base = { width: 21, height: 21, viewBox: "0 0 64 64", fill: "none", strokeWidth: 3.8, style: { width: 21, height: 21 } } as const;
const line = { strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** 经营账户：店铺雨棚 + 右下角硬币 */
export const BusinessIcon = () => (
	<svg {...base} stroke="#FFC300" {...line} aria-hidden="true">
		<path d="M10.5 4.5H54L58.5 14A8.6 7 0 0 1 41 17A8.5 7 0 0 1 24 17A8.6 7 0 0 1 7.5 14Z" />
		<path d="M12 21V54.5H27M54.7 21V30" />
		<circle cx="42" cy="46" r="15.8" />
		<path d="M36.8 38.8L42 45.2L47.2 38.8M42 45.2V53M37 47.2H47M37 51H47" strokeWidth="3" />
	</svg>
);

/** 零钱通：钻石 */
export const DiamondIcon = () => (
	<svg {...base} stroke="#FFC300" {...line} aria-hidden="true">
		<path d="M15.7 11.3H50.1L62.7 24.7L32.9 62.5L3.3 24.7Z" />
		<path d="M3.3 24.7H62.7M25.6 11.3L19.6 24.7M40.2 11.3L46.2 24.7M19.6 24.7L32.9 62.5M46.2 24.7L32.9 62.5" />
	</svg>
);

/** 亲属卡：旋转的卡片 + 轨道 */
export const KinCardIcon = () => (
	<svg {...base} stroke="#FA9D3B" {...line} aria-hidden="true">
		<path d="M30.5 40.5L58.2 40.4L40 59.6L22 41.4Z" fill="#fff" />
		<path d="M22.7 5.3L51.3 34L32 53.3L3.3 24.7Z" fill="#fff" />
		<path d="M35 9.5C52 5 61 18 54 31C47 45 25 58 14 55C9 53 9 45 10.7 39.5" />
	</svg>
);

/** 分付：三个叠放的圆 + 勾 */
export const FenfuIcon = () => (
	<svg {...base} stroke="#07C160" {...line} aria-hidden="true">
		<circle cx="19.5" cy="44" r="15.4" />
		<circle cx="33.5" cy="22" r="16" />
		<circle cx="45.5" cy="41.5" r="16" fill="#fff" />
		<path d="M36.5 43.5L40.5 48.5L55 39.5" strokeWidth="4" />
	</svg>
);

/** 支付分：徽章 + 人像 + 勾 */
export const ScoreIcon = () => (
	<svg {...base} stroke="#2BC269" {...line} aria-hidden="true">
		<path d="M39.95 54.4 L33 61 L26.05 54.4 L16.54 55.65 L14.8 46.23 L6.37 41.65 L10.5 33 L6.37 24.35 L14.8 19.77 L16.54 10.35 L26.05 11.6 L33 5 L39.95 11.6 L49.46 10.35 L51.2 19.77 L59.63 24.35 L55.5 33 L59.63 41.65" />
		<circle cx="33.3" cy="27.3" r="5.2" />
		<path d="M29.3 33L22 43.3M37.3 33L44.7 42.7" />
		<path d="M40 53.5L43 59L62 47" strokeWidth="4" />
	</svg>
);

/** 支付设置：齿轮 */
export const GearIcon = () => (
	<svg {...base} stroke="#1485EE" {...line} aria-hidden="true">
		<path d="M27.62 12.32 L28.59 5.21 L36.81 5.21 L37.78 12.32 L43.52 14.7 L49.24 10.35 L55.05 16.16 L50.7 21.88 L53.08 27.62 L60.19 28.59 L60.19 36.81 L53.08 37.78 L50.7 43.52 L55.05 49.24 L49.24 55.05 L43.52 50.7 L37.78 53.08 L36.81 60.19 L28.59 60.19 L27.62 53.08 L21.88 50.7 L16.16 55.05 L10.35 49.24 L14.7 43.52 L12.32 37.78 L5.21 36.81 L5.21 28.59 L12.32 27.62 L14.7 21.88 L10.35 16.16 L16.16 10.35 L21.88 14.7Z" />
		<circle cx="32.7" cy="32.7" r="10.2" />
	</svg>
);

/** 身份信息：证件 */
export const IdCardIcon = () => (
	<svg {...base24} stroke="#1485EE" {...line} aria-hidden="true">
		<rect x="2.5" y="4.5" width="19" height="15" rx="1.2" />
		<circle cx="8.5" cy="10.5" r="2" />
		<path d="M5 16.5c.4-2 1.9-3 3.5-3s3.1 1 3.5 3zM14.5 9.5h4M14.5 12.5h4" />
	</svg>
);

/** 客服中心：对话气泡 + 勾 + 耳机线圈 */
export const ServiceCenterIcon = () => (
	<svg {...base} stroke="#07C160" {...line} aria-hidden="true">
		<path d="M32.5 57L12.3 60.8L13.2 49.5A28 24 0 1 1 59.5 44" />
		<ellipse cx="46.5" cy="52.5" rx="7.8" ry="4" transform="rotate(-25 46.5 52.5)" />
		<path d="M22 34L28.5 40L43.5 24.5" strokeLinecap="butt" strokeLinejoin="miter" />
	</svg>
);
