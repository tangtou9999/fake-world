import { DEFAULT_GEMINI_MODEL, RETIRED_MODELS, getGeminiConfig } from "@/stateV2/gemini";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiError = { status?: number; message: string };

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export type GeminiImage = { mime: string; data: string };

async function callOnce(model: string, apiKey: string, prompt: string, json: boolean, images: GeminiImage[] = []) {
	const res = await fetch(`${BASE}/${model}:generateContent`, {
		method: "POST",
		headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
		body: JSON.stringify({
			contents: [
				{
					role: "user",
					parts: [
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
		throw { message: data?.promptFeedback?.blockReason ? "内容被 Gemini 拦截，换个说法试试" : "Gemini 没有返回内容" } as GeminiError;
	}
	return text as string;
}

/** 调用 Gemini；遇到繁忙 / 限流会自动换备用模型重试 */
export async function callGemini(prompt: string, options: { json?: boolean; images?: GeminiImage[] } = {}) {
	const { apiKey, model } = getGeminiConfig();
	if (!apiKey) throw new Error("还没有填 API 密钥：我 → 设置 → AI 助手");
	const chosen = !model || RETIRED_MODELS.includes(model) ? DEFAULT_GEMINI_MODEL : model;
	const models = Array.from(new Set([chosen, DEFAULT_GEMINI_MODEL, "gemini-flash-latest", "gemini-3-flash-preview"]));
	let last: GeminiError = { message: "未知错误" };
	for (const m of models) {
		for (let attempt = 0; attempt < 2; attempt++) {
			try {
				return await callOnce(m, apiKey, prompt, !!options.json, options.images);
			} catch (e) {
				last = e as GeminiError;
				if (last.status === 400 || last.status === 403 || last.status === 401) {
					throw new Error(`密钥或请求有问题（${last.status}）：${last.message}`);
				}
				if (last.status === 404) break; // 模型不存在 → 换下一个
				if (!last.status || RETRYABLE.has(last.status)) {
					await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
					continue;
				}
				throw new Error(last.message);
			}
		}
	}
	// 预设的模型都不行时：向谷歌查询这个密钥当前可用的模型，挑 flash 系列再试一次
	try {
		const available = (await listGeminiModels(apiKey)).filter((n) => /flash/.test(n) && !models.includes(n)).slice(0, 3);
		for (const m of available) {
			try {
				return await callOnce(m, apiKey, prompt, !!options.json, options.images);
			} catch (e) {
				last = e as GeminiError;
			}
		}
	} catch {
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
