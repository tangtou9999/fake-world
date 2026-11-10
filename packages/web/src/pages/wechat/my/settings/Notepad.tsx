import { atomWithStorage } from "jotai/utils";
import { useAtom } from "jotai";
import { nanoid } from "nanoid";
import { useState } from "react";
import { copyText } from "./CopyBlock";

type Note = { id: string; title: string; content: string; at: number };
export const notepadAtom = atomWithStorage<Note[]>("ai-notepad", []);

/** 私人 AI 的记事本：存常用指令，随时一键复制 */
const Notepad = ({ onClose, onSend }: { onClose: () => void; onSend?: (text: string) => void }) => {
	const [notes, setNotes] = useAtom(notepadAtom);
	const [editing, setEditing] = useState<Note | null>(null);
	const [toast, setToast] = useState("");
	const say = (t: string) => {
		setToast(t);
		window.setTimeout(() => setToast(""), 1600);
	};

	const save = () => {
		if (!editing) return;
		if (!editing.content.trim() && !editing.title.trim()) {
			setEditing(null);
			return;
		}
		const next = { ...editing, at: Date.now() };
		setNotes((v) => (v.some((n) => n.id === next.id) ? v.map((n) => (n.id === next.id ? next : n)) : [next, ...v]));
		setEditing(null);
		say("已保存");
	};

	return (
		<div className="fixed inset-0 z-50 flex flex-col bg-[#EDEDED]">
			<div className="shrink-0 bg-[#EDEDED] pt-[max(env(safe-area-inset-top),44px)]">
				<div className="flex h-11 items-center justify-between px-4">
					{editing ? (
						<button type="button" className="text-[16px] text-[#576B95]" onClick={() => setEditing(null)}>
							取消
						</button>
					) : (
						<button type="button" className="text-[16px] text-[#576B95]" onClick={onClose}>
							返回
						</button>
					)}
					<div className="font-medium text-[17px]">{editing ? "编辑记事" : "记事本"}</div>
					{editing ? (
						<button type="button" className="text-[16px] text-[#07C160]" onClick={save}>
							保存
						</button>
					) : (
						<button type="button" className="text-[16px] text-[#07C160]" onClick={() => setEditing({ id: nanoid(8), title: "", content: "", at: Date.now() })}>
							新建
						</button>
					)}
				</div>
			</div>
			{editing ? (
				<div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
					<input
						aria-label="标题"
						value={editing.title}
						onChange={(e) => setEditing({ ...editing, title: e.target.value })}
						placeholder="标题（可不填）"
						className="h-11 rounded-[8px] bg-white px-3 text-[16px] outline-none"
					/>
					<textarea
						aria-label="内容"
						autoFocus
						value={editing.content}
						onChange={(e) => setEditing({ ...editing, content: e.target.value })}
						placeholder="把要保存的指令粘贴到这里"
						className="min-h-0 flex-1 resize-none rounded-[8px] bg-white p-3 text-[16px] leading-6 outline-none"
					/>
					{notes.some((n) => n.id === editing.id) && (
						<button
							type="button"
							className="h-11 rounded-[8px] bg-white text-[16px] text-[#FA5151]"
							onClick={() => {
								if (!window.confirm("删除这条记事？")) return;
								setNotes((v) => v.filter((n) => n.id !== editing.id));
								setEditing(null);
							}}
						>
							删除
						</button>
					)}
				</div>
			) : (
				<div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
					{notes.length === 0 && <div className="pt-16 text-center text-[15px] text-black/40">还没有记事，点右上角「新建」，粘贴要保存的指令</div>}
					{notes.map((n) => (
						<div key={n.id} className="rounded-[8px] bg-white p-3">
							<div className="flex items-center justify-between gap-2">
								<div className="truncate font-medium text-[15px]">{n.title || n.content.split("\n")[0].slice(0, 20) || "（空）"}</div>
								<div className="flex shrink-0 gap-2">
									{onSend && (
										<button type="button" aria-label="发送到当前窗口" className="rounded-[4px] border border-[#07C160] px-3 py-[3px] text-[13px] text-[#07C160]" onClick={() => onSend(n.content)}>
											发送
										</button>
									)}
									<button type="button" className="rounded-[4px] border border-black/15 px-3 py-[3px] text-[13px]" onClick={() => setEditing(n)}>
										编辑
									</button>
									<button
										type="button"
										aria-label="复制记事"
										className="rounded-[4px] bg-[#07C160] px-3 py-[3px] text-[13px] text-white"
										onClick={async () => say((await copyText(n.content)) === "copied" ? "已复制" : "复制失败，请点「编辑」长按复制")}
									>
										复制
									</button>
								</div>
							</div>
							<div className="mt-2 line-clamp-3 whitespace-pre-wrap break-all text-[14px] text-black/60">{n.content}</div>
						</div>
					))}
				</div>
			)}
			{toast && <div className="pointer-events-none fixed bottom-[120px] left-1/2 z-[60] -translate-x-1/2 rounded-[6px] bg-black/75 px-4 py-2 text-[14px] text-white">{toast}</div>}
		</div>
	);
};

export default Notepad;
