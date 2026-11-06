import { DEFAULT_TTS_MODEL, getGeminiConfig } from "@/stateV2/gemini";
import { speakText } from "./voice";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

let ctx: AudioContext | null = null;
let current: AudioBufferSourceNode | null = null;
const cache = new Map<string, AudioBuffer>();

/** iOS 要求在点击等用户手势里「解锁」音频，之后异步播放才不会被拦 */
export const unlockAudio = () => {
	try {
		const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		ctx = ctx ?? new AC();
		void ctx.resume();
	} catch {
		// ignore
	}
};

export const stopSpeaking = () => {
	try {
		current?.stop();
	} catch {
		// ignore
	}
	current = null;
	if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
};

const b64ToBytes = (b64: string) => {
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
};

/** 调用 Gemini 语音合成，返回可播放的音频；失败会抛错 */
const synth = async (text: string, voice: string): Promise<AudioBuffer> => {
	const key = `${voice}|${text}`;
	const hit = cache.get(key);
	if (hit) return hit;
	const { apiKey, ttsModel } = getGeminiConfig();
	if (!apiKey) throw new Error("还没有填 API 密钥");
	if (!ctx) unlockAudio();
	if (!ctx) throw new Error("这个浏览器不支持音频播放");
	const models = Array.from(new Set([ttsModel || DEFAULT_TTS_MODEL, DEFAULT_TTS_MODEL, "gemini-2.5-pro-preview-tts"]));
	let lastErr = "未知错误";
	for (const m of models) {
		const res = await fetch(`${BASE}/${m}:generateContent`, {
			method: "POST",
			headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
			body: JSON.stringify({
				contents: [{ parts: [{ text: `用自然、口语化的语气朗读（保持原文语言）：${text}` }] }],
				generationConfig: {
					responseModalities: ["AUDIO"],
					speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
				},
			}),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) {
			lastErr = data?.error?.message || `HTTP ${res.status}`;
			if (res.status === 404 || res.status === 429 || res.status >= 500) continue;
			throw new Error(lastErr);
		}
		const part = data?.candidates?.[0]?.content?.parts?.find((p: { inlineData?: unknown; inline_data?: unknown }) => p.inlineData || p.inline_data);
		const inline = part?.inlineData ?? part?.inline_data;
		if (!inline?.data) {
			lastErr = "Gemini 没有返回声音";
			continue;
		}
		const mime: string = inline.mimeType ?? inline.mime_type ?? "";
		const bytes = b64ToBytes(inline.data);
		let buf: AudioBuffer;
		if (/L16|pcm/i.test(mime) || !mime) {
			const rate = Number(mime.match(/rate=(\d+)/)?.[1] ?? 24000);
			const samples = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
			buf = ctx.createBuffer(1, samples.length, rate);
			const ch = buf.getChannelData(0);
			for (let i = 0; i < samples.length; i++) ch[i] = samples[i] / 32768;
		} else {
			buf = await ctx.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
		}
		cache.set(key, buf);
		return buf;
	};
	throw new Error(lastErr);
};

/** 用 Gemini 的声音朗读；失败时退回手机自带的朗读，并返回提示文字 */
export const geminiSpeak = async (rawText: string, voice: string): Promise<string | null> => {
	const text = rawText.replace(/```[\s\S]*?```/g, "").replace(/[*#>`_~]/g, "").trim().slice(0, 900);
	if (!text) return null;
	stopSpeaking();
	try {
		const buf = await synth(text, voice || "Kore");
		if (!ctx) return null;
		await ctx.resume();
		const src = ctx.createBufferSource();
		src.buffer = buf;
		src.connect(ctx.destination);
		src.start();
		current = src;
		return null;
	} catch (e) {
		speakText(text);
		return `Gemini 声音不可用，已改用手机自带声音：${e instanceof Error ? e.message : String(e)}`;
	}
};
