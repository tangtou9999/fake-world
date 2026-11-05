import useScreenTopBg from "@/components/useScreenTopBg";
import { DEFAULT_GEMINI_MODEL, geminiConfigAtom } from "@/stateV2/gemini";
import { callGemini } from "@/utils/gemini";
import { useAtom } from "jotai";
import { useState } from "react";
import { NavBar } from "../../addFriend/Shared";
import ModelPicker from "./ModelPicker";

const AiSettings = () => {
	const [config, setConfig] = useAtom(geminiConfigAtom);
	const [show, setShow] = useState(false);
	const [busy, setBusy] = useState(false);
	const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
	useScreenTopBg("#EDEDED");

	const test = async () => {
		setBusy(true);
		setResult(null);
		try {
			const reply = await callGemini("只回复两个字：成功");
			setResult({ ok: true, text: `连接成功：${reply.trim().slice(0, 30)}` });
		} catch (e) {
			setResult({ ok: false, text: e instanceof Error ? e.message : String(e) });
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-[#EDEDED]">
			<NavBar title="Gemini 密钥" />
			<div className="min-h-0 flex-1 overflow-auto pb-10">
				<div className="px-4 pt-3 pb-1 text-[13px] text-black/40">API 密钥</div>
				<div className="flex items-center bg-white px-4">
					<input
						type={show ? "text" : "password"}
						className="min-w-0 flex-1 bg-transparent py-4 text-[16px] outline-none placeholder:text-black/30"
						placeholder="粘贴你的 Gemini API Key"
						value={config.apiKey}
						autoComplete="off"
						onChange={(e) => setConfig((v) => ({ ...v, apiKey: e.target.value.trim() }))}
					/>
					<button type="button" className="ml-3 text-[14px] text-[#576B95]" onClick={() => setShow((v) => !v)}>
						{show ? "隐藏" : "显示"}
					</button>
				</div>
				<div className="px-4 py-2 text-[12px] text-black/40 leading-5">密钥只保存在这台手机的浏览器里，不会上传，也不会写进网站代码。</div>
				<div className="px-4 pt-2 pb-1 text-[13px] text-black/40">模型</div>
				<div className="bg-white p-4">
					<ModelPicker />
				</div>
				<div className="px-4 py-2 text-[12px] text-black/40 leading-5">
					默认 {DEFAULT_GEMINI_MODEL}。某个模型停用或繁忙时，会自动换备用模型重试。
				</div>
				<button
					type="button"
					disabled={busy || !config.apiKey}
					onClick={test}
					className="mx-auto mt-4 block h-[46px] w-[200px] rounded-[6px] bg-[#07C160] text-[16px] text-white disabled:opacity-40"
				>
					{busy ? "检测中…" : "检测连接"}
				</button>
				{result && (
					<div className={`mx-4 mt-4 rounded-[8px] p-3 text-[14px] leading-6 ${result.ok ? "bg-[#E6F6EC] text-[#0a7a3c]" : "bg-[#FBE9E9] text-[#C62828]"}`}>
						{result.text}
					</div>
				)}
				<div className="mt-6 px-4 text-[12px] text-black/40 leading-5">
					用法详见上一页「AI 助手」的介绍。
				</div>
			</div>
		</div>
	);
};

export default AiSettings;
