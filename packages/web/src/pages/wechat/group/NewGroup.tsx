import { MYSELF_ID } from "@/faker/wechat/user";
import { FILE_HELPER_ID } from "@/faker/wechat/user/fileHelper";
import { createGroup } from "@/stateV2/group";
import { allProfilesAtom } from "@/stateV2/profile";
import { showToast } from "@/wechatComponents/Toast";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavBar } from "../addFriend/Shared";

/** 发起群聊：从现有联系人里勾选成员（至少 2 人） */
const NewGroup = () => {
	const navigate = useNavigate();
	const profiles = useAtomValue(allProfilesAtom);
	const [picked, setPicked] = useState<string[]>([]);
	const list = profiles.filter((p) => p.id !== MYSELF_ID && p.id !== FILE_HELPER_ID && !p.id.startsWith("g_"));
	const toggle = (id: string) => setPicked((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

	const done = () => {
		if (picked.length < 2) return showToast({ content: "请至少选择 2 位联系人" });
		const id = createGroup(picked);
		navigate(`/wechat/conversation/${id}`, { replace: true });
	};

	return (
		<div className="flex h-full flex-col bg-white">
			<NavBar
				title="发起群聊"
				right={
					<button type="button" onClick={done} className={`rounded-[4px] px-3 py-1 text-[14px] ${picked.length >= 2 ? "bg-[#07C160] text-white" : "bg-black/10 text-black/30"}`}>
						完成{picked.length ? `(${picked.length})` : ""}
					</button>
				}
			/>
			<div className="flex-1 overflow-y-auto">
				{list.map((p) => {
					const on = picked.includes(p.id);
					return (
						<button key={p.id} type="button" onClick={() => toggle(p.id)} className="flex w-full items-center px-4 py-2 text-left">
							<span className={`mr-3 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border text-[13px] ${on ? "border-[#07C160] bg-[#07C160] text-white" : "border-black/25"}`}>{on ? "✓" : ""}</span>
							<img src={p.avatarInfo} alt="" className="h-10 w-10 shrink-0 rounded-[4px] object-cover" />
							<span className="ml-3 truncate border-black/5 border-b py-3 text-[17px]" style={{ flex: 1 }}>
								{p.remark || p.nickname}
							</span>
						</button>
					);
				})}
				{list.length === 0 && <div className="p-8 text-center text-black/40">还没有联系人，先添加朋友</div>}
			</div>
		</div>
	);
};
export default NewGroup;
