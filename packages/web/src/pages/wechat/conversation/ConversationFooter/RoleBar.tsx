import { FILE_HELPER_ID } from "@/faker/wechat/user/fileHelper";
import {
	EConversationType,
	type TConversationItem,
	type TConversationRole,
	fromLastGenerateUpperText,
	inputterConfigAtom,
	setConversationListValue,
} from "@/stateV2/conversation";
import { touchDialogue } from "@/stateV2/fileHelper";
import { SLATE_INITIAL_VALUE } from "@/wechatComponents/SlateText/utils";
import dayjs from "dayjs";
import { useAtom } from "jotai";
import { nanoid } from "nanoid";
import { useState } from "react";
import { useConversationAPI } from "../context";

const PREFIX = /^\s*(我|对方|他|她|friend|me)\s*[:：]\s*/i;

const RoleBar = () => {
	const { conversationId, scrollConversationListToBtm } = useConversationAPI();
	const [config, setConfig] = useAtom(inputterConfigAtom);
	const [open, setOpen] = useState(false);
	const [text, setText] = useState("");
	if (conversationId === FILE_HELPER_ID) return null;

	const roleBtn = (role: TConversationRole, label: string) => (
		<button
			type="button"
			onClick={() => setConfig((v) => ({ ...v, sendRole: role }))}
			className={`h-7 rounded-full px-4 text-[14px] ${config.sendRole === role ? "bg-[#07C160] text-white" : "bg-black/5 text-black/60"}`}
		>
			{label}
		</button>
	);

	const sendAll = () => {
		let role: TConversationRole = config.sendRole;
		const items: { role: TConversationRole; text: string }[] = [];
		for (const raw of text.split("\n")) {
			if (!raw.trim()) continue;
			const m = raw.match(PREFIX);
			if (m) role = /^(我|me)$/i.test(m[1]) ? "mine" : "friend";
			const body = raw.replace(PREFIX, "").trim();
			if (body) items.push({ role, text: body });
		}
		if (items.length === 0) return;
		const now = dayjs().valueOf();
		setConversationListValue(conversationId, (prev) => [
			...prev,
			...items.map(
				(it, i) =>
					({
						type: EConversationType.text,
						role: it.role,
						id: nanoid(8),
						textContent: [{ type: "paragraph", children: [{ text: it.text }] }],
						sendTimestamp: now + i,
						upperText: i === 0 ? fromLastGenerateUpperText(prev) : undefined,
					}) as unknown as TConversationItem,
			),
		]);
		touchDialogue(conversationId, items[items.length - 1].text);
		void SLATE_INITIAL_VALUE;
		setText("");
		setOpen(false);
		scrollConversationListToBtm();
	};

	return (
		<>
			<div className="flex items-center gap-2 bg-[#F7F7F7] px-3 pt-2">
				<span className="text-[13px] text-black/40">发送人</span>
				{roleBtn("mine", "我")}
				{roleBtn("friend", "对方")}
				<button
					type="button"
					onClick={() => setOpen(true)}
					className="ml-auto h-7 rounded-full bg-black/5 px-4 text-[14px] text-black/70"
				>
					批量输入
				</button>
			</div>
			{open && (
				<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setOpen(false)}>
					<div className="rounded-t-[12px] bg-white p-4 pb-[calc(16px+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
						<div className="mb-2 font-medium text-[16px]">批量输入聊天记录</div>
						<div className="mb-2 text-[12px] text-black/50 leading-5">
							一行一条。行首写「我：」或「对方：」切换发送人；不写就沿用上一行（第一行用当前选择的发送人）。
						</div>
						<textarea
							className="h-[200px] w-full resize-none rounded-[8px] bg-[#F5F5F5] p-3 text-[16px] outline-none"
							placeholder={"对方：在吗\n对方：帮我转一下\n我：好的\n我：稍等"}
							value={text}
							onChange={(e) => setText(e.target.value)}
						/>
						<div className="mt-3 flex gap-3">
							<button type="button" onClick={() => setOpen(false)} className="h-[44px] flex-1 rounded-[6px] bg-black/5 text-[16px]">
								取消
							</button>
							<button type="button" onClick={sendAll} className="h-[44px] flex-1 rounded-[6px] bg-[#07C160] text-[16px] text-white">
								发送全部
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
};

export default RoleBar;
