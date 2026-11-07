import { ADULT_MODE_PROMPT, DEFAULT_GEMINI_MODEL, RETIRED_MODELS, getGeminiConfig } from "@/stateV2/gemini";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiError = { status?: number; message: string };

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export type GeminiImage = { mime: string; data: string };

export type GeminiTurn = { role: "user" | "model"; text: string };
type Extra = { history?: GeminiTurn[]; system?: string; audio?: GeminiImage };

/** 被 Gemini 的内容过滤拦截（不是网络问题，不用重试） */
export class GeminiBlockedError extends Error {
	blocked = true;
}

async function callOnce(model: string, apiKey: string, prompt: string, json: boolean, images: GeminiImage[] = [], extra: Extra = {}) {
	const adult = getGeminiConfig().adultMode !== false;
	const res = await fetch(`${BASE}/${model}:generateContent`, {
		method: "POST",
		headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
		body: JSON.stringify({
			...(adult || extra.system
				? {
						systemInstruction: {
							parts: [{ text: [adult ? ADULT_MODE_PROMPT : "", extra.system ?? ""].filter(Boolean).join("\n\n") }],
						},
					}
				: {}),
			...(adult
				? {
						safetySettings: [
							"HARM_CATEGORY_HARASSMENT",
							"HARM_CATEGORY_HATE_SPEECH",
							"HARM_CATEGORY_SEXUALLY_EXPLICIT",
							"HARM_CATEGORY_DANGEROUS_CONTENT",
						].map((category) => ({ category, threshold: "BLOCK_NONE" })),
					}
				: {}),
			contents: [
				...(extra.history ?? []).map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
				{
					role: "user",
					parts: [
						...(extra.audio ? [{ inline_data: { mime_type: extra.audio.mime, data: extra.audio.data } }] : []),
						...images.flatMap((img, i) => [
							{ text: `第 ${i + 1} 张截图：` },
							{ inline_data: { mime_type: img.mime, data: img.data } },
						]),
						{ text: prompt },
					],
				},
			],
			generationConfig: {
				temperature: 1,
				...(json ? { responseMimeType: "application/json" } : {}),
			},
		}),
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		const err: GeminiError = {
			status: res.status,
			message: data?.error?.message || `HTTP ${res.status}`,
		};
		throw err;
	}
	const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
	if (!text) {
		const reason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason;
		if (reason && reason !== "STOP") {
			throw new GeminiBlockedError(`内容被 Gemini 拦截（${reason}）`);
		}
		throw { message: "Gemini 没有返回内容" } as GeminiError;
	}
	return text as string;
}

/** 调用 Gemini；遇到繁忙 / 限流会自动换备用模型重试 */
type CallOptions = { json?: boolean; images?: GeminiImage[]; history?: GeminiTurn[]; system?: string; audio?: GeminiImage; model?: string };

/** 先用主密钥；主密钥出错（额度用完、繁忙、密钥失效等）且填了备用密钥时，自动改用备用密钥。被内容拦截不换密钥。 */
export async function callGemini(prompt: string, options: CallOptions = {}) {
	const { apiKey, apiKey2 } = getGeminiConfig();
	if (!apiKey && !apiKey2) throw new Error("还没有填 API 密钥：我 → 设置 → AI 助手");
	const keys = [apiKey, apiKey2].filter((k): k is string => !!k);
	let lastErr: unknown;
	for (const [i, k] of keys.entries()) {
		try {
			// 还有备用密钥时，主密钥只快速试一次，出错立刻换备用，不干等
			return await callGeminiWithKey(k, prompt, options, i < keys.length - 1);
		} catch (e) {
			if (e instanceof GeminiBlockedError) throw e;
			lastErr = e;
		}
	}
	throw lastErr;
}

async function callGeminiWithKey(apiKey: string, prompt: string, options: CallOptions, quick = false) {
	const { model } = getGeminiConfig();
	const pick = options.model || model;
	const chosen = !pick || RETIRED_MODELS.includes(pick) ? DEFAULT_GEMINI_MODEL : pick;
	const models = quick ? [chosen] : Array.from(new Set([chosen, DEFAULT_GEMINI_MODEL, "gemini-flash-latest", "gemini-3-flash-preview"]));
	let last: GeminiError = { message: "未知错误" };
	for (const m of models) {
		for (let attempt = 0; attempt < (quick ? 1 : 2); attempt++) {
			try {
				return await callOnce(m, apiKey, prompt, !!options.json, options.images, options);
			} catch (e) {
				if (e instanceof GeminiBlockedError) throw e;
				last = e as GeminiError;
				if (last.status === 400 || last.status === 403 || last.status === 401) {
					throw new Error(`密钥或请求有问题（${last.status}）：${last.message}`);
				}
				if (last.status === 404) break; // 模型不存在 → 换下一个
				if (!last.status || RETRYABLE.has(last.status)) {
					if (!quick) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
					continue;
				}
				throw new Error(last.message);
			}
		}
	}
	if (quick) throw new Error(`Gemini 暂时不可用（${last.status ?? "网络"}）：${last.message}`);
	// 预设的模型都不行时：向谷歌查询这个密钥当前可用的模型，挑 flash 系列再试一次
	try {
		const available = (await listGeminiModels(apiKey)).filter((n) => /flash/.test(n) && !models.includes(n)).slice(0, 3);
		for (const m of available) {
			try {
				return await callOnce(m, apiKey, prompt, !!options.json, options.images, options);
			} catch (e) {
				if (e instanceof GeminiBlockedError) throw e;
				last = e as GeminiError;
			}
		}
	} catch (e) {
		if (e instanceof GeminiBlockedError) throw e;
		// ignore
	}
	throw new Error(`Gemini 暂时不可用（${last.status ?? "网络"}）：${last.message}`);
}

/** 列出这个密钥可用于聊天的模型（只要名字） */
export async function listGeminiModels(apiKey = getGeminiConfig().apiKey): Promise<string[]> {
	const res = await fetch(`${BASE}?pageSize=200`, { headers: { "x-goog-api-key": apiKey } });
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
	return (data.models ?? [])
		.filter((m: { supportedGenerationMethods?: string[]; name: string }) => m.supportedGenerationMethods?.includes("generateContent"))
		.map((m: { name: string }) => m.name.replace(/^models\//, ""))
		.filter((n: string) => !/tts|image|embedding|live|audio|robotics|computer/.test(n));
}

/** 从模型返回里取出 JSON（容忍 ```json 包裹） */
export function parseJsonLoose<T>(text: string): T {
	const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
	return JSON.parse(cleaned) as T;
}

/** 把相册里的图片压缩到最长边 1600px 的 JPEG，再转成 base64（减小请求体积） */
export async function fileToGeminiImage(file: File, maxSide = 1600): Promise<GeminiImage> {
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement("canvas");
	canvas.width = Math.round(bitmap.width * scale);
	canvas.height = Math.round(bitmap.height * scale);
	canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
	return { mime: "image/jpeg", data: dataUrl.split(",")[1] };
}
