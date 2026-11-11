import { sendRealVoice } from "@/auth/realSync";
import { showToast } from "@/wechatComponents/Toast";
import { useRef, useState } from "react";

const pickMime = () => ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";

/** 真实聊天里的「按住 说话」：按住录音，松开发送，往上滑取消。 */
const HoldToTalk = ({ conversationId }: { conversationId: string }) => {
	const [state, setState] = useState<"idle" | "rec" | "cancel">("idle");
	const rec = useRef<{ mr: MediaRecorder; chunks: Blob[]; start: number; y: number; stream: MediaStream; cancel: boolean; timer: number } | null>(null);
	const pending = useRef(false);

	const begin = async (e: React.PointerEvent) => {
		if (rec.current || pending.current) return;
		const y = e.clientY;
		pending.current = true;
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mime = pickMime();
			const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
			const r = { mr, chunks: [] as Blob[], start: Date.now(), y, stream, cancel: false, timer: 0 };
			mr.ondataavailable = (ev) => ev.data.size && r.chunks.push(ev.data);
			mr.onstop = () => {
				clearTimeout(r.timer);
				for (const t of stream.getTracks()) t.stop();
				rec.current = null;
				setState("idle");
				const secs = Math.round((Date.now() - r.start) / 1000);
				if (r.cancel) return;
				if (secs < 1) return showToast({ content: "说话时间太短" });
				const blob = new Blob(r.chunks, { type: mr.mimeType || mime || "audio/webm" });
				sendRealVoice(conversationId, blob, Math.min(secs, 60)).catch((err) => showToast({ content: err instanceof Error ? err.message : "语音发送失败" }));
			};
			rec.current = r;
			mr.start();
			r.timer = window.setTimeout(() => mr.state === "recording" && mr.stop(), 60000);
			setState("rec");
		} catch {
			showToast({ content: "无法使用麦克风，请在浏览器里允许" });
		} finally {
			pending.current = false;
		}
	};
	const move = (e: React.PointerEvent) => {
		const r = rec.current;
		if (!r) return;
		r.cancel = r.y - e.clientY > 80;
		setState(r.cancel ? "cancel" : "rec");
	};
	const end = () => {
		const r = rec.current;
		if (r && r.mr.state === "recording") r.mr.stop();
	};

	return (
		<>
			<button
				type="button"
				onPointerDown={(e) => void begin(e)}
				onPointerMove={move}
				onPointerUp={end}
				onPointerCancel={() => {
					if (rec.current) rec.current.cancel = true;
					end();
				}}
				onContextMenu={(e) => e.preventDefault()}
				style={{ touchAction: "none", WebkitUserSelect: "none", userSelect: "none" }}
				className={`h-10 min-w-0 flex-1 rounded-[6px] text-[16px] ${state === "idle" ? "bg-white" : "bg-[#C6C6C6]"}`}
			>
				{state === "idle" ? "按住 说话" : state === "cancel" ? "松开 取消" : "松开 发送"}
			</button>
			{state !== "idle" && (
				<div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
					<div className={`rounded-[10px] px-6 py-5 text-center text-[15px] text-white ${state === "cancel" ? "bg-[#FA5151]" : "bg-black/70"}`}>{state === "cancel" ? "松开手指，取消发送" : "手指上滑，取消发送"}</div>
				</div>
			)}
		</>
	);
};

export default HoldToTalk;
