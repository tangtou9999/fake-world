import { type Watermark, watermarkAtom, withDefaults } from "@/stateV2/watermark";
import { App as AntdApp, Button, Input, Segmented, Slider, Switch } from "antd";
import { useAtom } from "jotai";

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
	<div className="flex items-center justify-between gap-3 py-[7px]">
		<span className="w-[72px] shrink-0 text-[14px] text-black/70">{label}</span>
		<div className="min-w-0 flex-1">{children}</div>
	</div>
);

const SWATCH = ["#8A8A8A", "#000000", "#FFFFFF", "#E8523F", "#07C160", "#1677FF", "#F5A623", "#9B59B6"];

/** 桌面左上角「水印」入口里的设置面板 */
const WatermarkSettings = () => {
	const { message } = AntdApp.useApp();
	const [stored, setStored] = useAtom(watermarkAtom);
	const w = withDefaults(stored);
	const set = (p: Partial<Watermark>) => setStored((s) => ({ ...s, ...p }));

	return (
		<div className="mb-4 rounded-lg bg-[#F7F7F7] p-3">
			<div className="mb-1 flex items-center justify-between">
				<span className="font-medium text-[15px]">水印</span>
				<Switch checked={w.on} onChange={(on) => set({ on })} />
			</div>
			<div className="mb-2 text-[12px] text-black/45">改了立刻生效，可以退出这里直接看效果。</div>
			<Row label="文字">
				<Input value={w.text} maxLength={30} onChange={(e) => set({ text: e.target.value })} placeholder="水印文字" />
			</Row>
			<Row label="样式">
				<Segmented
					block
					value={w.style}
					options={[
						{ label: "实心", value: "solid" },
						{ label: "空心", value: "hollow" },
						{ label: "两者", value: "both" },
					]}
					onChange={(v) => set({ style: v as Watermark["style"] })}
				/>
			</Row>
			<Row label="大小">
				<Slider min={10} max={90} value={w.size} onChange={(size) => set({ size })} />
			</Row>
			<Row label="浓淡">
				<Slider min={3} max={100} value={Math.round(w.opacity * 100)} onChange={(v) => set({ opacity: v / 100 })} />
			</Row>
			<Row label="角度">
				<Slider min={-90} max={90} value={w.angle} onChange={(angle) => set({ angle })} />
			</Row>
			<Row label="横向间距">
				<Slider min={0} max={300} value={w.gapX} onChange={(gapX) => set({ gapX })} />
			</Row>
			<Row label="纵向间距">
				<Slider min={0} max={300} value={w.gapY} onChange={(gapY) => set({ gapY })} />
			</Row>
			<Row label="颜色">
				<div className="flex flex-wrap items-center gap-2">
					{SWATCH.map((c) => (
						<button
							key={c}
							type="button"
							aria-label={c}
							onClick={() => set({ color: c })}
							className="h-[24px] w-[24px] rounded-full border"
							style={{ background: c, borderColor: w.color.toLowerCase() === c.toLowerCase() ? "#07C160" : "#ddd", borderWidth: w.color.toLowerCase() === c.toLowerCase() ? 2 : 1 }}
						/>
					))}
					<input type="color" value={w.color} onChange={(e) => set({ color: e.target.value })} className="h-[26px] w-[34px] border-0 bg-transparent p-0" />
				</div>
			</Row>
			<Row label="加粗">
				<Switch checked={w.bold} onChange={(bold) => set({ bold })} />
			</Row>
			<Row label="交错排列">
				<Switch checked={w.stagger} onChange={(stagger) => set({ stagger })} />
			</Row>
			<Row label="显示范围">
				<Segmented
					block
					value={w.scope}
					options={[
						{ label: "只在聊天页", value: "chat" },
						{ label: "所有页面", value: "all" },
					]}
					onChange={(v) => set({ scope: v as Watermark["scope"] })}
				/>
			</Row>
			<Row label="层级">
				<Segmented
					block
					value={w.layer}
					options={[
						{ label: "垫在聊天下面", value: "under" },
						{ label: "盖在聊天上面", value: "top" },
					]}
					onChange={(v) => set({ layer: v as Watermark["layer"] })}
				/>
			</Row>
			<div className="-mt-1 mb-1 text-[11px] text-black/40">垫在下面：文字、气泡、红包、转账都不会被水印穿透（只在聊天页生效）；盖在上面：整屏都有，截图最稳。</div>
			<Row label="追踪">
				<div className="flex items-center gap-2">
					<Switch checked={w.trace} onChange={(trace) => set({ trace })} />
					<span className="text-[12px] text-black/45">文字后加账号后四位，截图流出能查是谁</span>
				</div>
			</Row>
			<div className="mt-2 border-black/10 border-t pt-2">
				<Button
					danger
					onClick={() => {
						setStored({});
						message.success("已恢复默认水印");
					}}
				>
					恢复默认
				</Button>
			</div>
		</div>
	);
};

export default WatermarkSettings;
