import { geminiConfigAtom, getKeys } from "@/stateV2/gemini";
import { keyStatusAtom, type KeyUse } from "@/stateV2/keyStatus";
import { probeKey } from "@/utils/keyProbe";
import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";

const MODES = [
	{ id: "auto", title: "自动（推荐）", desc: "先用主密钥，出错或额度用完就自动换备用" },
	{ id: "backupFirst", title: "备用优先", desc: "先用备用密钥，出错再换主密钥" },
	{ id: "main", title: "只用主密钥", desc: "不会碰备用密钥" },
	{ id: "backup", title: "只用备用密钥", desc: "不会碰主密钥" },
] as const;

const name = (w: "main" | "backup" | "deepseek") => (w === "main" ? "主密钥" : w === "backup" ? "备用密钥" : "DeepSeek");
const ago = (t: number) => {
	const s = Math.max(0, Math.round((Date.now() - t) / 1000));
	return s < 60 ? `${s} 秒前` : `${Math.round(s / 60)} 分钟前`;
};
const Line = ({ label, u }: { label: string; u?: KeyUse }) => (
	<div className="py-0.5">
		{label}：{u ? <span className={u.ok ? "text-[#07C160]" : "text-[#FA5151]"}>{ago(u.at)} 用的是{name(u.which)}{u.ok ? "，成功" : "，失败"}</span> : <span>还没用过</span>}
		{u?.msg && <div className="text-black/40">{u.msg}</div>}
	</div>
);

const KeyPanel = () => {
	const [config, setConfig] = useAtom(geminiConfigAtom);
	const status = useAtomValue(keyStatusAtom);
	const [probe, setProbe] = useState<Record<string, string>>({});
	const [busy, setBusy] = useState("");
	const mode = config.keyMode ?? "auto";
	const orderKeys = getKeys(config).map((k) => name(k.id));
	if ((config.keyMode ?? "auto") === "auto" && config.deepseekApiKey) orderKeys.push("DeepSeek");
	const order = orderKeys.join(" → ") || "（没有可用密钥）";
	const same = !!config.apiKey && config.apiKey === config.apiKey2;

	const run = async (which: "main" | "backup") => {
		const key = which === "main" ? config.apiKey : config.apiKey2;
		if (!key) return setProbe((v) => ({ ...v, [which]: "还没填" }));
		setBusy(which);
		setProbe((v) => ({ ...v, [which]: "检测中…" }));
		const t = await probeKey(key, false);
		const v = await probeKey(key, true);
		setProbe((x) => ({ ...x, [which]: `文字 ${t.ok ? "✓" : "✗"} ${t.text}\n声音 ${v.ok ? "✓" : "✗"} ${v.text}` }));
		setBusy("");
	};

	return (
		<div className="px-4 pt-2 text-[12px] text-black/50 leading-5">
			<div className="mb-1 text-[13px] text-black/70">使用方式（你自己选）</div>
			<div className="overflow-hidden rounded-[6px] bg-white">
				{MODES.map((m) => (
					<button key={m.id} type="button" onClick={() => setConfig((v) => ({ ...v, keyMode: m.id }))} className="flex w-full items-center border-black/5 border-b px-3 py-2 text-left last:border-b-0">
						<span className={`mr-2 h-4 w-4 shrink-0 rounded-full border ${mode === m.id ? "border-[#07C160] bg-[#07C160]" : "border-black/30"}`} />
						<span className="flex-1">
							<span className="text-[14px] text-black">{m.title}</span>
							<span className="block">{m.desc}</span>
						</span>
					</button>
				))}
			</div>
			<div className="mt-2">现在的顺序：{order}</div>
			<div className="mt-1 rounded-[6px] bg-white px-3 py-2">
				<div className="text-[13px] text-black/70">最近一次实际连的是哪个</div>
				<Line label="文字 AI" u={status.text} />
				<Line label="声音" u={status.tts} />
			</div>
			{same && <div className="mt-2 text-[#FA5151]">两栏填的是同一个密钥，备用没有意义。</div>}
			<div className="mt-2">注意：同一个 Google 账号/同一个项目下建的多个密钥共用同一份额度，备用密钥要用「另一个 Google 账号」的才真正多一份额度。声音（TTS）免费额度比文字小得多，很容易先用完，约越南时间下午 3 点刷新。</div>
			<div className="mt-2 flex gap-2">
				{(["main", "backup"] as const).map((w) => (
					<button key={w} type="button" disabled={!!busy} onClick={() => run(w)} className="h-[34px] flex-1 rounded-[6px] bg-white text-[14px] text-black disabled:opacity-40">
						单独检测{name(w)}
					</button>
				))}
			</div>
			{(["main", "backup"] as const).map((w) => probe[w] && (
				<div key={w} className="mt-1 whitespace-pre-line rounded-[6px] bg-white px-3 py-2">
					<span className="text-black/70">{name(w)}</span>
					{"\n"}
					{probe[w]}
				</div>
			))}
		</div>
	);
};
export default KeyPanel;
