import { callScheduleAtom } from "@/stateV2/videoCall";
import { callKey, delCallVideo, getCallVideo, putCallVideo } from "@/utils/videoStore";
import { useAtom } from "jotai";
import { type ChangeEvent, useEffect, useRef, useState } from "react";

type Slot = "me" | "friend";
const LABEL: Record<Slot, string> = { me: "我这边的视频", friend: "对方那边的视频" };

/** 编辑模式 → 视频：提前上传两段视频（我 / 对方），并设置「多久后对方打视频过来」 */
const VideoSheet = ({ conversationId, onClose }: { conversationId: string; onClose: () => void }) => {
	const [has, setHas] = useState<Record<Slot, boolean>>({ me: false, friend: false });
	const [msg, setMsg] = useState("");
	const [mins, setMins] = useState("1");
	const [sched, setSched] = useAtom(callScheduleAtom);
	const [now, setNow] = useState(Date.now());
	const refs = { me: useRef<HTMLInputElement>(null), friend: useRef<HTMLInputElement>(null) };
	const at = sched[conversationId];

	useEffect(() => {
		for (const s of ["me", "friend"] as Slot[]) void getCallVideo(callKey(s, conversationId)).then((b) => setHas((v) => ({ ...v, [s]: !!b })));
	}, [conversationId]);
	useEffect(() => {
		const t = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(t);
	}, []);

	const pick = async (slot: Slot, e: ChangeEvent<HTMLInputElement>) => {
		const f = e.target.files?.item(0);
		e.target.value = "";
		if (!f) return;
		if (!f.type.startsWith("video/")) return setMsg("请选择视频文件");
		const ok = await putCallVideo(callKey(slot, conversationId), f);
		setHas((v) => ({ ...v, [slot]: ok }));
		setMsg(ok ? `${LABEL[slot]}已保存` : "视频太大，没能保存，请选短一点的（建议 1 分钟内）");
	};
	const remove = async (slot: Slot) => {
		await delCallVideo(callKey(slot, conversationId));
		setHas((v) => ({ ...v, [slot]: false }));
	};
	const start = (minutes: number) => {
		setSched((v) => ({ ...v, [conversationId]: Date.now() + Math.max(0, minutes) * 60000 }));
		setMsg(minutes <= 0 ? "马上来电" : `已设置：${minutes} 分钟后对方打视频过来（需要停留在这个聊天页面里）`);
		if (minutes <= 0) onClose();
	};
	const cancel = () => setSched((v) => Object.fromEntries(Object.entries(v).filter(([k]) => k !== conversationId)));
	const left = at ? Math.max(0, Math.ceil((at - now) / 1000)) : 0;

	return (
		<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
			<div className="max-h-[85%] overflow-auto rounded-t-[12px] bg-[#F7F7F7] pb-[env(safe-area-inset-bottom)]" onClick={(e) => e.stopPropagation()}>
				<div className="border-black/5 border-b bg-white px-4 py-3 text-center font-medium text-[16px]">视频通话设置</div>
				<div className="px-4 pt-3 text-[12px] text-black/50 leading-5">先上传两段视频：「我这边」是我发起视频时我的画面；「对方那边」是接通后对方的画面。视频存在这台手机上，不上传。</div>
				{(["me", "friend"] as Slot[]).map((s) => (
					<div key={s} className="mt-2 flex items-center gap-3 bg-white px-4 py-3">
						<input ref={refs[s]} type="file" accept="video/*" className="hidden" onChange={(e) => void pick(s, e)} />
						<div className="min-w-0 flex-1">
							<div className="text-[16px]">{LABEL[s]}</div>
							<div className={`text-[12px] ${has[s] ? "text-[#07C160]" : "text-black/40"}`}>{has[s] ? "已上传" : "还没上传"}</div>
						</div>
						{has[s] && (
							<button type="button" onClick={() => void remove(s)} className="h-8 rounded-[6px] border border-[#FA5151] px-3 text-[14px] text-[#FA5151]">
								删除
							</button>
						)}
						<button type="button" onClick={() => refs[s].current?.click()} className="h-8 rounded-[6px] bg-[#07C160] px-3 text-[14px] text-white">
							{has[s] ? "更换" : "选择视频"}
						</button>
					</div>
				))}
				<div className="mt-3 bg-white px-4 py-3">
					<div className="text-[16px]">让对方打视频过来</div>
					<div className="mt-2 flex items-center gap-2 text-[15px]">
						<input type="number" min={0} inputMode="decimal" value={mins} onChange={(e) => setMins(e.target.value)} className="h-9 w-16 rounded-[6px] bg-[#F5F5F5] px-2 text-center outline-none" />
						分钟后
						<button type="button" onClick={() => start(Number(mins) || 0)} className="ml-auto h-9 rounded-[6px] bg-[#07C160] px-4 text-[15px] text-white">
							开始计时
						</button>
						<button type="button" onClick={() => start(0)} className="h-9 rounded-[6px] bg-black/5 px-3 text-[15px]">
							马上来电
						</button>
					</div>
					{!!at && (
						<div className="mt-2 flex items-center text-[13px] text-black/60">
							对方将在 {Math.floor(left / 60)} 分 {left % 60} 秒后打来
							<button type="button" onClick={cancel} className="ml-auto text-[#576B95]">
								取消
							</button>
						</div>
					)}
				</div>
				{msg && <div className="px-4 pt-2 text-[12px] text-black/50 leading-5">{msg}</div>}
				<button type="button" onClick={onClose} className="mt-2 h-[52px] w-full bg-white text-[16px] text-[#07C160]">
					完成
				</button>
			</div>
		</div>
	);
};
export default VideoSheet;
