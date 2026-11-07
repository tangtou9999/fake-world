import { GEMINI_VOICES, VOICE_ACCENTS, type VoiceProfile } from "@/stateV2/gemini";

type Props = {
	value: VoiceProfile;
	onChange: (v: VoiceProfile) => void;
	onTrial: () => void;
	trialDisabled?: boolean;
	/** 在这个声音档案里额外显示的说明 */
	hint?: string;
};

const Slider = ({ label, desc, value, onChange }: { label: string; desc: string; value: number; onChange: (n: number) => void }) => (
	<div className="mt-3">
		<div className="flex items-center justify-between text-[14px]">
			<span>{label}</span>
			<span className="text-black/40">{value}%</span>
		</div>
		<input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-[#07C160]" />
		<div className="text-[12px] text-black/40 leading-5">{desc}</div>
	</div>
);

const VoiceProfileEditor = ({ value, onChange, onTrial, trialDisabled, hint }: Props) => {
	const set = (patch: Partial<VoiceProfile>) => onChange({ ...value, ...patch });
	const males = GEMINI_VOICES.filter((v) => v.gender === "男");
	const females = GEMINI_VOICES.filter((v) => v.gender === "女");
	const cur = GEMINI_VOICES.find((v) => v.id === value.voice);
	return (
		<div className="bg-white px-4 py-3">
			{hint && <div className="mb-2 text-[12px] text-black/40 leading-5">{hint}</div>}
			<div className="text-[14px]">声纹（共 30 款）</div>
			<div className="mt-1 flex items-center gap-2">
				<select className="h-10 min-w-0 flex-1 rounded-[6px] bg-[#F5F5F5] px-2 text-[15px] outline-none" value={value.voice} onChange={(e) => set({ voice: e.target.value })}>
					<optgroup label="男声（16 款）">
						{males.map((o) => (
							<option key={o.id} value={o.id}>
								{o.label} · {o.desc}
							</option>
						))}
					</optgroup>
					<optgroup label="女声（14 款）">
						{females.map((o) => (
							<option key={o.id} value={o.id}>
								{o.label} · {o.desc}
							</option>
						))}
					</optgroup>
				</select>
				<button type="button" disabled={trialDisabled} onClick={onTrial} className="h-10 shrink-0 rounded-[6px] bg-[#07C160] px-4 text-[15px] text-white disabled:opacity-40">
					试听
				</button>
			</div>
			{cur && <div className="mt-1 text-[12px] text-black/40">{cur.gender}声 · {cur.desc}</div>}
			<div className="mt-3 text-[14px]">说话底色（人设和习惯）</div>
			<textarea
				className="mt-1 h-[64px] w-full resize-none rounded-[6px] bg-[#F5F5F5] p-2 text-[14px] leading-5 outline-none placeholder:text-black/30"
				placeholder="例如：慵懒爱撒娇的小女友，说话慢条斯理带鼻音 / 嘴碎爱开玩笑的损友，语速快"
				value={value.persona ?? ""}
				onChange={(e) => set({ persona: e.target.value })}
			/>
			<div className="mt-3 text-[14px]">口音 / 地域腔调</div>
			<select className="mt-1 h-10 w-full rounded-[6px] bg-[#F5F5F5] px-2 text-[15px] outline-none" value={value.accent ?? VOICE_ACCENTS[0]} onChange={(e) => set({ accent: e.target.value })}>
				{VOICE_ACCENTS.map((a) => (
					<option key={a} value={a}>
						{a}
					</option>
				))}
			</select>
			<Slider label="气泡音 / 贴耳呼吸感" desc="越高越像贴着耳朵小声说话（高频提升，并在提示词里加入气声）" value={value.air ?? 0} onChange={(n) => set({ air: n })} />
			<Slider label="胸腔共鸣 / 磁性厚度" desc="越高声音越厚、越有近讲的磁性，去掉电子塑料感" value={value.chest ?? 0} onChange={(n) => set({ chest: n })} />
			<label className="mt-3 flex items-start justify-between gap-3 text-[14px]">
				<span>
					电话听筒 / 微信劣质麦
					<span className="block text-[12px] text-black/40 leading-5">模拟隔着手机听筒或信号不好的音质</span>
				</span>
				<input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#07C160]" checked={!!value.phone} onChange={(e) => set({ phone: e.target.checked })} />
			</label>
		</div>
	);
};

export default VoiceProfileEditor;
