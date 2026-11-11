// 真实语音通话（WebRTC）。信令走 /ws，音频点对点（必要时经服务器 TURN 中转）。
import { nanoid } from "nanoid";
import { useSyncExternalStore } from "react";
import { api } from "./api";
import { sendRealText, setSignalHandler, wsSend } from "./realSync";

export type CallPhase = "idle" | "calling" | "incoming" | "connecting" | "connected";
export type CallState = { phase: CallPhase; peer: number; callId: string; caller: boolean; muted: boolean; speaker: boolean; startedAt: number; note: string };

const IDLE: CallState = { phase: "idle", peer: 0, callId: "", caller: false, muted: false, speaker: false, startedAt: 0, note: "" };
let state: CallState = IDLE;
const subs = new Set<() => void>();
const set = (p: Partial<CallState>) => {
	state = { ...state, ...p };
	for (const f of subs) f();
};
export const useCall = () =>
	useSyncExternalStore(
		(f) => {
			subs.add(f);
			return () => subs.delete(f);
		},
		() => state,
	);

let pc: RTCPeerConnection | null = null;
let local: MediaStream | null = null;
let audio: HTMLAudioElement | null = null;
let pendingIce: RTCIceCandidateInit[] = [];
let ringTimer: ReturnType<typeof setTimeout> | undefined;
let dropTimer: ReturnType<typeof setTimeout> | undefined;
let connectedAt = 0;

const send = (type: string, data?: unknown) => wsSend({ type, to: state.peer, callId: state.callId, data: data ?? null });

function ensureAudio() {
	if (!audio) {
		audio = document.createElement("audio");
		audio.setAttribute("playsinline", "");
		audio.autoplay = true;
		audio.style.display = "none";
		document.body.appendChild(audio);
	}
	return audio;
}

function cleanup() {
	clearTimeout(ringTimer);
	clearTimeout(dropTimer);
	pc?.close();
	pc = null;
	for (const t of local?.getTracks() ?? []) t.stop();
	local = null;
	pendingIce = [];
	if (audio) {
		audio.srcObject = null;
	}
	connectedAt = 0;
}

/** 结束通话。只有主叫方在聊天里留一条记录（服务器上的消息只增不改，双方都能看到）。 */
function finish(status: "accepted" | "rejected" | "cancelled", note = "") {
	const { caller, peer, phase } = state;
	const secs = connectedAt ? Math.max(1, Math.round((Date.now() - connectedAt) / 1000)) : 0;
	cleanup();
	set({ ...IDLE, note });
	if (caller && phase !== "idle") void sendRealText(`real-${peer}`, `[[call:voice:${status}:${status === "accepted" ? secs : 0}]]`).catch(() => {});
	if (note) setTimeout(() => state.phase === "idle" && set({ note: "" }), 2500);
}

async function makePc() {
	const cfg = await api<{ iceServers: RTCIceServer[] }>("/api/real/turn").catch(() => ({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] as RTCIceServer[] }));
	const p = new RTCPeerConnection({ iceServers: cfg.iceServers });
	p.onicecandidate = (e) => e.candidate && send("call-ice", e.candidate.toJSON());
	p.ontrack = (e) => {
		const a = ensureAudio();
		a.srcObject = e.streams[0] ?? new MediaStream([e.track]);
		void a.play().catch(() => {});
	};
	p.onconnectionstatechange = () => {
		if (p !== pc) return;
		if (p.connectionState === "connected") {
			clearTimeout(dropTimer);
			if (!connectedAt) {
				connectedAt = Date.now();
				set({ phase: "connected", startedAt: connectedAt });
			}
		} else if (p.connectionState === "disconnected") {
			dropTimer = setTimeout(() => hangup("通话中断"), 8000);
		} else if (p.connectionState === "failed") {
			hangup("连接失败，请换个网络再试");
		}
	};
	for (const t of local?.getAudioTracks() ?? []) p.addTrack(t, local as MediaStream);
	pc = p;
	return p;
}

async function getMic() {
	local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
}

/** 点「语音通话」时调用（要在用户点按的当下，iOS 才允许开麦克风和播放） */
export async function startCall(peer: number) {
	if (state.phase !== "idle") return;
	const a = ensureAudio();
	void a.play().catch(() => {});
	try {
		await getMic();
	} catch {
		set({ note: "无法使用麦克风，请在浏览器里允许" });
		setTimeout(() => state.phase === "idle" && set({ note: "" }), 2500);
		return;
	}
	state = { ...IDLE, phase: "calling", peer, callId: nanoid(10), caller: true };
	set({});
	await makePc();
	if (!send("call-invite")) return finish("cancelled", "网络未连接，请稍后再试");
	ringTimer = setTimeout(() => hangup("对方无应答"), 45000);
}

/** 接听：必须由用户点按触发 */
export async function acceptCall() {
	if (state.phase !== "incoming") return;
	const a = ensureAudio();
	void a.play().catch(() => {});
	try {
		await getMic();
	} catch {
		send("call-reject");
		cleanup();
		set({ ...IDLE, note: "无法使用麦克风，请在浏览器里允许" });
		return;
	}
	clearTimeout(ringTimer);
	set({ phase: "connecting" });
	await makePc();
	send("call-accept");
}

export function rejectCall() {
	if (state.phase !== "incoming") return;
	send("call-reject");
	cleanup();
	set({ ...IDLE });
}

export function hangup(note = "") {
	if (state.phase === "idle") return;
	if (state.phase === "incoming") return rejectCall();
	send("call-hangup");
	finish(connectedAt ? "accepted" : "cancelled", note);
}

export function toggleMute() {
	const muted = !state.muted;
	for (const t of local?.getAudioTracks() ?? []) t.enabled = !muted;
	set({ muted });
}

export function toggleSpeaker() {
	const speaker = !state.speaker;
	const a = ensureAudio() as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
	void a.setSinkId?.(speaker ? "default" : "").catch(() => {});
	set({ speaker });
}

setSignalHandler(async (m) => {
	const from = m.from;
	if (m.type === "call-invite") {
		if (state.phase !== "idle") {
			wsSend({ type: "call-reject", to: from, callId: m.callId, data: { busy: true } });
			return;
		}
		state = { ...IDLE, phase: "incoming", peer: from, callId: m.callId, caller: false };
		set({});
		ringTimer = setTimeout(() => state.phase === "incoming" && (cleanup(), set({ ...IDLE })), 45000);
		navigator.vibrate?.([300, 200, 300]);
		return;
	}
	if (from !== state.peer || m.callId !== state.callId) return;
	switch (m.type) {
		case "call-accept": {
			if (!pc) return;
			clearTimeout(ringTimer);
			set({ phase: "connecting" });
			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);
			send("call-offer", offer);
			break;
		}
		case "call-offer": {
			if (!pc) return;
			await pc.setRemoteDescription(m.data as RTCSessionDescriptionInit);
			for (const c of pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => {});
			const ans = await pc.createAnswer();
			await pc.setLocalDescription(ans);
			send("call-answer", ans);
			break;
		}
		case "call-answer": {
			if (!pc) return;
			await pc.setRemoteDescription(m.data as RTCSessionDescriptionInit);
			for (const c of pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => {});
			break;
		}
		case "call-ice": {
			if (pc?.remoteDescription) await pc.addIceCandidate(m.data as RTCIceCandidateInit).catch(() => {});
			else pendingIce.push(m.data as RTCIceCandidateInit);
			break;
		}
		case "call-reject":
			if (state.phase === "incoming") return;
			finish("rejected", (m.data as { busy?: boolean } | null)?.busy ? "对方正在通话中" : "对方已拒绝");
			break;
		case "call-hangup":
			if (state.phase === "incoming") {
				cleanup();
				set({ ...IDLE, note: "对方已取消" });
				setTimeout(() => state.phase === "idle" && set({ note: "" }), 2500);
			} else finish(connectedAt ? "accepted" : "cancelled", connectedAt ? "通话已结束" : "对方已取消");
			break;
	}
});
