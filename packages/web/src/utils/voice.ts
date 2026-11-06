import type { GeminiImage } from "./gemini";

const encodeWav = (chunks: Float32Array[], rate: number): GeminiImage | null => {
	const total = chunks.reduce((n, c) => n + c.length, 0);
	if (total < rate * 0.4) return null; // 太短
	const merged = new Float32Array(total);
	let o = 0;
	for (const c of chunks) {
		merged.set(c, o);
		o += c.length;
	}
	const target = 16000;
	const ratio = rate / target;
	const outLen = Math.floor(total / ratio);
	const pcm = new Int16Array(outLen);
	for (let i = 0; i < outLen; i++) {
		const start = Math.floor(i * ratio);
		const end = Math.min(total, Math.floor((i + 1) * ratio));
		let sum = 0;
		for (let j = start; j < end; j++) sum += merged[j];
		const v = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
		pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
	}
	const buf = new ArrayBuffer(44 + pcm.length * 2);
	const dv = new DataView(buf);
	const str = (off: number, s: string) => {
		for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
	};
	str(0, "RIFF");
	dv.setUint32(4, 36 + pcm.length * 2, true);
	str(8, "WAVE");
	str(12, "fmt ");
	dv.setUint32(16, 16, true);
	dv.setUint16(20, 1, true);
	dv.setUint16(22, 1, true);
	dv.setUint32(24, target, true);
	dv.setUint32(28, target * 2, true);
	dv.setUint16(32, 2, true);
	dv.setUint16(34, 16, true);
	str(36, "data");
	dv.setUint32(40, pcm.length * 2, true);
	new Int16Array(buf, 44).set(pcm);
	const bytes = new Uint8Array(buf);
	let bin = "";
	for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return { mime: "audio/wav", data: btoa(bin) };
};

/** 开始录音，stop() 返回 16k 单声道 WAV（Gemini 支持的格式）；太短返回 null */
export async function startRecording() {
	const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
	const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
	const ctx = new AC();
	const src = ctx.createMediaStreamSource(stream);
	const proc = ctx.createScriptProcessor(4096, 1, 1);
	const chunks: Float32Array[] = [];
	proc.onaudioprocess = (e) => {
		chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
	};
	src.connect(proc);
	proc.connect(ctx.destination);
	const rate = ctx.sampleRate;
	let done = false;
	const cleanup = () => {
		if (done) return;
		done = true;
		proc.disconnect();
		src.disconnect();
		for (const t of stream.getTracks()) t.stop();
		void ctx.close();
	};
	return {
		cancel: cleanup,
		stop: () => {
			cleanup();
			return encodeWav(chunks, rate);
		},
	};
}

export const speakText = (text: string) => {
	if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
	const clean = text.replace(/```[\s\S]*?```/g, "").replace(/[*#>`_~]/g, "").trim().slice(0, 1500);
	if (!clean) return;
	window.speechSynthesis.cancel();
	const u = new SpeechSynthesisUtterance(clean);
	u.lang = "zh-CN";
	window.speechSynthesis.speak(u);
};
