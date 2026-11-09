import { useRef } from "react";

export type Segment = { type: "text" | "copy"; content: string };

/** 把 AI 回复拆成正文 + 可复制块：```copy ... ```（其他普通代码块也当作可复制块） */
export const parseSegments = (raw: string): Segment[] => {
	const out: Segment[] = [];
	let last = 0;
	for (const m of raw.matchAll(/```[\w-]*[ \t]*\n?([\s\S]*?)```/g)) {
		const before = raw.slice(last, m.index).trim();
		if (before) out.push({ type: "text", content: before });
		const body = m[1].replace(/\s+$/, "").replace(/^\n+/, "");
		if (body) out.push({ type: "copy", content: body });
		last = (m.index ?? 0) + m[0].length;
	}
	const rest = raw.slice(last).trim();
	if (rest) out.push({ type: "text", content: rest });
	return out.length ? out : [{ type: "text", content: raw }];
};

/** 复制：剪贴板 API → execCommand → 选中文字（最后一步需要用户手动长按复制） */
export const copyText = async (text: string, fallbackEl?: HTMLElement | null): Promise<"copied" | "selected"> => {
	try {
		if (navigator.clipboard?.writeText && window.isSecureContext) {
			await navigator.clipboard.writeText(text);
			return "copied";
		}
	} catch {
		// 往下降级
	}
	try {
		const ta = document.createElement("textarea");
		ta.value = text;
		ta.setAttribute("readonly", "");
		ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px";
		document.body.appendChild(ta);
		ta.select();
		ta.setSelectionRange(0, text.length);
		const ok = document.execCommand("copy");
		document.body.removeChild(ta);
		if (ok) return "copied";
	} catch {
		// 往下降级
	}
	if (fallbackEl) {
		const range = document.createRange();
		range.selectNodeContents(fallbackEl);
		const sel = window.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(range);
	}
	return "selected";
};

const CopyBlock = ({ content, onResult }: { content: string; onResult: (r: "copied" | "selected") => void }) => {
	const ref = useRef<HTMLPreElement>(null);
	return (
		<div className="mt-2 w-full overflow-hidden rounded-[8px] border border-black/10 bg-[#F6F8FA]">
			<div className="flex items-center justify-between border-black/10 border-b bg-black/[0.03] px-3 py-1">
				<span className="text-[12px] text-black/40">可复制内容</span>
				<button
					type="button"
					aria-label="复制这一块"
					className="rounded-[4px] bg-[#07C160] px-3 py-[3px] text-[13px] text-white active:opacity-70"
					onClick={async () => onResult(await copyText(content, ref.current))}
				>
					复制
				</button>
			</div>
			<pre ref={ref} className="whitespace-pre-wrap break-words px-3 py-2 font-mono text-[14px] leading-[21px] select-text">
				{content}
			</pre>
		</div>
	);
};

export default CopyBlock;
