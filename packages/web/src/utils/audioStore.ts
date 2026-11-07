/** 把生成好的语音存在手机本地（IndexedDB）：以后再点播放直接用，不用联网、不再消耗额度 */
export type Clip = { sig: string; rate: number; pcm: Int16Array };

const DB = "wx-audio";
const STORE = "clips";

const open = () =>
	new Promise<IDBDatabase>((res, rej) => {
		const r = indexedDB.open(DB, 1);
		r.onupgradeneeded = () => r.result.createObjectStore(STORE);
		r.onsuccess = () => res(r.result);
		r.onerror = () => rej(r.error);
	});

const run = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> => {
	try {
		const db = await open();
		return await new Promise<T | null>((res) => {
			const tx = db.transaction(STORE, mode);
			const rq = fn(tx.objectStore(STORE));
			rq.onsuccess = () => res(rq.result);
			rq.onerror = () => res(null);
			tx.oncomplete = () => db.close();
		});
	} catch {
		return null;
	}
};

export const getClip = (key: string) => run<Clip | undefined>("readonly", (s) => s.get(key) as IDBRequest<Clip | undefined>);
export const putClip = (key: string, clip: Clip) => run("readwrite", (s) => s.put(clip, key));
export const delClip = (key: string) => run("readwrite", (s) => s.delete(key));

/** 删掉某个聊天里已经不存在的消息留下的语音 */
export const pruneClips = async (prefix: string, keep: Set<string>) => {
	const keys = (await run<IDBValidKey[]>("readonly", (s) => s.getAllKeys())) ?? [];
	for (const k of keys) {
		if (typeof k === "string" && k.startsWith(prefix) && !keep.has(k)) await delClip(k);
	}
};
