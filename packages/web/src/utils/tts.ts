import { type VoiceFx, type VoiceProfile, VOICE_PACES, getGeminiConfig } from "@/stateV2/gemini";
import { type Clip, getClip, putClip } from "./audioStore";
import { speakText } from "./voice";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

let ctx: AudioContext | null = null;
const active = new Set<AudioScheduledSourceNode>();
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

let gen = 0;

/** 等所有正在播的声音播完 */
export const waitIdle = () =>
	new Promise<void>((res) => {
		const t = setInterval(() => {
			if (active.size === 0) {
				clearInterval(t);
				res();
			}
		}, 120);
	});

export const stopSpeaking = () => {
	gen++;
	for (const s of active) {
		try {
			s.stop();
		} catch {
			// ignore
		}
	}
	active.clear();
	if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
};

const b64ToBytes = (b64: string) => {
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
};

/* ---------- 台词解析：本句口气、括号备注、同音字、软化 ---------- */

const EMOTIONS: [RegExp, string][] = [
	[/抢话|打断|秒回/, "不等对方说完直接插话！起音极快、干脆利落、话赶话"],
	[/撒娇|甜糯|发嗲/, "用甜美软糯撒娇的语气说话，声音轻柔粘人，句尾自然上扬拉长"],
	[/气泡音|贴耳|耳语|刚睡醒/, "压低嗓音贴在麦克风边轻声低语，带着明显的慵懒气泡音、温热气声与轻微呼吸声"],
	[/笑|调侃|坏笑|噗嗤/, "开口前先带一声自然的轻笑或噗嗤声，嘴角带笑，用熟人开玩笑调侃的松弛口气说出"],
	[/暴怒|急眼|破音|吼/, "情绪瞬间激动失控，语速极快、声调拔高、带着强烈的不满与压迫感吼出来"],
	[/冷笑|嘲讽|毒舌|阴阳怪气/, "开口先带一声轻微冷哼，语速干脆利落，充满冷幽默与嘲讽感"],
	[/委屈|哭腔|心虚|发抖/, "声音微微发颤，带着明显的鼻音、委屈哭腔与断断续续的抽泣换气感"],
	[/无奈|叹气|心累/, "开口前先轻轻叹一口气，用疲惫、慵懒、哭笑不得的生活化口气说话"],
	[/惊讶|反问|吃瓜/, "语速加快，声调明显拔高，带着强烈的惊讶与好奇八卦感"],
];

const SOFT_TAGS = /娇喘|呻吟|情色/;
const SOFT_TEXT = "贴耳急促呼吸声、微弱气声与断续停顿";

export const expandTone = (tag: string, soften: boolean) => {
	if (!tag) return "";
	if (soften && SOFT_TAGS.test(tag)) return SOFT_TEXT;
	const hit = EMOTIONS.find(([re]) => re.test(tag));
	if (hit) return hit[1];
	return `用「${tag}」的口气说`;
};

/** 台词开头的（口气）当作本句专属口气；其余括号备注不朗读 */
export const parseLine = (raw: string) => {
	let text = raw.replace(/```[\s\S]*?```/g, "").replace(/[*#>`_~]/g, "").trim();
	let tone = "";
	const m = text.match(/^\s*(?:[^（(：:\n]{0,12})?[（(]([^）)]{1,12})[）)]\s*[:：]?\s*/);
	if (m) {
		tone = m[1];
		text = text.slice(m[0].length);
	}
	text = text.replace(/（[^）]*）|\([^)]*\)/g, "").trim();
	return { tone, text };
};

const applyDict = (text: string, dict?: string) => {
	let out = text;
	for (const line of (dict ?? "").split("\n")) {
		const i = line.indexOf("=");
		if (i <= 0) continue;
		const from = line.slice(0, i).trim();
		const to = line.slice(i + 1).trim();
		if (from) out = out.split(from).join(to);
	}
	return out;
};

const paceOf = (fx: VoiceFx) => VOICE_PACES.find((p) => p.id === (fx.pace ?? "chat")) ?? VOICE_PACES[0];

/** 这句话所处的场景对说话状态的影响（嘈杂就自然大声点，深夜被窝就压低贴耳） */
const SCENE_STATE: Record<string, string> = {
	pure: "",
	bed: "此刻深夜躺在被窝里，自动压低声音，贴耳轻声，带气声",
	living: "此刻在安静的夜晚房间里，随意放松地说",
	restaurant: "此刻在嘈杂的餐厅夜宵摊，周围很吵，说话自然稍微大声一点",
	rain: "此刻在雨夜的车里，声音略微压低，像在密闭车厢里近距离说话",
	mall: "此刻在热闹的商场里，周围人多嘈杂，说话自然稍微大声一点",
	street: "此刻在户外马路边，车流声大，说话自然提高一点音量",
};

/** 黄金拼接：人设 + 口音 + 语速节奏 + 本句口气，再加标点规则与「只读冒号后面」 */
export const buildPrompt = (raw: string, profile: VoiceProfile, fx: VoiceFx = {}, toneOverride?: string) => {
	const parsed = parseLine(raw);
	const tone = toneOverride?.trim() || parsed.tone;
	const clean = parsed.text;
	const text = applyDict(clean, fx.dict);
	const soften = fx.soften !== false;
	const air = profile.air ?? 0;
	const accent = profile.accent && profile.accent !== "默认自然口语" ? `带${profile.accent}` : "";
	const airPhrase = air >= 35 ? "带着贴耳气声、轻微气泡音与真实呼吸感" : "";
	const head = [profile.persona?.trim(), accent, paceOf(fx).prompt, SCENE_STATE[fx.scene ?? "pure"], expandTone(tone, soften), airPhrase].filter(Boolean).join("，");
	const punct = "遇到……要留出真实的欲言又止或呼吸停顿；遇到——代表话没说完急促截断；遇到？！要拔高声调质问";
	return { prompt: `${head}。${punct}。请严格只朗读冒号后面的台词内容（绝不要把前面的提示词和括号读出来）：\n${text}`, head: `${head}。${punct}`, text, tone };
};

/* ---------- 合成（主密钥 → 备用密钥，多个模型依次尝试） ---------- */

/** 去掉首尾的静音，只留 25ms 缓冲，点开语音条才能「0 延迟开口」 */
const trimSilence = (c: AudioContext, buf: AudioBuffer) => {
	const ch = buf.getChannelData(0);
	const th = 200 / 32768;
	let a = 0;
	let b = ch.length - 1;
	while (a < b && Math.abs(ch[a]) < th) a++;
	while (b > a && Math.abs(ch[b]) < th) b--;
	const pad = Math.floor(buf.sampleRate * 0.025);
	a = Math.max(0, a - pad);
	b = Math.min(ch.length - 1, b + pad);
	if (b - a < buf.sampleRate * 0.1) return buf;
	const out = c.createBuffer(1, b - a + 1, buf.sampleRate);
	out.getChannelData(0).set(ch.subarray(a, b + 1));
	return out;
};

/** 语音合成固定用官方免费的 Gemini 2.5 Flash TTS（30 款声纹）；设置里填了别的型号才优先试那个 */
const TTS_MODEL = "gemini-2.5-flash-preview-tts";

type Req = { model: string; key: string; head: string; text: string; voice: string };

/** 新型号把「语气」放在 speech_metadata.style、台词只放纯文字；旧的 2.5 型号则把说明和台词写在同一段文字里。每个型号依次试几种写法。 */
const bodies = (r: Req) => {
	const cfg = (voiceConfig: unknown) => ({ responseModalities: ["AUDIO"], speechConfig: { voiceConfig } });
	const prebuilt = { prebuiltVoiceConfig: { voiceName: r.voice } };
	const inline = { contents: [{ parts: [{ text: `${r.head}。请严格只朗读冒号后面的台词内容（绝不要把前面的提示词和括号读出来）：\n${r.text}` }] }], generationConfig: cfg(prebuilt) };
	if (/2\.5/.test(r.model)) return [inline];
	return [
		{ contents: [{ role: "user", parts: [{ text: r.text, speech_metadata: { style: r.head } }] }], generationConfig: cfg(prebuilt) },
		{ contents: [{ role: "user", parts: [{ text: r.text, speech_metadata: { style: r.head } }] }], generationConfig: cfg({ voice: r.voice }) },
		inline,
	];
};

const decodeInline = async (c: AudioContext, inline: { data: string; mimeType?: string; mime_type?: string }) => {
	const mime = inline.mimeType ?? inline.mime_type ?? "";
	const bytes = b64ToBytes(inline.data);
	let buf: AudioBuffer;
	if (/L16|pcm/i.test(mime) || !mime) {
		const rate = Number(mime.match(/rate=(\d+)/)?.[1] ?? 24000);
		const samples = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
		buf = c.createBuffer(1, Math.max(1, samples.length), rate);
		const ch = buf.getChannelData(0);
		for (let i = 0; i < samples.length; i++) ch[i] = samples[i] / 32768;
	} else {
		buf = await c.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
	}
	return trimSilence(c, buf);
};

const synth = async (head: string, text: string, voice: string): Promise<AudioBuffer> => {
	const ck = `${voice}|${head}|${text}`;
	const hit = cache.get(ck);
	if (hit) return hit;
	const { apiKey, apiKey2, ttsModel } = getGeminiConfig();
	const keys = [apiKey, apiKey2].filter((k): k is string => !!k);
	if (!keys.length) throw new Error("还没有填 API 密钥");
	if (!ctx) unlockAudio();
	const c = ctx;
	if (!c) throw new Error("这个浏览器不支持音频播放");
	const errors: string[] = [];
	const attempt = async (key: string, model: string) => {
		for (const body of bodies({ model, key, head, text, voice })) {
			let res: Response;
			try {
				res = await fetch(`${BASE}/${model}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) });
			} catch (e) {
				errors.push(`${model}：${e instanceof Error ? e.message : String(e)}`);
				return null;
			}
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				errors.push(`${model}（${res.status}）：${String(data?.error?.message ?? "").slice(0, 120)}`);
				if (res.status === 400) continue; // 换一种写法再试
				return null;
			}
			const part = data?.candidates?.[0]?.content?.parts?.find((p: { inlineData?: unknown; inline_data?: unknown }) => p.inlineData || p.inline_data);
			const inline = part?.inlineData ?? part?.inline_data;
			if (!inline?.data) {
				errors.push(`${model}：没有返回声音${data?.candidates?.[0]?.finishReason ? `（${data.candidates[0].finishReason}）` : ""}`);
				return null;
			}
			const buf = await decodeInline(c, inline);
			cache.set(ck, buf);
			return buf;
		}
		return null;
	};
	for (const key of keys) {
		for (const m of Array.from(new Set([ttsModel, TTS_MODEL].filter((x): x is string => !!x)))) {
			const r = await attempt(key, m);
			if (r) return r;
		}
	}
	const uniq = Array.from(new Set(errors)).slice(-3);
	throw new Error(uniq.join("；") || "未知错误");
};

/** 优先用本地已存的语音；没有才联网生成，生成后存到本地 */
const getBuffer = async (head: string, text: string, profile: VoiceProfile, tone: string | undefined, cacheKey?: string) => {
	const sig = JSON.stringify([profile.voice, profile.persona ?? "", profile.accent ?? "", text, tone ?? ""]);
	if (cacheKey) {
		if (!ctx) unlockAudio();
		const hit = await getClip(cacheKey);
		if (hit && hit.sig === sig && ctx) {
			const buf = ctx.createBuffer(1, Math.max(1, hit.pcm.length), hit.rate);
			const ch = buf.getChannelData(0);
			for (let i = 0; i < hit.pcm.length; i++) ch[i] = hit.pcm[i] / 32768;
			return buf;
		}
	}
	const buf = await synth(head, text, profile.voice);
	if (cacheKey) {
		const f = buf.getChannelData(0);
		const pcm = new Int16Array(f.length);
		for (let i = 0; i < f.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(f[i] * 32768)));
		const clip: Clip = { sig, rate: buf.sampleRate, pcm };
		void putClip(cacheKey, clip);
	}
	return buf;
};

/* ---------- 声学后处理：气声 / 胸腔 / 听筒 / 压限 / 声场 ---------- */

const impulse = (c: AudioContext, seconds: number) => {
	const len = Math.max(1, Math.floor(c.sampleRate * seconds));
	const buf = c.createBuffer(2, len, c.sampleRate);
	for (let k = 0; k < 2; k++) {
		const d = buf.getChannelData(k);
		for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
	}
	return buf;
};

const noiseSource = (c: AudioContext) => {
	const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
	const d = buf.getChannelData(0);
	for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
	const src = c.createBufferSource();
	src.buffer = buf;
	src.loop = true;
	return src;
};

/** 在 when（音频时钟）开始播放，返回结束时间 */
const schedule = (c: AudioContext, buf: AudioBuffer, profile: VoiceProfile, fx: VoiceFx, when: number) => {
	const rate = paceOf(fx).rate;
	const src = c.createBufferSource();
	src.buffer = buf;
	src.playbackRate.value = rate;
	let node: AudioNode = src;
	const chain = (n: AudioNode) => {
		node.connect(n);
		node = n;
	};
	const air = Math.max(0, Math.min(100, profile.air ?? 0));
	const chest = Math.max(0, Math.min(100, profile.chest ?? 0));
	if (air > 0) {
		const f = c.createBiquadFilter();
		f.type = "highshelf";
		f.frequency.value = 3200;
		f.gain.value = (air / 100) * 3.8;
		chain(f);
	}
	if (chest > 0) {
		const f = c.createBiquadFilter();
		f.type = "lowshelf";
		f.frequency.value = 115;
		f.gain.value = (chest / 100) * 5.0;
		chain(f);
	}
	if (profile.phone) {
		const hp = c.createBiquadFilter();
		hp.type = "highpass";
		hp.frequency.value = 320;
		chain(hp);
		const lp = c.createBiquadFilter();
		lp.type = "lowpass";
		lp.frequency.value = 3600;
		chain(lp);
		const pk = c.createBiquadFilter();
		pk.type = "peaking";
		pk.frequency.value = 1200;
		pk.gain.value = 3;
		chain(pk);
	}
	const comp = c.createDynamicsCompressor();
	comp.threshold.value = -22;
	comp.ratio.value = 3;
	comp.attack.value = 0.005;
	comp.release.value = 0.15;
	chain(comp);
	const dur = buf.duration / rate;
	const out = c.createGain();
	out.gain.value = 1.15;
	node.connect(out);
	out.connect(c.destination);
	const scene = fx.scene ?? "pure";
	const verb = { bed: 0.24, living: 0.48, rain: 0.4, restaurant: 0.3, mall: 0.8, street: 0, pure: 0 }[scene];
	let tail = 0.05;
	if (verb > 0) {
		const conv = c.createConvolver();
		conv.buffer = impulse(c, verb);
		const wet = c.createGain();
		wet.gain.value = scene === "bed" ? 0.22 : 0.3;
		node.connect(conv);
		conv.connect(wet);
		wet.connect(c.destination);
		tail = verb;
	}
	const amb: Record<string, { type: BiquadFilterType; f: number; g: number }> = {
		living: { type: "lowpass", f: 400, g: 0.004 },
		restaurant: { type: "bandpass", f: 900, g: 0.035 },
		rain: { type: "highpass", f: 1500, g: 0.02 },
		mall: { type: "bandpass", f: 700, g: 0.022 },
		street: { type: "lowpass", f: 260, g: 0.05 },
	};
	const a = amb[scene];
	let ns: AudioBufferSourceNode | null = null;
	if (a) {
		ns = noiseSource(c);
		const f = c.createBiquadFilter();
		f.type = a.type;
		f.frequency.value = a.f;
		const g = c.createGain();
		g.gain.value = a.g;
		if (scene === "restaurant" || scene === "mall" || scene === "street") {
			// 人声 / 脚步 / 车流的起伏：用慢速抖动的音量模拟
			const lfo = c.createOscillator();
			lfo.frequency.value = scene === "mall" ? 1.8 : scene === "street" ? 0.25 : 0.7;
			const depth = c.createGain();
			depth.gain.value = a.g * 0.5;
			lfo.connect(depth);
			depth.connect(g.gain);
			lfo.start(when);
			lfo.stop(when + dur + tail + 0.3);
		}
		ns.connect(f);
		f.connect(g);
		g.connect(c.destination);
		ns.start(when);
		ns.stop(when + dur + tail + 0.3);
		active.add(ns);
	}
	src.start(when);
	active.add(src);
	src.onended = () => {
		active.delete(src);
		if (ns) active.delete(ns);
	};
	return when + dur;
};

const clean = (v: string | VoiceProfile): VoiceProfile => (typeof v === "string" ? { voice: v || "Kore" } : { ...v, voice: v.voice || "Kore" });

/** 用 Gemini 的声音朗读一句；失败时退回手机自带的朗读，并返回提示文字 */
export const geminiSpeak = async (rawText: string, voice: string | VoiceProfile, fxOverride?: VoiceFx, tone?: string, cacheKey?: string): Promise<string | null> => {
	const profile = clean(voice);
	const fx = fxOverride ?? getGeminiConfig().fx ?? {};
	const { head, text } = buildPrompt(rawText.slice(0, 900), profile, fx, tone);
	if (!text) return null;
	stopSpeaking();
	const my = gen;
	try {
		const buf = await getBuffer(head, text, profile, tone, cacheKey);
		if (!ctx || my !== gen) return null;
		await ctx.resume();
		schedule(ctx, buf, profile, fx, ctx.currentTime + 0.02);
		return null;
	} catch (e) {
		speakText(text);
		return `Gemini 声音不可用，已改用手机自带声音：${e instanceof Error ? e.message : String(e)}`;
	}
};

/** 连播多句（双人私聊 / 群聊）：句间停顿 0.15~0.20 秒；上一句以「——」结尾或这句标了抢话/打断/爆笑，就提前 0.25 秒叠音 */
export const playSequence = async (lines: { text: string; profile: VoiceProfile; fx?: VoiceFx; tone?: string; cacheKey?: string }[], fxOverride?: VoiceFx): Promise<string | null> => {
	const fx = fxOverride ?? getGeminiConfig().fx ?? {};
	const prepared = lines.map((l) => ({ ...buildPrompt(l.text.slice(0, 900), l.profile, { ...fx, ...l.fx }, l.tone), profile: l.profile, raw: l.text, tone0: l.tone, ck: l.cacheKey, lfx: { ...fx, ...l.fx } })).filter((l) => l.text);
	if (!prepared.length) return null;
	stopSpeaking();
	const my = gen;
	unlockAudio();
	try {
		const bufs = await Promise.all(prepared.map((l) => getBuffer(l.head, l.text, l.profile, l.tone0, l.ck)));
		const c = ctx;
		if (!c || my !== gen) return null;
		await c.resume();
		let t = c.currentTime + 0.05;
		let prevRaw = "";
		prepared.forEach((l, i) => {
			if (i > 0) {
				const overlap = /——\s*$/.test(prevRaw) || /抢话|打断|爆笑/.test(l.tone);
				t += overlap ? -0.28 : 0.18;
			}
			t = schedule(c, bufs[i], l.profile, l.lfx, Math.max(t, c.currentTime + 0.02));
			prevRaw = l.raw;
		});
		return null;
	} catch (e) {
		return `Gemini 声音不可用：${e instanceof Error ? e.message : String(e)}`;
	}
};
