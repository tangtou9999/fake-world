import { withPerm } from "@/auth/Need";
import { h } from "@/components/HashAssets";
import { hashAssetsDB } from "@/db";
import { dialogueListAtom, setDialogueListValue } from "@/stateV2/dialogueList";
import { patchProfile } from "@/pages/wechat/my/settings/screenOps";
import { profileAtom } from "@/stateV2/profile";
import { setConversationListValue } from "@/stateV2/conversation";
import { unreadCountAtom } from "@/stateV2/unreadCount";
import { mainStore } from "@/stateV2/store";
import { getFileMD5 } from "@/utils";
import { useAtomValue } from "jotai";
import { useRef, useState } from "react";

const inputCls = "w-full rounded-[6px] bg-[#F5F5F5] px-3 py-[7px] text-[16px] outline-none";
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
	<div className="flex items-start gap-3 border-black/5 border-b py-2">
		<div className="w-[84px] shrink-0 pt-[7px] text-[14px] text-black/50">{label}</div>
		<div className="min-w-0 flex-1">{children}</div>
	</div>
);

/** 手机端「聊天信息」：好友昵称/备注/头像，首页这一行的预览文字、时间、未读、置顶、免打扰，顶部未读数字 */
const ChatInfoSheetInner = ({ friendId, onClose }: { friendId: string; onClose: () => void }) => {
	const profile = useAtomValue(profileAtom(friendId));
	const dialogues = useAtomValue(dialogueListAtom);
	const unread = useAtomValue(unreadCountAtom);
	const dlg = dialogues.find((v) => v.friendId === friendId);
	const fileRef = useRef<HTMLInputElement>(null);
	const [d, setD] = useState(() => ({
		nickname: profile?.nickname ?? "",
		remark: profile?.remark ?? "",
		avatar: profile?.avatarInfo ?? "",
		wechat: profile?.wechat ?? "",
		tickle: profile?.tickleText ?? "",
		last: dlg?.lastMessage ?? "",
		time: dlg?.lastMessageTime ?? "",
		unreadN: String(dlg?.unreadMarkNumber ?? 0),
		unreadType: dlg?.unreadDisplayType ?? "number",
		badgeHide: !!dlg?.badgeHide,
		pinned: !!dlg?.isPinned,
		muted: !!dlg?.isMuted,
		topAuto: unread.calcuateType === "auto",
		topN: String(unread.count),
	}));
	const set = (p: Partial<typeof d>) => setD((v) => ({ ...v, ...p }));

	const pickAvatar = async (f?: File) => {
		if (!f) return;
		if (f.size > 20 * 1024 * 1024) return window.alert("图片不能超过 20MB");
		const hash = await getFileMD5(f);
		await hashAssetsDB.images.put({ id: hash, file: f });
		set({ avatar: hash });
	};

	const save = () => {
		if (profile)
			patchProfile(friendId, {
				nickname: d.nickname.trim() || undefined,
				remark: d.remark.trim() || null,
				avatarInfo: d.avatar || undefined,
				wechat: d.wechat.trim() || undefined,
				tickleText: d.tickle.trim() || null,
			});
		if (dlg)
			setDialogueListValue((prev) =>
				prev.map((v) =>
					v.id === dlg.id
						? { ...v, lastMessage: d.last, lastMessageTime: d.time, unreadMarkNumber: Math.max(0, Math.round(Number(d.unreadN) || 0)), unreadDisplayType: d.unreadType as "number" | "dot", badgeHide: d.badgeHide, isPinned: d.pinned, isMuted: d.muted }
						: v,
				),
			);
		mainStore.set(unreadCountAtom, (v) => (d.topAuto ? { ...v, calcuateType: "auto" } : { calcuateType: "static", count: Math.max(0, Math.round(Number(d.topN) || 0)) }));
		onClose();
	};

	const clearChat = () => {
		if (!window.confirm("清空和这个人的全部聊天记录？")) return;
		setConversationListValue(friendId, []);
		onClose();
	};

	return (
		<div className="fixed inset-0 z-[1100] flex flex-col justify-end bg-black/40" onClick={onClose}>
			<div className="flex max-h-[88%] flex-col rounded-t-[14px] bg-white pb-[env(safe-area-inset-bottom)]" onClick={(e) => e.stopPropagation()}>
				<div className="flex h-12 shrink-0 items-center justify-between border-black/5 border-b px-4">
					<button type="button" className="text-[16px] text-black/60" onClick={onClose}>取消</button>
					<div className="font-medium text-[16px]">聊天信息</div>
					<button type="button" className="font-medium text-[16px] text-[#07C160]" onClick={save}>保存</button>
				</div>
				<div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
					{profile && (
						<>
							<Row label="头像">
								<button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-3">
									<h.img className="h-12 w-12 rounded-[6px] object-cover" src={d.avatar} />
									<span className="text-[14px] text-[#576B95]">更换头像</span>
								</button>
								<input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void pickAvatar(e.target.files?.[0]); e.target.value = ""; }} />
							</Row>
							<Row label="昵称"><input aria-label="昵称" value={d.nickname} onChange={(e) => set({ nickname: e.target.value })} className={inputCls} /></Row>
							<Row label="备注"><input aria-label="备注" value={d.remark} onChange={(e) => set({ remark: e.target.value })} placeholder="有备注时优先显示备注" className={inputCls} /></Row>
							<Row label="微信号"><input aria-label="微信号" value={d.wechat} onChange={(e) => set({ wechat: e.target.value })} className={inputCls} /></Row>
							<Row label="拍一拍"><input aria-label="拍一拍文案" value={d.tickle} onChange={(e) => set({ tickle: e.target.value })} className={inputCls} /></Row>
						</>
					)}
					{dlg && (
						<>
							<Row label="首页预览"><input aria-label="首页预览文字" value={d.last} onChange={(e) => set({ last: e.target.value })} className={inputCls} /></Row>
							<Row label="首页时间"><input aria-label="首页时间文字" value={d.time} onChange={(e) => set({ time: e.target.value })} placeholder="如 14:20、昨天、星期三" className={inputCls} /></Row>
							<Row label="未读数">
								<div className="flex items-center gap-2">
									<input aria-label="未读数" type="number" value={d.unreadN} onChange={(e) => set({ unreadN: e.target.value })} className={`${inputCls} w-[84px]`} />
									<select aria-label="角标样式" value={d.unreadType} onChange={(e) => set({ unreadType: e.target.value as "number" | "dot" })} className="rounded-[6px] bg-[#F5F5F5] px-2 py-[8px] text-[15px]">
										<option value="number">数字</option>
										<option value="dot">小红点</option>
									</select>
								</div>
							</Row>
							<Row label="选项">
								<div className="flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
									<label><input type="checkbox" checked={d.pinned} onChange={(e) => set({ pinned: e.target.checked })} /> 置顶</label>
									<label><input type="checkbox" checked={d.muted} onChange={(e) => set({ muted: e.target.checked })} /> 免打扰</label>
									<label><input type="checkbox" checked={d.badgeHide} onChange={(e) => set({ badgeHide: e.target.checked })} /> 隐藏角标</label>
								</div>
							</Row>
						</>
					)}
					<Row label="顶部数字">
						<div className="flex items-center gap-2 text-[15px]">
							<label><input type="checkbox" checked={d.topAuto} onChange={(e) => set({ topAuto: e.target.checked })} /> 自动统计</label>
							{!d.topAuto && <input aria-label="顶部未读数" type="number" value={d.topN} onChange={(e) => set({ topN: e.target.value })} className={`${inputCls} w-[84px]`} />}
						</div>
						<div className="mt-1 text-[12px] text-black/40">聊天页返回键旁和底部「微信」上的数字</div>
					</Row>
					<div className="pt-3">
						<button type="button" className="rounded-[6px] border border-[#FA5151] px-4 py-2 text-[14px] text-[#FA5151]" onClick={clearChat}>清空聊天记录</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default withPerm("editChat", ChatInfoSheetInner);
