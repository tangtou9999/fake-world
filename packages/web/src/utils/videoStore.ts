/** 视频通话用的视频：存在手机本地（IndexedDB），每个聊天各一段 */
const DB = "wx-video";
const STORE = "v";
const open = () =>
	new Promise<IDBDatabase>((res, rej) => {
		const r = indexedDB.open(DB, 1);
		r.onupgradeneeded = () => r.result.createObjectStore(STORE);
		r.onsuccess = () => res(r.result);
		r.onerror = () => rej(r.error);
	});
export const getCallVideo = async (key: string): Promise<Blob | null> => {
	try {
		const db = await open();
		return await new Promise((res) => {
			const rq = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
			rq.onsuccess = () => res((rq.result as Blob | undefined) ?? null);
			rq.onerror = () => res(null);
		});
	} catch {
		return null;
	}
};
export const putCallVideo = async (key: string, blob: Blob): Promise<boolean> => {
	try {
		const db = await open();
		return await new Promise((res) => {
			const tx = db.transaction(STORE, "readwrite");
			tx.objectStore(STORE).put(blob, key);
			tx.oncomplete = () => res(true);
			tx.onerror = () => res(false);
			tx.onabort = () => res(false);
		});
	} catch {
		return false;
	}
};
