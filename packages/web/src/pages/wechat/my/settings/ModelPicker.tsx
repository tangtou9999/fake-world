import { GEMINI_MODEL_PRESETS, geminiConfigAtom } from "@/stateV2/gemini";
import { useAtom } from "jotai";

/** 点一下就切换模型；extra 可以放「获取可用模型」得到的列表 */
const ModelPicker = ({ extra = [] }: { extra?: string[] }) => {
	const [config, setConfig] = useAtom(geminiConfigAtom);
	const all = Array.from(new Set([...GEMINI_MODEL_PRESETS, ...extra, config.model].filter(Boolean)));
	return (
		<div className="flex flex-wrap gap-2">
			{all.map((m) => (
				<button
					key={m}
					type="button"
					onClick={() => setConfig((v) => ({ ...v, model: m }))}
					className={`rounded-full px-3 py-[6px] text-[13px] ${config.model === m ? "bg-[#07C160] text-white" : "bg-black/5 text-black/70"}`}
				>
					{m}
				</button>
			))}
		</div>
	);
};

export default ModelPicker;
