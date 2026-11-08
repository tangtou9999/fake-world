import { MYSELF_ID } from "@/faker/wechat/user";
import { setConversationListValue } from "@/stateV2/conversation";
import { setDialogueListValue } from "@/stateV2/dialogueList";
import { deleteGroup, groupAtom, groupCount, updateGroup } from "@/stateV2/group";
import { allProfilesAtom } from "@/stateV2/profile";
import { showToast } from "@/wechatComponents/Toast";
import { useAtomValue } from "jotai";
import { type ReactNode, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const Chevron = () => (
	<svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true" className="ml-2 shrink-0">
		<path d="M1 1l6 6-6 6" stroke="#C7C7CC" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

const Toggle = ({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) => (
	<button type="button" aria-pressed={on} onClick={() => onChange(!on)} className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${on ? "bg-[#07C160]" : "bg-[#E5E5E5]"}`}>
		<span className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-[2px]"}`} />
	</button>
);

const Row = ({ label, children, onClick, border = true, className = "" }: { label: ReactNode; children?: ReactNode; onClick?: () => void; border?: boolean; className?: string }) => (
	<div onClick={onClick} className={`relative flex min-h-[56px] items-center bg-white pr-4 pl-4 text-[17px] ${onClick ? "cursor-pointer" : ""} ${className}`}>
		<div className="flex-1">{label}</div>
		{children}
		{border && <div className="absolute right-0 bottom-0 left-4 h-px bg-black/[0.07]" />}
	</div>
);
const Gap = () => <div className="h-2 bg-[#EDEDED]" />;

/** 群聊信息页（聊天信息） */
const GroupInfo = () => {
	const { id = "" } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const group = useAtomValue(groupAtom(id));
	const profiles = useAtomValue(allProfilesAtom);
	const [all, setAll] = useState(false);
	if (!group) return <div className="p-8 text-center text-black/40">这个群聊不存在</div>;

	const members = group.memberIds.map((m) => profiles.find((p) => p.id === m)).filter((p): p is NonNullable<typeof p> => !!p);
	const MAX = 19;
	const shown = all ? members : members.slice(0, MAX);
	const edit = (label: string, key: "name" | "announcement" | "remark" | "myNick") => {
		const v = window.prompt(label, group[key] ?? "");
		if (v === null) return;
		updateGroup(id, { [key]: v.trim() || undefined });
	};
	const setFlag = (key: "isMuted" | "isPinned", v: boolean) => setDialogueListValue((prev) => prev.map((d) => (d.id === id ? { ...d, [key]: v || undefined } : d)));
	const dlg = (key: "isMuted" | "isPinned") => {
		try {
			return !!JSON.parse(localStorage.getItem("dialogueList") ?? "[]").find((d: { id: string }) => d.id === id)?.[key];
		} catch {
			return false;
		}
	};
	const na = () => showToast({ content: "暂未开放" });
	const [muted, setMuted] = useState(dlg("isMuted"));
	const [pinned, setPinned] = useState(dlg("isPinned"));

	return (
		<div className="flex h-full flex-col bg-[#EDEDED]">
			<div className="relative flex h-11 shrink-0 items-center justify-center bg-[#EDEDED] px-4">
				<button type="button" aria-label="返回" className="absolute left-3 flex h-8 w-8 items-center" onClick={() => navigate(-1)}>
					<svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
						<path d="M10 2L2 10l8 8" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				</button>
				<div className="font-medium text-[17.5px]">聊天信息({groupCount(group)})</div>
				<svg className="absolute right-4" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" aria-hidden="true">
					<circle cx="11" cy="11" r="7.5" />
					<path d="M16.500 16.500L21 21" strokeLinecap="round" />
				</svg>
			</div>
			<div className="flex-1 overflow-y-auto">
				<div className="bg-white px-[22px] pt-4 pb-3">
					<div className="grid grid-cols-5 gap-y-[14px]">
						{shown.map((p) => (
							<div key={p.id} className="flex flex-col items-center">
								<img src={p.avatarInfo} alt="" className="h-[50px] w-[50px] rounded-[5px] object-cover" />
								<div className="mt-[6px] w-[62px] truncate text-center text-[12px] text-black/50">{(p.id === MYSELF_ID && group.myNick) || p.remark || p.nickname}</div>
							</div>
						))}
						<div className="flex flex-col items-center">
							<button type="button" aria-label="添加成员" onClick={na} className="flex h-[50px] w-[50px] items-center justify-center rounded-[5px] border border-black/25 border-dashed text-[28px] text-black/30">
								+
							</button>
						</div>
					</div>
					{members.length > MAX && !all && (
						<button type="button" onClick={() => setAll(true)} className="mx-auto mt-3 flex items-center text-[15px] text-black/50">
							更多群成员
							<svg width="12" height="8" viewBox="0 0 12 8" fill="none" className="ml-1" aria-hidden="true">
								<path d="M1 1l5 5 5-5" stroke="rgba(0,0,0,.45)" strokeWidth="1.4" strokeLinecap="round" />
							</svg>
						</button>
					)}
				</div>
				<Gap />
				<Row label="群聊名称" onClick={() => edit("群聊名称", "name")}>
					<span className="max-w-[60%] truncate text-black/50">{group.name}</span>
					<Chevron />
				</Row>
				<Row label="群二维码" onClick={na}>
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,.5)" strokeWidth="1.6" aria-hidden="true">
						<rect x="3" y="3" width="7" height="7" rx="1" />
						<rect x="14" y="3" width="7" height="7" rx="1" />
						<rect x="3" y="14" width="7" height="7" rx="1" />
						<path d="M14 14h3v3h-3zM19 19h2v2h-2z" />
					</svg>
					<Chevron />
				</Row>
				<Row label={<div className="py-3"><div>群公告</div>{group.announcement && <div className="mt-1 line-clamp-3 whitespace-pre-line text-[16px] text-black/50 leading-[26px]">{group.announcement}</div>}</div>} onClick={() => edit("群公告", "announcement")}>
					<Chevron />
				</Row>
				<Row label="备注" onClick={() => edit("备注", "remark")} border={false}>
					{group.remark && <span className="max-w-[60%] truncate text-black/50">{group.remark}</span>}
					<Chevron />
				</Row>
				<Gap />
				<Row label="查找聊天内容" onClick={na} border={false}>
					<Chevron />
				</Row>
				<Gap />
				<Row label="消息免打扰">
					<Toggle on={muted} onChange={(v) => { setMuted(v); setFlag("isMuted", v); }} />
				</Row>
				<Row label={<span className="text-black/90"><span className="mr-2 text-black/30">–</span>折叠该聊天</span>} className="pl-3">
					<Toggle on={!!group.fold} onChange={(v) => updateGroup(id, { fold: v })} />
				</Row>
				<Row label={<div className="py-3"><div><span className="mr-2 text-black/30">–</span>以下消息仍通知</div><div className="mt-1 ml-5 text-[15px] text-black/40">@我、@所有人和群公告</div></div>} className="pl-3" onClick={na}>
					<Chevron />
				</Row>
				<Row label="置顶聊天">
					<Toggle on={pinned} onChange={(v) => { setPinned(v); setFlag("isPinned", v); }} />
				</Row>
				<Row label="保存到通讯录" border={false}>
					<Toggle on={!!group.saved} onChange={(v) => updateGroup(id, { saved: v })} />
				</Row>
				<Gap />
				<Row label="我在本群的昵称" onClick={() => edit("我在本群的昵称", "myNick")}>
					<span className="max-w-[55%] truncate text-black/50">{group.myNick || profiles.find((p) => p.id === MYSELF_ID)?.nickname}</span>
					<Chevron />
				</Row>
				<Row label="显示群成员昵称" border={false}>
					<Toggle on={group.showNick !== false} onChange={(v) => updateGroup(id, { showNick: v })} />
				</Row>
				<Gap />
				<Row label="设置当前聊天背景" onClick={na} border={false}>
					<Chevron />
				</Row>
				<Gap />
				<Row
					label="清空聊天记录"
					border={false}
					onClick={() => window.confirm("确定清空这个群的聊天记录吗？") && (setConversationListValue(id, []), showToast({ content: "已清空" }))}
				/>
				<Gap />
				<Row label="投诉" onClick={na} border={false}>
					<Chevron />
				</Row>
				<Gap />
				<div
					className="flex h-[56px] cursor-pointer items-center justify-center bg-white text-[17px] text-[#FA5151]"
					onClick={() => {
						if (!window.confirm("退出后，这个群聊和它的聊天记录会从这台手机上删除。确定退出吗？")) return;
						setConversationListValue(id, []);
						deleteGroup(id);
						navigate("/wechat", { replace: true });
					}}
				>
					退出群聊
				</div>
				<div className="h-8" />
			</div>
		</div>
	);
};
export default GroupInfo;
