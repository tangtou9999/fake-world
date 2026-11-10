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
};

export const PERSONA_KEYS = ["role", "origin", "age", "style", "relation", "story", "scene", "plot"] as const;

export const EMPTY_PERSONA: PersonaCard = {
	role: "",
	origin: "",
	age: "",
	style: "",
	relation: "",
	story: "",
	scene: "",
	plot: "",
};

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

/** 追加在原系统提示后面。空卡不占 token。 */
export const personaSystemExtra = (card: PersonaCard) => {
	const rows = LABELS.flatMap(([key, label]) => {
		const value = card[key].trim();
		return value ? [`${label}：${value}`] : [];
	});
	if (!rows.length) return "";
	return `\n【人设卡】\n${rows.join("\n")}\n人设卡里的当前场景和临时剧情优先于之前聊天记录体现的关系和话题；聊天记录只作背景参考。`;
};
