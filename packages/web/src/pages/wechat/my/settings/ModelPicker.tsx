import { QUICK_MODELS, geminiConfigAtom } from "@/stateV2/gemini";
import { listGeminiModels } from "@/utils/gemini";
import { useAtom } from "jotai";
import { useState } from "react";

/** 模型选择：常用模型一点即选 + 手动输入 + 拉取这个密钥可用的全部模型 */
const ModelPicker = ({ compact = false }: { compact?: boolean }) => {
	const [config, setConfig] = useAtom(geminiConfigAtom);
	const [all, setAll] = useState<string[]>([]);
	const [loading, setLoading] = useState(false);
	const [err, setErr] = useState("");
	const pick = (model: string) => setConfig((v) => ({ ...v, model }));

	const chip = (m: string) => (
		<button
			key={m}
			type="button"
			onClick={() => pick(m)}
			className={`rounded-full px-3 py-[5px] text-[13px] ${config.model === m ? "bg-[#07C160] text-white" : "bg-black/5 text-black/70"}`}
		>
			{m}
		</button>
	);

	const load = async () => {
		setLoading(true);
		setErr("");
		try {
			setAll(await listGeminiModels());
		} catch (e) {
			setErr(e instanceof Error ? e.message : String(e));
		} finally {
			setLoading(false);
		}
	};

	return (
		<div>
			<div className="mb-1 text-[13px] text-black/50">
				模型：<span className="text-black/90">{config.model}</span>
			</div>
			<div className="flex flex-wrap gap-2">{QUICK_MODELS.map(chip)}</div>
			{!compact && (
				<input
					className="mt-3 w-full rounded-[6px] bg-[#F5F5F5] px-3 py-3 text-[15px] outline-none placeholder:text-black/30"
					placeholder="或手动输入模型名"
					value={config.model}
					onChange={(e) => pick(e.target.value.trim())}
				/>
			)}
			<button type="button" onClick={load} disabled={loading || !config.apiKey} className="mt-3 text-[13px] text-[#576B95] disabled:opacity-40">
				{loading ? "查询中…" : "查看我的密钥可用的全部模型"}
			</button>
			{err && <div className="mt-2 text-[12px] text-[#C62828]">{err}</div>}
			{all.length > 0 && <div className="mt-2 flex max-h-[140px] flex-wrap gap-2 overflow-auto">{all.map(chip)}</div>}
		</div>
	);
};

export default ModelPicker;
