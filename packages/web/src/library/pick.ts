import catalog from "../../public/library/index.json";

/** 站点里的素材路径。Vite `base: "./"` 时用 BASE_URL，GitHub Pages 子路径也能访问。 */
export type LibraryItem = {
	path: string;
	category: string;
	tags: string[];
	source: string;
	license: string;
};

const items = catalog.items as LibraryItem[];

const AVATAR_STYLES: { category: string; keys: string[] }[] = [
	{
		category: "avatars/jingshenxiaomei",
		keys: ["精神小妹", "jingshenxiaomei", "jsxm", "墨镜", "霓虹", "edgy", "neon", "潮妹", "很酷"],
	},
	{
		category: "avatars/zhichang",
		keys: ["职场", "zhichang", "zczn", "通勤", "白领", "干练", "优雅", "office", "elegant"],
	},
	{
		category: "avatars/nvsheng_other",
		keys: [
			"nvsheng",
			"花束",
			"风景头像",
			"宠物",
			"猫咪",
			"狗狗",
			"兔子",
			"温柔",
			"flowers",
			"sakura",
			"soft",
		],
	},
];

const MOMENT_THEMES: { category: string; keys: string[] }[] = [
	{
		category: "moments/food",
		keys: [
			"吃饭",
			"美食",
			"火锅",
			"烧烤",
			"咖啡",
			"奶茶",
			"蛋糕",
			"甜品",
			"午餐",
			"晚餐",
			"早餐",
			"夜宵",
			"下午茶",
			"面包",
			"水果",
			"寿司",
			"拉面",
			"饺子",
			"餐厅",
			"外卖",
			"好吃",
			"甜品店",
			"food",
			"cake",
			"coffee",
			"dessert",
			"sushi",
			"brunch",
			"tea",
		],
	},
	{
		category: "moments/travel",
		keys: [
			"旅行",
			"旅游",
			"出游",
			"度假",
			"机票",
			"机场",
			"高铁",
			"火车",
			"酒店",
			"民宿",
			"出差",
			"自驾",
			"景点",
			"航班",
			"旅途",
			"travel",
			"trip",
			"flight",
			"hotel",
		],
	},
	{
		category: "moments/scenery",
		keys: [
			"风景",
			"日落",
			"日出",
			"海边",
			"大海",
			"湖边",
			"湖泊",
			"爬山",
			"夜景",
			"雪景",
			"樱花",
			"晚霞",
			"星空",
			"沙滩",
			"公园",
			"花园",
			"scenery",
			"sunset",
			"beach",
			"lake",
			"mountain",
		],
	},
	{
		category: "moments/lifestyle",
		keys: [
			"健身",
			"跑步",
			"瑜伽",
			"读书",
			"加班",
			"下班",
			"日常",
			"生活",
			"购物",
			"逛街",
			"电影",
			"追剧",
			"周末",
			"lifestyle",
		],
	},
];

const sessionAvatars = new Set<string>();
const sessionMoments = new Set<string>();

export function libraryPublicUrl(relativePath: string) {
	const base = import.meta.env.BASE_URL || "./";
	const prefix = base.endsWith("/") ? base : `${base}/`;
	return `${prefix}library/${relativePath.replace(/^\/+/, "")}`;
}

function libraryPath(value: string) {
	const marker = "library/";
	const at = value.indexOf(marker);
	if (at >= 0) return value.slice(at + marker.length).split(/[?#]/)[0];
	if (value.startsWith("avatars/") || value.startsWith("moments/")) return value;
	return undefined;
}

function shuffle<T>(list: T[]) {
	const bag = list.slice();
	for (let i = bag.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[bag[i], bag[j]] = [bag[j], bag[i]];
	}
	return bag;
}

function includesHint(hint: string, key: string) {
	return hint.toLowerCase().includes(key.toLowerCase());
}

function avatarScore(item: LibraryItem, hint: string) {
	if (!hint) return 0;
	let score = 0;
	for (const style of AVATAR_STYLES) {
		if (item.category !== style.category) continue;
		if (style.keys.some((key) => includesHint(hint, key))) score += 5;
	}
	for (const tag of item.tags) {
		const nonAscii = [...tag].some((ch) => ch.charCodeAt(0) > 127);
		if (tag.length < 3 && !nonAscii) continue;
		if (includesHint(hint, tag)) score += 2;
		for (const alias of TAG_ALIASES[tag] ?? []) {
			if (includesHint(hint, alias)) score += 2;
		}
	}
	return score;
}

const TAG_ALIASES: Record<string, string[]> = {
	cat: ["猫", "猫咪"],
	dog: ["狗", "狗狗"],
	bunny: ["兔", "兔子"],
	pet: ["宠物"],
	flowers: ["花", "鲜花", "花束"],
	scenery: ["风景"],
	sunset: ["日落", "晚霞"],
	coffee: ["咖啡"],
	glasses: ["眼镜"],
	sunglasses: ["墨镜"],
};

function storedAvatarPaths() {
	try {
		const raw = localStorage.getItem("allProfiles");
		if (!raw) return [] as string[];
		const list = JSON.parse(raw) as { avatarInfo?: string }[];
		if (!Array.isArray(list)) return [];
		return list.map((profile) => profile?.avatarInfo).filter((url): url is string => !!url);
	} catch {
		return [];
	}
}

function toPathSet(values: Iterable<string> | undefined) {
	const set = new Set<string>();
	if (!values) return set;
	for (const value of values) {
		const path = libraryPath(value);
		if (path) set.add(path);
	}
	return set;
}

/**
 * 给新好友挑一张头像。hint 里能看出风格（精神小妹 / 职场 / 花、宠物、风景）就按风格，否则随机。
 * 已经用过的（本次会话，以及本地已经存下的好友头像）会尽量避开。
 */
export function pickFriendAvatar(hint = "", avoid?: Iterable<string>) {
	const pool = items.filter((item) => item.category.startsWith("avatars/"));
	const blocked = toPathSet([...(avoid ?? []), ...storedAvatarPaths()]);
	for (const path of sessionAvatars) blocked.add(path);
	const ranked = pool.map((item) => ({ item, score: avatarScore(item, hint) }));
	const scores = [...new Set(ranked.map((row) => row.score))].sort((a, b) => b - a);
	let chosen: LibraryItem | undefined;
	for (const score of scores) {
		const fresh = shuffle(ranked.filter((row) => row.score === score).map((row) => row.item)).find(
			(item) => !blocked.has(item.path),
		);
		if (fresh) {
			chosen = fresh;
			break;
		}
	}
	if (!chosen) {
		const preferred = shuffle(
			ranked.filter((row) => row.score === scores[0]).map((row) => row.item),
		);
		chosen = preferred[0] ?? pool[0];
	}
	sessionAvatars.add(chosen.path);
	return libraryPublicUrl(chosen.path);
}

const CN_COUNT = "一二三四五六七八九";

function parseImageCount(text: string) {
	if (/九宫格/.test(text)) return 9;
	const matched = text.match(/([1-9]|[一二两三四五六七八九])\s*[张幅]/);
	if (!matched) return undefined;
	const token = matched[1];
	if (/[1-9]/.test(token)) return Number(token);
	const index = CN_COUNT.indexOf(token === "两" ? "二" : token);
	return index >= 0 ? index + 1 : undefined;
}

function momentCategory(text: string) {
	let best = "moments/lifestyle";
	let bestScore = 0;
	for (const theme of MOMENT_THEMES) {
		const score = theme.keys.reduce((sum, key) => sum + (includesHint(text, key) ? 1 : 0), 0);
		if (score > bestScore) {
			best = theme.category;
			bestScore = score;
		}
	}
	return { category: best, score: bestScore };
}

/**
 * 朋友圈配图。uploaded 有内容就原样用（最多 9 张）；否则按正文主题从 moments/ 里挑 1–9 张。
 */
export function pickMomentImages(options?: {
	text?: string;
	/** 用户的整段要求。正文自己已经能对上主题时不用它，避免一条要求里的别的话题盖过这条正文。 */
	hint?: string;
	uploaded?: readonly string[] | null;
	count?: number;
	avoid?: Iterable<string>;
}) {
	const uploaded = (options?.uploaded ?? [])
		.map((url) => url.trim())
		.filter(Boolean)
		.slice(0, 9);
	if (uploaded.length) return uploaded;

	const text = options?.text ?? "";
	const count = Math.min(
		9,
		Math.max(
			1,
			options?.count ??
				parseImageCount(`${options?.hint ?? ""}\n${text}`) ??
				1 + Math.floor(Math.random() * 9),
		),
	);
	const own = momentCategory(text);
	const category =
		own.score > 0 ? own.category : momentCategory(`${options?.hint ?? ""}\n${text}`).category;
	const pool = items.filter((item) => item.category === category);
	const explicit = toPathSet(options?.avoid);
	for (const path of sessionMoments) explicit.add(path);
	let available = pool.filter((item) => !explicit.has(item.path));
	if (available.length < count) {
		for (const item of pool) sessionMoments.delete(item.path);
		const keep = toPathSet(options?.avoid);
		available = pool.filter((item) => !keep.has(item.path));
	}
	if (available.length < count) available = pool;
	const picked = shuffle(available).slice(0, count);
	for (const item of picked) sessionMoments.add(item.path);
	return picked.map((item) => libraryPublicUrl(item.path));
}
