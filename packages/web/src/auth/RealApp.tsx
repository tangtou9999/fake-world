import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { API_BASE } from "./config";
import { logout, readSession } from "./session";

type Friend = { id: number; name: string; phone: string; role: string; last: { id: number; from: number; text: string; ts: number } | null; unread: number };
type Msg = { id: number; sender: number; receiver: number; text: string; ts: number };
type Memo = { id: number; text: string; updatedAt: number };

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (ts: number) => {
	const d = new Date(ts);
	const now = new Date();
	const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
	if (d.toDateString() === now.toDateString()) return hm;
	return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`;
};
const Avatar = ({ name }: { name: string }) => (
	<div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[6px] bg-[#07C160] text-[20px] text-white">{(name || "?").slice(0, 1)}</div>
);

/** 新消息实时推送（WebSocket），断线自动重连；同时每 20 秒兜底拉一次 */
function useRealSocket(onMsg: (m: Msg) => void, onTick: () => void) {
	const cbRef = useRef({ onMsg, onTick });
	cbRef.current = { onMsg, onTick };
	useEffect(() => {
		let ws: WebSocket | null = null;
		let stop = false;
		let retry = 0;
		const connect = () => {
			const token = readSession()?.token;
			if (!token || stop) return;
			const base = (API_BASE || window.location.origin).replace(/^http/, "ws");
			ws = new WebSocket(`${base}/ws?token=${encodeURIComponent(token)}`);
			ws.onopen = () => {
				retry = 0;
				cbRef.current.onTick();
			};
			ws.onmessage = (e) => {
				try {
					const d = JSON.parse(e.data);
					if (d.type === "msg") cbRef.current.onMsg(d.message);
				} catch {}
			};
			ws.onclose = () => {
				if (!stop) setTimeout(connect, Math.min(15000, 1000 * 2 ** retry++));
			};
		};
		connect();
		const poll = setInterval(() => cbRef.current.onTick(), 20000);
		return () => {
			stop = true;
			clearInterval(poll);
			ws?.close();
		};
	}, []);
}

const ChatView = ({ me, peer, incoming, onBack, onChanged }: { me: number; peer: Friend; incoming: Msg | null; onBack: () => void; onChanged: () => void }) => {
	const [msgs, setMsgs] = useState<Msg[]>([]);
	const [text, setText] = useState("");
	const [err, setErr] = useState("");
	const box = useRef<HTMLDivElement>(null);

	const markRead = useCallback(
		(list: Msg[]) => {
			const last = list.filter((m) => m.sender === peer.id).at(-1);
			if (last) void api("/api/real/read", { body: { peer: peer.id, upTo: last.id } }).then(onChanged).catch(() => {});
		},
		[peer.id, onChanged],
	);
	const load = useCallback(async () => {
		const { messages } = await api<{ messages: Msg[] }>(`/api/real/messages?peer=${peer.id}`);
		setMsgs(messages);
		markRead(messages);
	}, [peer.id, markRead]);
	useEffect(() => {
		load().catch((e) => setErr(e.message));
	}, [load]);
	useEffect(() => {
		if (!incoming || (incoming.sender !== peer.id && incoming.receiver !== peer.id)) return;
		setMsgs((prev) => {
			if (prev.some((m) => m.id === incoming.id)) return prev;
			const next = [...prev, incoming];
			markRead(next);
			return next;
		});
	}, [incoming, peer.id, markRead]);
	useEffect(() => {
		box.current?.scrollTo({ top: box.current.scrollHeight });
	}, [msgs.length]);

	const send = async () => {
		const t = text.trim();
		if (!t) return;
		setText("");
		setErr("");
		try {
			const { message } = await api<{ message: Msg }>("/api/real/messages", { body: { to: peer.id, text: t } });
			setMsgs((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
			onChanged();
		} catch (e) {
			setText(t);
			setErr(e instanceof Error ? e.message : "发送失败");
		}
	};

	return (
		<div className="flex h-full min-h-screen flex-col bg-[#EDEDED]">
			<div className="flex h-[48px] shrink-0 items-center border-black/10 border-b bg-[#EDEDED] px-3">
				<button type="button" className="w-[50px] text-left text-[16px]" onClick={onBack}>
					‹ 返回
				</button>
				<div className="flex-1 text-center font-medium text-[17px]">{peer.name}</div>
				<div className="w-[50px]" />
			</div>
			<div ref={box} className="min-h-0 flex-1 overflow-auto px-3 py-3">
				{msgs.map((m, i) => {
					const mine = m.sender === me;
					const showTime = i === 0 || m.ts - msgs[i - 1].ts > 5 * 60_000;
					return (
						<div key={m.id}>
							{showTime && <div className="my-2 text-center text-[12px] text-black/35">{fmt(m.ts)}</div>}
							<div className={`my-2 flex items-start gap-2 ${mine ? "flex-row-reverse" : ""}`}>
								<Avatar name={mine ? readSession()?.user.name || "我" : peer.name} />
								<div className={`max-w-[70%] whitespace-pre-wrap break-words rounded-[6px] px-3 py-[9px] text-[16px] ${mine ? "bg-[#95EC69]" : "bg-white"}`}>{m.text}</div>
							</div>
						</div>
					);
				})}
			</div>
			{err && <div className="bg-[#FA5151]/10 px-3 py-1 text-[13px] text-[#FA5151]">{err}</div>}
			<div className="flex shrink-0 items-end gap-2 border-black/10 border-t bg-[#F7F7F7] px-3 py-2">
				<textarea
					rows={1}
					className="max-h-[110px] min-h-[38px] flex-1 resize-none rounded-[6px] bg-white px-3 py-[8px] text-[16px] outline-none"
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
							e.preventDefault();
							void send();
						}
					}}
				/>
				<button type="button" disabled={!text.trim()} className={`h-[38px] w-[60px] rounded-[6px] text-[15px] text-white ${text.trim() ? "bg-[#07C160]" : "bg-[#07C160]/40"}`} onClick={send}>
					发送
				</button>
			</div>
		</div>
	);
};

const MemoTab = () => {
	const [memos, setMemos] = useState<Memo[]>([]);
	const [editing, setEditing] = useState<{ id: number | null; text: string } | null>(null);
	const load = useCallback(() => api<{ memos: Memo[] }>("/api/real/memos").then((d) => setMemos(d.memos)).catch(() => {}), []);
	useEffect(() => {
		void load();
	}, [load]);
	const save = async () => {
		if (!editing) return;
		if (editing.id === null) {
			if (editing.text.trim()) await api("/api/real/memos", { body: { text: editing.text } });
		} else await api(`/api/real/memos/${editing.id}`, { method: "PUT", body: { text: editing.text } });
		setEditing(null);
		await load();
	};
	if (editing)
		return (
			<div className="flex min-h-screen flex-col bg-white">
				<div className="flex h-[48px] items-center px-3">
					<button type="button" className="w-[60px] text-left text-[16px]" onClick={() => setEditing(null)}>
						取消
					</button>
					<div className="flex-1 text-center font-medium text-[17px]">备忘录</div>
					<button type="button" className="w-[60px] text-right text-[16px] text-[#07C160]" onClick={save}>
						保存
					</button>
				</div>
				<textarea autoFocus className="min-h-0 flex-1 resize-none px-4 py-2 text-[16px] outline-none" value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} placeholder="写点什么…" />
				{editing.id !== null && (
					<button
						type="button"
						className="h-12 text-[16px] text-[#FA5151]"
						onClick={async () => {
							if (!window.confirm("删除这条备忘录？")) return;
							await api(`/api/real/memos/${editing.id}`, { method: "DELETE" });
							setEditing(null);
							await load();
						}}
					>
						删除
					</button>
				)}
			</div>
		);
	return (
		<div className="min-h-screen bg-[#EDEDED]">
			<div className="flex h-[48px] items-center px-4">
				<div className="flex-1 font-medium text-[17px]">备忘录</div>
				<button type="button" className="text-[28px] text-[#07C160] leading-none" onClick={() => setEditing({ id: null, text: "" })}>
					＋
				</button>
			</div>
			{memos.length === 0 && <div className="mt-20 text-center text-[14px] text-black/35">还没有备忘录，点右上角 ＋ 新建</div>}
			{memos.map((m) => (
				<button key={m.id} type="button" className="mx-4 mb-2 block w-[calc(100%-32px)] rounded-[8px] bg-white p-3 text-left" onClick={() => setEditing({ id: m.id, text: m.text })}>
					<div className="line-clamp-3 whitespace-pre-wrap break-words text-[15px]">{m.text || "（空）"}</div>
					<div className="mt-1 text-[12px] text-black/35">{fmt(m.updatedAt)}</div>
				</button>
			))}
		</div>
	);
};

const MeTab = ({ standalone }: { standalone: boolean }) => {
	const s = readSession();
	const [msg, setMsg] = useState("");
	return (
		<div className="min-h-screen bg-[#EDEDED] px-4 pt-6">
			<div className="flex items-center gap-3 rounded-[8px] bg-white p-4">
				<Avatar name={s?.user.name || s?.user.phone || "?"} />
				<div>
					<div className="text-[17px]">{s?.user.name || s?.user.phone}</div>
					<div className="text-[13px] text-black/40">{s?.user.phone}</div>
				</div>
			</div>
			<button
				type="button"
				className="mt-3 h-12 w-full rounded-[8px] bg-white text-[16px]"
				onClick={async () => {
					const oldPassword = window.prompt("原密码");
					if (!oldPassword) return;
					const newPassword = window.prompt("新密码（至少 6 位）");
					if (!newPassword) return;
					try {
						const { token } = await api<{ token: string }>("/api/change-password", { body: { oldPassword, newPassword } });
						const cur = readSession();
						if (cur) window.localStorage.setItem("auth-session", JSON.stringify({ ...cur, token }));
						setMsg("密码已修改");
					} catch (e) {
						setMsg(e instanceof Error ? e.message : "修改失败");
					}
				}}
			>
				修改密码
			</button>
			{msg && <div className="mt-2 text-center text-[13px] text-black/50">{msg}</div>}
			{standalone && (
				<button type="button" className="mt-3 h-12 w-full rounded-[8px] bg-white text-[16px] text-[#FA5151]" onClick={logout}>
					退出登录
				</button>
			)}
		</div>
	);
};

/** 真实聊天：真实好友、实时文字聊天（记录存服务器、不可修改）、备忘录 */
const RealApp = ({ standalone = false }: { standalone?: boolean }) => {
	const me = readSession()?.user.id ?? 0;
	const [tab, setTab] = useState<"chat" | "memo" | "me">(standalone ? "chat" : "memo");
	const [friends, setFriends] = useState<Friend[]>([]);
	const [open, setOpen] = useState<Friend | null>(null);
	const [incoming, setIncoming] = useState<Msg | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout>>();

	const refresh = useCallback(() => {
		clearTimeout(timer.current);
		timer.current = setTimeout(() => {
			api<{ friends: Friend[] }>("/api/real/friends").then((d) => setFriends(d.friends)).catch(() => {});
		}, 150);
	}, []);
	useEffect(() => {
		refresh();
	}, [refresh]);
	useRealSocket(
		(m) => {
			setIncoming(m);
			refresh();
		},
		refresh,
	);

	if (open)
		return (
			<ChatView
				me={me}
				peer={open}
				incoming={incoming}
				onBack={() => {
					setOpen(null);
					refresh();
				}}
				onChanged={refresh}
			/>
		);

	const total = friends.reduce((n, f) => n + f.unread, 0);
	const TabBtn = ({ id, children, badge }: { id: typeof tab; children: ReactNode; badge?: number }) => (
		<button type="button" className={`relative flex-1 py-3 text-[14px] ${tab === id ? "text-[#07C160]" : "text-black/50"}`} onClick={() => setTab(id)}>
			{children}
			{!!badge && <span className="absolute top-1 right-[28%] min-w-[16px] rounded-full bg-[#FA5151] px-1 text-[11px] text-white leading-4">{badge}</span>}
		</button>
	);
	return (
		<div className="flex min-h-screen flex-col bg-[#EDEDED]">
			<div className="min-h-0 flex-1 overflow-auto">
				{tab === "chat" && (
					<div>
						<div className="flex h-[48px] items-center px-4">
							{!standalone && (
								<button type="button" className="mr-3 text-[16px]" onClick={() => window.history.back()}>
									‹
								</button>
							)}
							<div className="font-medium text-[17px]">真实聊天</div>
						</div>
						{friends.length === 0 && <div className="mt-20 text-center text-[14px] text-black/35">还没有好友</div>}
						<div className="bg-white">
							{friends.map((f) => (
								<button key={f.id} type="button" className="flex w-full items-center gap-3 border-black/5 border-b px-4 py-3 text-left" onClick={() => setOpen(f)}>
									<div className="relative">
										<Avatar name={f.name} />
										{f.unread > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] rounded-full bg-[#FA5151] px-1 text-center text-[11px] text-white leading-[18px]">{f.unread}</span>}
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex items-center justify-between">
											<div className="truncate text-[17px]">{f.name}</div>
											{f.last && <div className="ml-2 shrink-0 text-[12px] text-black/35">{fmt(f.last.ts)}</div>}
										</div>
										<div className="truncate text-[14px] text-black/45">{f.last?.text ?? "还没有消息"}</div>
									</div>
								</button>
							))}
						</div>
					</div>
				)}
				{tab === "memo" && <MemoTab />}
				{tab === "me" && <MeTab standalone={standalone} />}
			</div>
			<div className="flex shrink-0 border-black/10 border-t bg-[#F7F7F7]">
				<TabBtn id="chat" badge={total}>
					聊天
				</TabBtn>
				<TabBtn id="memo">备忘录</TabBtn>
				<TabBtn id="me">我</TabBtn>
			</div>
		</div>
	);
};

export default RealApp;
