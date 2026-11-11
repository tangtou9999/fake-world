import { logout, readSession } from "./session";

/** 真实子账号第一期的落地页（真实好友和聊天在第二期） */
const RealHome = () => {
	const s = readSession();
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-[#EDEDED] px-8 text-center">
			<div className="font-medium text-[20px]">你好，{s?.user.name || s?.user.phone}</div>
			<div className="mt-3 text-[14px] text-black/50">账号已开通。聊天功能即将开放，请稍后再来。</div>
			<button type="button" className="mt-8 h-11 w-[160px] rounded-[6px] bg-white text-[16px] text-[#FA5151]" onClick={logout}>
				退出登录
			</button>
		</div>
	);
};

export default RealHome;
