import { h } from "@/components/HashAssets";
import useScreenTopBg from "@/components/useScreenTopBg";
import { acceptFriendRequest, addFriendByMe, friendRequestsAtom } from "@/stateV2/friendRequests";
import { prepareImageAsset } from "@/utils/media";
import { useSetAtom } from "jotai";
import { nanoid } from "nanoid";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Field, GreenButton, NavBar } from "./Shared";

const AddFriend = () => {
	const navigate = useNavigate();
	const setRequests = useSetAtom(friendRequestsAtom);
	const [mode, setMode] = useState<"me" | "them">("me");
	const [nickname, setNickname] = useState("");
	const [wechat, setWechat] = useState("");
	const [greeting, setGreeting] = useState("");
	const [reply, setReply] = useState("");
	const [avatar, setAvatar] = useState("");
	const [err, setErr] = useState("");
	const fileRef = useRef<HTMLInputElement>(null);
	useScreenTopBg("#EDEDED");

	const pickAvatar = async (file?: File) => {
		if (!file) return;
		try {
			const { imageInfo } = await prepareImageAsset(file);
			setAvatar(imageInfo);
			setErr("");
		} catch (e) {
			setErr(e instanceof Error ? e.message : "图片读取失败");
		}
	};

	const submit = () => {
		if (!nickname.trim()) return;
		const base = { nickname: nickname.trim(), wechat: wechat.trim(), avatarInfo: avatar };
		if (mode === "me") {
			const id = addFriendByMe({ ...base, greeting: greeting.trim(), firstReply: reply.trim() || undefined });
			navigate(`/wechat/conversation/${id}`, { replace: true });
		} else {
			setRequests((prev) => [
				{
					id: nanoid(6),
					direction: "in",
					status: "pending",
					...base,
					greeting: greeting.trim() || `我是${nickname.trim()}`,
					timestamp: Date.now(),
				},
				...prev,
			]);
			navigate("/wechat/new-friends", { replace: true });
		}
	};
	void acceptFriendRequest;

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-[#EDEDED]">
			<NavBar title="添加朋友" />
			<div className="min-h-0 flex-1 overflow-auto pb-10">
				<div className="mx-4 mt-3 flex rounded-[8px] bg-black/5 p-[3px] text-[15px]">
					{(
						[
							["me", "我添加别人"],
							["them", "别人添加我"],
						] as const
					).map(([k, label]) => (
						<button
							key={k}
							type="button"
							onClick={() => setMode(k)}
							className={`h-9 flex-1 rounded-[6px] ${mode === k ? "bg-white font-medium shadow-sm" : "text-black/60"}`}
						>
							{label}
						</button>
					))}
				</div>
				<div className="mt-3 border-black/10 border-t">
					<button
						type="button"
						onClick={() => fileRef.current?.click()}
						className="flex h-[76px] w-full items-center border-black/10 border-b bg-white px-4 text-left text-[16px]"
					>
						<span className="w-[88px] shrink-0">头像</span>
						<span className="flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-[6px] bg-[#E5E5E5] text-[12px] text-black/40">
							{avatar ? <h.img src={avatar} className="h-full w-full object-cover" /> : "上传"}
						</span>
					</button>
					<input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickAvatar(e.target.files?.[0])} />
					<Field label="昵称" value={nickname} onChange={setNickname} placeholder="对方昵称" />
					<Field label="微信号" value={wechat} onChange={setWechat} placeholder="可不填" />
					<Field
						label={mode === "me" ? "我的打招呼" : "对方打招呼"}
						value={greeting}
						onChange={setGreeting}
						placeholder={mode === "me" ? "我是…" : "我是…（对方发来的验证消息）"}
					/>
					{mode === "me" && <Field label="对方首句回复" value={reply} onChange={setReply} placeholder="可不填" />}
				</div>
				{err && <div className="px-4 pt-2 text-[13px] text-[#FA5151]">{err}</div>}
				<div className="px-5 pt-3 text-[13px] text-black/40 leading-5">
					{mode === "me"
						? "我添加别人：生成「我发出打招呼 → 对方已通过」的聊天，并出现在首页。"
						: "别人添加我：先出现在「通讯录 → 新的朋友」，点接受后生成聊天。"}
				</div>
				<GreenButton onClick={submit} disabled={!nickname.trim()}>
					{mode === "me" ? "添加并开始聊天" : "生成好友申请"}
				</GreenButton>
			</div>
		</div>
	);
};

export default AddFriend;
