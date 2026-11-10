import { AUTH_ENABLED, authAtom, changePassword, logout } from "@/auth";
import BackFilledSVG from "@/assets/back-filled.svg?react";
import { mobilePanelAtom } from "@/components/MobilePanel/atom";
import useMode from "@/components/useMode";
import useModeNavigate from "@/components/useModeNavigate";
import useScreenTopBg from "@/components/useScreenTopBg";
import { bankCardsAtom } from "@/stateV2/bankCards";
import { geminiConfigAtom } from "@/stateV2/gemini";
import { myProfileAtom } from "@/stateV2/profile";
import List from "@/wechatComponents/List";
import { message } from "antd";
import { exportBackup, importBackup } from "./Backup";
import { useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import BankLogo from "../../wallet/BankLogo";
import { genderLabel, maskPhone, useFillMeProfileDefaults } from "../profileText";

const Settings = () => {
	const restoreRef = useRef<HTMLInputElement>(null);
	const navigate = useModeNavigate();
	const cards = useAtomValue(bankCardsAtom);
	const profile = useAtomValue(myProfileAtom);
	const gemini = useAtomValue(geminiConfigAtom);
	const me = useAtomValue(authAtom).me;
	const setMobilePanel = useSetAtom(mobilePanelAtom);
	const { setMode } = useMode();
	useScreenTopBg("#EDEDED");
	useFillMeProfileDefaults();
	const phone = profile?.phone?.[0];
	const grey = "max-w-[140px] truncate text-[15px] text-black/40";

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-[#EDEDED]">
			<div className="grid h-11 shrink-0 grid-cols-3 items-center px-4">
				<BackFilledSVG
					fill="black"
					className="-ml-0.5 h-6 w-6 cursor-pointer"
					onClick={() => navigate("/wechat/my")}
				/>
				<div className="text-center font-medium text-[17px]">设置</div>
			</div>
			<div className="min-h-0 flex-1 overflow-auto pb-8">
				<div className="px-4 pt-3 pb-1 text-[13px] text-black/40">个人资料</div>
				<List>
					<List.Item
						withJump
						onClick={() => navigate("/wechat/my/settings/profile/gender")}
						extra={<span className={grey}>{genderLabel(profile?.gender)}</span>}
					>
						性别
					</List.Item>
					<List.Item
						withJump
						onClick={() => navigate("/wechat/my/settings/profile/area")}
						extra={<span className={grey}>{profile?.area}</span>}
					>
						地区
					</List.Item>
					<List.Item
						withJump
						onClick={() => navigate("/wechat/my/settings/profile/phone")}
						extra={<span className={grey}>{phone ? maskPhone(phone) : ""}</span>}
					>
						手机号
					</List.Item>
					<List.Item
						withJump
						onClick={() => navigate("/wechat/my/settings/profile/signature")}
						extra={<span className={grey}>{profile?.signature}</span>}
					>
						签名
					</List.Item>
					<List.Item
						withJump
						onClick={() => navigate("/wechat/my/settings/profile/ringtone")}
						extra={<span className={grey}>{profile?.ringtone}</span>}
					>
						来电铃声
					</List.Item>
					<List.Item
						withJump
						onClick={() => navigate("/wechat/my/settings/profile/qr")}
						extra={<span className={grey}>{profile?.qrCodeImage ? "已上传" : "未上传"}</span>}
					>
						我的二维码
					</List.Item>
				</List>
				<div className="px-4 pt-3 pb-1 text-[13px] text-black/40">提现银行卡</div>
				<List>
					{cards.map((card) => (
						<List.Item
							key={card.id}
							withJump
							icon={<BankLogo name={card.bankName} size={22} />}
							onClick={() => navigate(`/wechat/my/settings/card/${card.id}`)}
							extra={<span className="text-[15px] text-black/40">{card.last4}</span>}
						>
							{card.bankName}
						</List.Item>
					))}
					<List.Item withJump onClick={() => navigate("/wechat/my/settings/card/new")}>
						添加银行卡
					</List.Item>
				</List>
				<div className="px-4 py-2 text-[12px] text-black/30">仅在本机展示，不会连接银行</div>
				<div className="px-4 pt-3 pb-1 text-[13px] text-black/40">AI</div>
				<List>
					<List.Item
						withJump
						onClick={() => navigate("/wechat/my/settings/ai")}
						extra={<span className={grey}>{(gemini.apiKey || gemini.apiKey2) ? "已配置" : "未配置"}</span>}
					>
						AI 助手
					</List.Item>
				</List>
				{AUTH_ENABLED && me && (
					<>
						<div className="px-4 pt-3 pb-1 text-[13px] text-black/40">账号（{me.name || me.phone}）</div>
						<List>
							{me.role === "admin" && (
								<List.Item withJump onClick={() => navigate("/admin")}>
									总后台（开通子账号 / 权限）
								</List.Item>
							)}
							<List.Item
								withJump
								onClick={async () => {
									const o = window.prompt("原密码");
									if (!o) return;
									const n = window.prompt("新密码（6 位以上）");
									if (!n) return;
									try {
										await changePassword(o, n);
										message.success("密码已修改");
									} catch (e) {
										message.error(e instanceof Error ? e.message : "修改失败");
									}
								}}
							>
								修改密码
							</List.Item>
							<List.Item
								withJump
								onClick={() => {
									if (window.confirm("退出登录？本机的剧情数据不会删除。")) logout();
								}}
							>
								退出登录
							</List.Item>
						</List>
					</>
				)}
				<div className="px-4 pt-3 pb-1 text-[13px] text-black/40">数据</div>
				<List>
					<List.Item
						withJump
						onClick={() => {
							try {
								const n = exportBackup();
								message.success(`已导出 ${n} 项数据（不含 AI 密钥和图片视频）`);
							} catch (e) {
								message.error(`导出失败：${(e as Error).message}`);
							}
						}}
					>
						备份数据（导出文件）
					</List.Item>
					<List.Item withJump onClick={() => restoreRef.current?.click()}>
						从备份文件恢复
					</List.Item>
				</List>
				<input
					ref={restoreRef}
					type="file"
					accept="application/json,.json"
					className="hidden"
					onChange={async (e) => {
						const f = e.target.files?.[0];
						e.target.value = "";
						if (!f) return;
						if (!window.confirm("恢复会覆盖这台手机上同名的数据，确定继续？")) return;
						try {
							const n = await importBackup(f);
							message.success(`已恢复 ${n} 项，正在刷新`);
							window.setTimeout(() => window.location.reload(), 800);
						} catch (err) {
							message.error(`恢复失败：${(err as Error).message}`);
						}
					}}
				/>
				<List className="mt-2">
					<List.Item
						withJump
						onClick={() => {
							navigate("/wechat/my");
							setMobilePanel(null);
							setMode("edit");
							message.info("已进入编辑模式：点页面上任意内容就能修改", 2.5);
						}}
					>
						进入编辑模式
					</List.Item>
				</List>
			</div>
		</div>
	);
};

export default Settings;
