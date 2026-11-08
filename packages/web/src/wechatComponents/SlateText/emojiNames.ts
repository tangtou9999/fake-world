/**
 * 微信表情名字 ↔ 表情面板里的位置（"行-列"，和 EMOJI_ARRAY 一致，从 0 开始）。
 * AI 生成的聊天里写 [名字]，保存时换成真正的表情图；读取聊天时再换回 [名字]。
 * 表情面板第 0、1 行（最上面两行）还没对照，对照后补在这里。
 */
const ROWS: string[][] = [
	/* 0 */ [],
	/* 1 */ [],
	/* 2 */ ["脸红", "大笑", "想吐", "偷笑", "愉快", "惊讶", "怀疑", "无语"],
	/* 3 */ ["囧", "哈哈", "军帽", "笑哭", "疑问", "嘘", "晕", "衰"],
	/* 4 */ ["骷髅", "怄火", "托腮", "冷汗", "沉思", "拜托", "呲牙", "哈欠"],
	/* 5 */ ["握拳", "委屈", "难过", "奸笑", "亲亲", "可怜", "憨笑", "口罩"],
	/* 6 */ ["震惊", "泪笑", "惊恐", "失落", "鄙视", "思考", "捂脸", "斜眼笑"],
	/* 7 */ ["得意", "微笑", "耶", "吃瓜", "奋斗", "汗", "天啊", "嫌弃"],
	/* 8 */ ["Emm", "旺柴", "好的", "吃惊", "哇", "冷漠", "666", "捂眼"],
	/* 9 */ ["叹气", "泪奔", "裂开", "嘴唇", "爱心", "心碎", "拥抱", "强"],
	/* 10 */ ["弱", "握手", "胜利", "勾引", "抱拳", "拳头", "OK", "合十"],
	/* 11 */ ["啤酒", "咖啡", "蛋糕", "玫瑰", "凋谢", "菜刀", "炸弹", "便便"],
	/* 12 */ ["月亮", "太阳", "庆祝", "礼物", "红包", "發", "福", "烟花"],
	/* 13 */ ["鞭炮", "猪头", "企鹅", "企鹅摇", "企鹅笑"],
];

const NAME_TO_SYMBOL = new Map<string, string>();
const SYMBOL_TO_NAME = new Map<string, string>();
ROWS.forEach((row, y) =>
	row.forEach((name, x) => {
		NAME_TO_SYMBOL.set(name, `${y}-${x}`);
		SYMBOL_TO_NAME.set(`${y}-${x}`, name);
	}),
);

export const EMOJI_NAME_LIST = [...NAME_TO_SYMBOL.keys()];

/** 把含 [名字] 的文字变成 Slate 段落子节点（认识的名字变表情，不认识的保留原文） */
export const textToSlateChildren = (text: string) => {
	const children: ({ text: string } | { type: "emoji"; emojiSymbol: string; children: [{ text: string }] })[] = [];
	let last = 0;
	for (const m of text.matchAll(/\[([^\[\]\s]{1,6})\]/g)) {
		const symbol = NAME_TO_SYMBOL.get(m[1]);
		if (!symbol) continue;
		children.push({ text: text.slice(last, m.index) });
		children.push({ type: "emoji", emojiSymbol: symbol, children: [{ text: "" }] });
		last = (m.index ?? 0) + m[0].length;
	}
	children.push({ text: text.slice(last) });
	return children;
};

type AnyNode = { text?: string; type?: string; emojiSymbol?: string; children?: AnyNode[] };

/** Slate 节点 → 纯文字，表情写成 [名字] */
export const slateToPlain = (node: AnyNode): string => {
	if (typeof node.text === "string") return node.text;
	if (node.type === "emoji") return `[${SYMBOL_TO_NAME.get(node.emojiSymbol ?? "") ?? "表情"}]`;
	return (node.children ?? []).map(slateToPlain).join("");
};
