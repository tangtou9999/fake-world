import { parseJsonLoose } from "@/utils/gemini";
import { useState } from "react";

export type FormField = { key: string; label: string; type: "number" | "choice" | "text"; options?: string[]; multi?: boolean; default?: string | number };
export type AiForm = { title: string; fields: FormField[]; answers?: Record<string, string> };

/** 解析 AI 回复里的 ```wxform 资料卡：AI 缺信息时发一张表单，让用户点选，不用来回打字。 */
export const parseForm = (raw: string): { text: string; form?: AiForm } => {
	const m = raw.match(/```wxform\s*([\s\S]*?)```/);
	const text = raw.replace(/```wxform[\s\S]*?(```|$)/g, "").trim();
	if (!m) return { text };
	try {
		const j = parseJsonLoose<{ title?: string; fields?: Record<string, unknown>[] }>(m[1]);
		const fields: FormField[] = [];
		for (const f of Array.isArray(j.fields) ? j.fields : []) {
			if (!f.key || !f.label) continue;
			const type = f.type === "number" || f.type === "choice" ? f.type : "text";
			const options = Array.isArray(f.options) ? f.options.map(String).filter(Boolean).slice(0, 12) : undefined;
			if (type === "choice" && !options?.length) continue;
			fields.push({ key: String(f.key), label: String(f.label), type, options, multi: !!f.multi, default: f.default as never });
		}
		return fields.length ? { text, form: { title: String(j.title ?? "请补充资料"), fields: fields.slice(0, 8) } } : { text };
	} catch {
		return { text };
	}
};

export const formToText = (form: AiForm, answers: Record<string, string>) =>
	`【资料卡：${form.title}】\n${form.fields.map((f) => `${f.label}：${answers[f.key]?.trim() || "随意"}`).join("\n")}`;

export const FormCard = ({ form, onSubmit }: { form: AiForm; onSubmit: (answers: Record<string, string>) => void }) => {
	const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(form.fields.map((f) => [f.key, f.default === undefined ? "" : String(f.default)])));
	const done = form.answers;
	const val = done ?? v;
	const toggle = (f: FormField, o: string) => {
		const cur = (v[f.key] ?? "").split("、").filter(Boolean);
		const next = f.multi ? (cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]) : cur[0] === o ? [] : [o];
		setV({ ...v, [f.key]: next.join("、") });
	};
	return (
		<div className="mt-2 w-[92%] rounded-[8px] bg-white p-3">
			<div className="font-medium text-[15px]">{form.title}</div>
			{form.fields.map((f) => (
				<div key={f.key} className="mt-3">
					<div className="mb-1 text-[13px] text-black/50">{f.label}{f.multi ? "（可多选）" : ""}</div>
					{f.type === "choice" ? (
						<div className="flex flex-wrap gap-2">
							{f.options?.map((o) => {
								const on = (val[f.key] ?? "").split("、").includes(o);
								return (
									<button key={o} type="button" disabled={!!done} onClick={() => toggle(f, o)} className={`rounded-full border px-3 py-[5px] text-[14px] ${on ? "border-[#07C160] bg-[#07C160] text-white" : "border-black/15"}`}>
										{o}
									</button>
								);
							})}
						</div>
					) : (
						<input
							disabled={!!done}
							inputMode={f.type === "number" ? "numeric" : undefined}
							className="w-full rounded-[6px] bg-[#F5F5F5] px-3 py-[7px] text-[16px] outline-none"
							value={val[f.key] ?? ""}
							onChange={(e) => setV({ ...v, [f.key]: e.target.value })}
							placeholder={f.type === "number" ? "数字" : "可留空"}
						/>
					)}
				</div>
			))}
			{done ? (
				<div className="mt-3 text-[13px] text-[#07C160]">✓ 已提交</div>
			) : (
				<button type="button" className="mt-3 h-10 w-full rounded-[6px] bg-[#07C160] text-[15px] text-white" onClick={() => onSubmit(v)}>
					提交
				</button>
			)}
		</div>
	);
};
