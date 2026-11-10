/** 备份：把本机保存的所有聊天、朋友圈、钱包、设置导出成一个 JSON 文件（不含 AI 密钥，图片/视频/语音文件也不含） */
const SKIP = new Set(["gemini-config"]);

export const exportBackup = () => {
	const data: Record<string, string> = {};
	for (let i = 0; i < localStorage.length; i++) {
		const k = localStorage.key(i);
		if (!k || SKIP.has(k)) continue;
		data[k] = localStorage.getItem(k) ?? "";
	}
	const blob = new Blob([JSON.stringify({ app: "fake-world", v: 1, at: Date.now(), data })], { type: "application/json" });
	const a = document.createElement("a");
	a.href = URL.createObjectURL(blob);
	const d = new Date();
	a.download = `fake-world-备份-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.json`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	return Object.keys(data).length;
};

export const importBackup = async (file: File) => {
	const j = JSON.parse(await file.text()) as { app?: string; data?: Record<string, string> };
	if (j.app !== "fake-world" || !j.data) throw new Error("不是本应用的备份文件");
	for (const [k, v] of Object.entries(j.data)) {
		if (SKIP.has(k)) continue;
		localStorage.setItem(k, v);
	}
	return Object.keys(j.data).length;
};
