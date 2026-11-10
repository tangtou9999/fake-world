import { parseJsonLoose } from "@/utils/gemini";
import { mainStore } from "@/stateV2/store";
import Dexie, { type Table } from "dexie";
import { atom } from "jotai";

/** 每个联系人一张，自由文本，可留空。不进聊天记录。 */
export type PersonaCard = {
	role: string;
	origin: string;
	age: string;
	style: string;
	relation: string;
	story: string;
	scene: string;
	plot: string;
	/** 字数、禁用词、情绪起伏、表情、停顿。生成回复时单独标明必须遵守。 */
	rules: string;
};

export const PERSONA_KEYS = ["role", "origin", "age", "style", "relation", "story", "scene", "plot", "rules"] as const;

/** 关键词扩写要填满的栏。临时剧情 plot 仍只手动改。 */
export const PERSONA_FILL_KEYS = ["role", "origin", "age", "style", "relation", "story", "scene", "rules"] as const;

export const EMPTY_PERSONA: PersonaCard = {
	role: "",
	origin: "",
	age: "",
	style: "",
	relation: "",
	story: "",
	scene: "",
	plot: "",
	rules: "",
};

export const RULES_EXAMPLE =
	"每条不超过 25 字；禁用词：……；每 3 条至少 1 条带辩解/抱怨/赌气；被骂时只回 1–5 字；不复读上一句关键词；每条最多 1 个表情，宁可不用；连续长回复后接一条短的。";

/** 编辑模式里点「人设」才打开。不持久化，退出编辑模式即关。 */
export const personaEditorAtom = atom(false);

export const PERSONA_FILL_SYSTEM = `你在帮用户填写微信好友的人设卡。只输出一个 JSON 对象，不要 markdown，不要解释。
键只能是这些：role 角色/身份，origin 籍贯，age 年龄（周岁，只写数字），style 性格与说话风格，relation 和我的关系，story 背景故事，scene 当前场景/话题，rules 对话规则，say 给用户的一句短确认。
不要输出 plot。
用户只给关键词时，扩写除 say 以外的每一个键，写具体、能直接用，不要把关键词原样塞进一个键。
用户要改某一项（如「年龄改大一点」）时，在当前人设卡上改，其余键原样带回。
年龄和出生年份按用户消息里的「今天」对齐：没写月日则年龄 = 今年 − 出生年；写了月日且今年生日还没到则年龄再减 1。文案里如果写了出生年，必须和 age 一致。
rules 写成可执行的对话规则，包含字数、禁用词、情绪起伏、表情和停顿，不要留空。
say 用一句口语，不要重复各栏正文。`;

type PersonaRow = PersonaCard & { id: string };

const db = new Dexie("PersonaCardsDB") as Dexie & { cards: Table<PersonaRow, string> };
db.version(1).stores({ cards: "&id" });

export const personaMapAtom = atom<Record<string, PersonaCard>>({});

const cache = new Map<string, PersonaCard>();

const fill = (row: Partial<PersonaRow>): PersonaCard => {
	const card = { ...EMPTY_PERSONA };
	for (const key of PERSONA_KEYS) card[key] = String(row[key] ?? "");
	return card;
};

let loading: Promise<void> | null = null;

export const loadPersonas = () => {
	if (!loading) {
		loading = db.cards
			.toArray()
			.then((rows) => {
				const map: Record<string, PersonaCard> = {};
				for (const row of rows) {
					const card = fill(row);
					cache.set(row.id, card);
					map[row.id] = card;
				}
				mainStore.set(personaMapAtom, map);
			})
			.catch((err) => {
				loading = null;
				throw err;
			});
	}
	return loading;
};

void loadPersonas().catch(() => undefined);

export const peekPersona = (id: string) => cache.get(id) ?? EMPTY_PERSONA;

export const readPersona = async (id: string) => {
	await loadPersonas();
	return cache.get(id) ?? EMPTY_PERSONA;
};

/** 手动编辑和私人 AI 确认后都走这里。只写人设卡，不碰聊天记录。 */
export const writePersona = async (id: string, patch: Partial<PersonaCard>) => {
	await loadPersonas();
	const next = { ...(cache.get(id) ?? EMPTY_PERSONA) };
	for (const key of PERSONA_KEYS) {
		if (patch[key] !== undefined) next[key] = patch[key] ?? "";
	}
	cache.set(id, next);
	mainStore.set(personaMapAtom, { ...mainStore.get(personaMapAtom), [id]: next });
	await db.cards.put({ ...next, id });
	return next;
};

const LABELS: [keyof PersonaCard, string][] = [
	["role", "角色/身份"],
	["origin", "籍贯"],
	["age", "年龄"],
	["style", "性格与说话风格"],
	["relation", "和我的关系"],
	["story", "背景故事"],
	["scene", "当前场景/话题"],
	["plot", "临时剧情"],
];

/** 追加在原系统提示后面。空卡不占 token。rules 单独标明必须遵守，不改原提示。 */
export const personaSystemExtra = (card: PersonaCard) => {
	const rows = LABELS.flatMap(([key, label]) => {
		const value = card[key].trim();
		return value ? [`${label}：${value}`] : [];
	});
	const rules = card.rules.trim();
	if (!rows.length && !rules) return "";
	let out = "";
	if (rows.length) {
		out += `\n【人设卡】\n${rows.join("\n")}\n人设卡里的当前场景和临时剧情优先于之前聊天记录体现的关系和话题；聊天记录只作背景参考。`;
	}
	if (rules) out += `\n必须严格遵守以下对话规则：\n${rules}`;
	return out;
};

const BIRTH_RE =
	/(?:(?:出生于|生于|生日(?:是|为)?\s*)((?:19|20)\d{2})(?:\s*年(?:\s*(\d{1,2})\s*月(?:\s*(\d{1,2})\s*[日号])?)?)?|((?:19|20)\d{2})\s*年(?:\s*(\d{1,2})\s*月(?:\s*(\d{1,2})\s*[日号])?)?\s*(?:出生|生(?:的|于|人)?)(?![活日]))/;

/** 年龄数字与文案里的出生年按今天对齐。有月日且生日未到则年龄减 1。 */
export const alignPersonaAge = (card: PersonaCard, today = new Date()): PersonaCard => {
	const year = today.getFullYear();
	const next = { ...card };
	const ageMatch = next.age.trim().match(/^(\d{1,3})\s*岁?$/);
	const ageN = ageMatch ? Number(ageMatch[1]) : Number.NaN;
	if (ageMatch && ageN >= 0 && ageN < 130) next.age = String(ageN);
	const joined = PERSONA_KEYS.filter((key) => key !== "age")
		.map((key) => next[key])
		.join("\n");
	const hit = joined.match(BIRTH_RE);
	if (!hit) return next;
	const y = Number(hit[1] || hit[4]);
	const m = Number(hit[2] || hit[5]) || 0;
	const d = Number(hit[3] || hit[6]) || 0;
	const notYet = m > 0 && (today.getMonth() + 1) * 100 + today.getDate() < m * 100 + (d || 1);
	const ageOf = (birthYear: number) => year - birthYear - (notYet ? 1 : 0);
	if (Number.isFinite(ageN) && ageN >= 0 && ageN < 130) {
		let by = year - ageN;
		if (ageOf(by) !== ageN) by = year - ageN - 1;
		if (by !== y && by >= 1900 && by <= year) {
			const from = String(y);
			const to = String(by);
			for (const key of PERSONA_KEYS) {
				if (key === "age") continue;
				next[key] = next[key].replace(BIRTH_RE, (full) => full.replace(from, to));
			}
		}
		return next;
	}
	const age = ageOf(y);
	if (age >= 0 && age < 130) next.age = String(age);
	return next;
};

/** 编辑面板里的关键词扩写。缺的键保留上一版，再按今天对齐年龄。 */
export const personaFromModel = (raw: string, prev: PersonaCard): { say: string; card?: PersonaCard } => {
	try {
		const parsed = parseJsonLoose<Partial<Record<keyof PersonaCard, unknown>> & { say?: unknown }>(raw);
		const card = { ...prev };
		let any = false;
		for (const key of PERSONA_FILL_KEYS) {
			const value = parsed[key];
			if (value === undefined || value === null || typeof value === "object") continue;
			card[key] = String(value);
			any = true;
		}
		const say = String(parsed.say ?? "").trim();
		if (!any) return { say: say || "没解析出要填的栏，再说一次？" };
		return { say: say || "填好了，可以在下面改。", card: alignPersonaAge(card) };
	} catch {
		return { say: "没有读懂这次的结果，再说一次？" };
	}
};
