import { TEXT_MODEL_CHAIN } from "@/stateV2/gemini";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** 把单个密钥的报错翻成大白话 */
export const explainKeyError = (status: number | undefined, msg: string) => {
	if (status === 429 || /quota|RESOURCE_EXHAUSTED|exceeded/i.test(msg)) return "额度用完了（这个密钥现在不能用，等刷新或换另一个）";
	if (status === 400 && /API key|API_KEY/i.test(msg)) return "密钥无效（可能复制错了或少了一部分）";
	if (status === 401 || status === 403 || /API key|permission/i.test(msg)) return "密钥无效、被停用，或没有开通这个功能";
	if (status === 404) return "Google 找不到这个模型（换一个模型试试）";
	if (status && status >= 500) return "Google 服务器暂时繁忙，稍后再试";
	return msg.slice(0, 80) || "失败了";
};

const post = async (model: string, key: string, body: unknown) => {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 20000);
	try {
		const res = await fetch(`${BASE}/${model}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body), signal: ctrl.signal });
		const data = await res.json().catch(() => ({}));
		return { status: res.status, ok: res.ok, data, msg: String(data?.error?.message ?? "") };
	} catch (e) {
		return { status: 0, ok: false, data: {}, msg: ctrl.signal.aborted ? "20 秒没有回应" : e instanceof Error ? e.message : String(e) };
	} finally {
		clearTimeout(t);
	}
};

/** 单独测试某一个密钥：文字 AI 和语音各测一次，返回大白话结果 */
export const probeKey = async (key: string, tts: boolean) => {
	if (!tts) {
		let last = "";
		for (const m of TEXT_MODEL_CHAIN) {
			const r = await post(m, key, { contents: [{ parts: [{ text: "只回复一个字：好" }] }] });
			if (r.ok) return { ok: true, text: `正常（${m}）` };
			last = explainKeyError(r.status, r.msg);
			if (r.status !== 404) break;
		}
		return { ok: false, text: last };
	}
	const r = await post("gemini-2.5-flash-preview-tts", key, {
		contents: [{ parts: [{ text: "说：好" }] }],
		generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } },
	});
	const has = r.ok && JSON.stringify(r.data).includes("inlineData");
	return has ? { ok: true, text: "正常" } : { ok: false, text: explainKeyError(r.status, r.msg) };
};
