declare const __BUILD_ID__: string;

/** 「添加到主屏幕」的网页会死死缓存旧页面。每次打开 / 回到前台时问一下线上最新版本号，不一样就换个地址重新加载。 */
export function startVersionCheck() {
	const mine = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";
	if (mine === "dev") return;
	const check = async () => {
		try {
			const res = await fetch(`./version.json?t=${Date.now()}`, { cache: "no-store" });
			if (!res.ok) return;
			const { id } = (await res.json()) as { id?: string };
			if (!id || id === mine) return;
			if (sessionStorage.getItem("ver-reload") === id) return;
			sessionStorage.setItem("ver-reload", id);
			window.location.replace(`${window.location.pathname}?v=${id}${window.location.hash}`);
		} catch {
			// 没网就算了
		}
	};
	void check();
	document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void check());
}
