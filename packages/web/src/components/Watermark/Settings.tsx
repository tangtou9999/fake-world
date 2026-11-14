import { type Watermark, WM_DEFAULT, hashPin, isUnlocked, setUnlocked, watermarkAtom, withDefaults } from "@/stateV2/watermark";
import { App as AntdApp, Button, Input, Segmented, Slider, Switch } from "antd";
import { useAtom } from "jotai";
import { useState } from "react";

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
	<div className="flex items-center justify-between gap-3 py-[7px]">
		<span className="w-[72px] shrink-0 text-[14px] text-black/70">{label}</span>
		<div className="min-w-0 flex-1">{children}</div>
	</div>
);

const SWATCH = ["#8A8A8A", "#000000", "#FFFFFF", "#E8523F", "#07C160", "#1677FF", "#F5A623", "#9B59B6"];

/** 编辑模式 → 工具 → 水印 */
const WatermarkSettings = () => {
	const { message } = AntdApp.useApp();
	const [stored, setStored] = useAtom(watermarkAtom);
	const w = withDefaults(stored);
	const [open, setOpen] = useState(isUnlocked() || !w.lock);
	const [pin, setPin] = useState("");
	const [newPin, setNewPin] = useState("");
	const set = (p: Partial<Watermark>) => setStored((s) => ({ ...s, ...p }));

	const unlock = async () => {
		if ((await hashPin(pin)) === w.lock) {
			setUnlocked(true);
			setOpen(true);
			setPin("");
		} else message.error("口令不对");
	};

	if (!open && w.lock) {
		return (
			<div className="mb-4 rounded-lg bg-[#F7F7F7] p-3">
				<div className="mb-2 font-medium text-[15px]">水印（已锁定）</div>
				<div className="mb-2 text-[12px] text-black/50">输入口令后才能修改水印。</div>
				<div className="flex gap-2">
					<Input.Password value={pin} onChange={(e) => setPin(e.target.value)} onPressEnter={() => void unlock()} placeholder="口令" />
					<Button type="primary" onClick={() => void unlock()}>
						解锁
					</Button>
				</div>
			</div>
		);
	}

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
						{ label: "描边填充", value: "both" },
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
			<Row label="追踪">
				<div className="flex items-center gap-2">
					<Switch checked={w.trace} onChange={(trace) => set({ trace })} />
					<span className="text-[12px] text-black/45">文字后加账号后四位，截图流出能查是谁</span>
				</div>
			</Row>
			<div className="mt-2 border-black/10 border-t pt-2">
				<div className="mb-1 text-[13px] text-black/60">口令锁（防止别人关掉水印）</div>
				<div className="flex gap-2">
					<Input.Password value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="设置新口令（至少 4 位）" />
					<Button
						onClick={async () => {
							if (newPin.length < 4) return message.error("口令至少 4 位");
							set({ lock: await hashPin(newPin) });
							setNewPin("");
							message.success("口令已更新");
						}}
					>
						设置
					</Button>
				</div>
				<div className="mt-2 flex gap-2">
					<Button
						onClick={() => {
							setUnlocked(false);
							setOpen(false);
						}}
					>
						立即锁定
					</Button>
					<Button
						danger
						onClick={() => {
							setStored((s) => ({ ...WM_DEFAULT, lock: s.lock ?? WM_DEFAULT.lock }));
							message.success("已恢复默认水印");
						}}
					>
						恢复默认
					</Button>
				</div>
			</div>
		</div>
	);
};

export default WatermarkSettings;
