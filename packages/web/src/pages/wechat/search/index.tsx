import SearchOutlinedSVG from "@/assets/search-outlined.svg?react";
import useScreenTopBg from "@/components/useScreenTopBg";
import { listContacts, searchChats } from "@/pages/wechat/my/settings/aiChatTools";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const Hl = ({ text, q }: { text: string; q: string }) => {
	const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
	if (i < 0) return <>{text}</>;
	const start = Math.max(0, i - 8);
	return (
		<>
			{start > 0 ? "…" : ""}
			{text.slice(start, i)}
			<span className="text-[#07C160]">{text.slice(i, i + q.length)}</span>
			{text.slice(i + q.length, i + q.length + 40)}
		</>
	);
};

/** 微信首页搜索：搜联系人、搜聊天记录里的关键词。输入内容只在这一页，离开后自动清空。 */
const ChatSearch = () => {
	useScreenTopBg("#EDEDED");
	const navigate = useNavigate();
	const [q, setQ] = useState("");
	const key = q.trim();
	const contacts = useMemo(() => (key ? listContacts().filter((c) => c.name.toLowerCase().includes(key.toLowerCase())) : []), [key]);
	const chats = useMemo(() => searchChats(key), [key]);
	const open = (id: string) => navigate(`/wechat/conversation/${id}`);

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-white">
			<div className="flex shrink-0 items-center gap-3 bg-[#EDEDED] px-[15px] pt-[env(safe-area-inset-top)] pb-2">
				<div className="mt-2 flex h-[35px] flex-1 items-center rounded-md bg-white px-2">
					<SearchOutlinedSVG width={22} height={22} fill="rgba(0,0,0,0.35)" />
					<input
						autoFocus
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder="搜索"
						aria-label="搜索"
						className="ml-1 min-w-0 flex-1 bg-transparent text-[16px] outline-none"
					/>
				</div>
				<button type="button" className="mt-2 text-[16px] text-[#576B95]" onClick={() => navigate(-1)}>
					取消
				</button>
			</div>
			<div className="min-h-0 flex-1 overflow-auto">
				{key && contacts.length === 0 && chats.length === 0 && <div className="pt-16 text-center text-[15px] text-black/40">没有找到「{key}」相关的内容</div>}
				{contacts.length > 0 && (
					<>
						<div className="bg-[#F7F7F7] px-4 py-1 text-[13px] text-black/50">联系人</div>
						{contacts.map((c) => (
							<button key={c.id} type="button" onClick={() => open(c.id)} className="block w-full border-black/5 border-b px-4 py-3 text-left text-[16px]">
								<Hl text={c.name} q={key} />
							</button>
						))}
					</>
				)}
				{chats.length > 0 && (
					<>
						<div className="bg-[#F7F7F7] px-4 py-1 text-[13px] text-black/50">聊天记录</div>
						{chats.map((c) => (
							<button key={c.id} type="button" onClick={() => open(c.id)} className="block w-full border-black/5 border-b px-4 py-3 text-left">
								<div className="text-[16px]">{c.name}</div>
								<div className="mt-1 truncate text-[14px] text-black/50">
									{c.count > 1 ? `${c.count} 条相关聊天记录` : <Hl text={c.snippet} q={key} />}
								</div>
							</button>
						))}
					</>
				)}
			</div>
		</div>
	);
};

export default ChatSearch;
