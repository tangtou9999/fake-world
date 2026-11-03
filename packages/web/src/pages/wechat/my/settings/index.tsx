import BackFilledSVG from "@/assets/back-filled.svg?react";
import { mobilePanelAtom } from "@/components/MobilePanel/atom";
import useMode from "@/components/useMode";
import useModeNavigate from "@/components/useModeNavigate";
import useScreenTopBg from "@/components/useScreenTopBg";
import { bankCardsAtom } from "@/stateV2/bankCards";
import List from "@/wechatComponents/List";
import { message } from "antd";
import { useAtomValue, useSetAtom } from "jotai";
import BankLogo from "../../wallet/BankLogo";

const Settings = () => {
	const navigate = useModeNavigate();
	const cards = useAtomValue(bankCardsAtom);
	const setMobilePanel = useSetAtom(mobilePanelAtom);
	const { setMode } = useMode();
	useScreenTopBg("#EDEDED");

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
			<div className="min-h-0 flex-1 overflow-auto">
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
