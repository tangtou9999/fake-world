import useScreenTopBg from "@/components/useScreenTopBg";
import { geminiConfigAtom } from "@/stateV2/gemini";
import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { NavBar } from "../../addFriend/Shared";

const Card = ({ title, children }: { title: string; children: ReactNode }) => (
	<div className="mx-4 mt-3 rounded-[8px] bg-white p-4">
		<div className="mb-2 font-medium text-[16px]">{title}</div>
		<div className="text-[14px] text-black/70 leading-6">{children}</div>
	</div>
);

const Example = ({ scene, result }: { scene: string; result: string[] }) => (
	<div className="mt-2 rounded-[6px] bg-[#F5F5F5] p-3">
		<div className="text-[13px] text-black/50">你输入的场景：</div>
		<div className="mb-2 text-[14px] text-black/90">{scene}</div>
		<div className="text-[13px] text-black/50">AI 生成的聊天（示例）：</div>
		{result.map((line) => (
			<div key={line} className="text-[14px] text-black/80">
				{line}
			</div>
		))}
	</div>
);

const AiIntro = () => {
	const navigate = useNavigate();
	const { apiKey, model } = useAtomValue(geminiConfigAtom);
	useScreenTopBg("#EDEDED");

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-[#EDEDED]">
			<NavBar title="AI 助手" />
			<div className="min-h-0 flex-1 overflow-auto pb-10">
				<div className="mx-4 mt-3 flex items-center rounded-[8px] bg-white p-4">
					<div className="min-w-0 flex-1">
						<div className="font-medium text-[16px]">Gemini 密钥</div>
						<div className="mt-1 text-[13px] text-black/50">
							{apiKey ? `已配置 · 模型 ${model || "gemini-2.5-flash"}` : "未配置，先填密钥才能用 AI"}
						</div>
					</div>
					<button
						type="button"
						onClick={() => navigate("/wechat/my/settings/ai/key")}
						className="h-9 shrink-0 rounded-[6px] bg-[#07C160] px-4 text-[15px] text-white"
					>
						{apiKey ? "修改" : "填写密钥"}
					</button>
				</div>

				<Card title="现在能做什么">
					<b>AI 生成聊天记录</b>：选一个联系人，用一句话描述场景，AI 会参考对方的资料和你们最近的聊天，生成十几条一来一回的对话，放进「批量输入」，你改完再发送。
					<div className="mt-2">
						<b>截图复刻</b>：从相册一次选多张真实的聊天截图，AI 会识别左右气泡、时间、红包、转账，原样生成到当前聊天里（1:1 复刻）。
					</div>
					<div className="mt-1 text-black/40">别的功能（朋友圈文案、好友申请留言等）还没有接入，之后再加。</div>
				</Card>

				<Card title="怎么用（4 步）">
					1. 先点上面「填写密钥」，粘贴你的 Gemini Key，点「检测连接」确认成功。
					<br />
					2. 回到微信，<b>快速点屏幕 3 下</b>进入编辑模式。
					<br />
					3. 打开任意一个聊天，底部有一行「发送人 / AI 生成 / 批量输入」，点<b>AI 生成</b>。
					<br />
					4. 写场景、选条数，点「生成」。结果会出现在批量输入框里，可以直接改字、删行，最后点「发送全部」。
				</Card>

				<Card title="案例 1：同事催报告">
					<Example
						scene="同事催我交周报，我在拖延，语气半开玩笑"
						result={["对方：周报呢？今天截止哦", "我：马上马上，再给我十分钟", "对方：你上次也是这么说的😂", "我：这次是真的，在写结尾了"]}
					/>
				</Card>
				<Card title="案例 2：老妈关心吃饭">
					<Example
						scene="老妈问我吃饭了没有，还叫我天冷多穿衣服，我嫌她啰嗦但还是答应"
						result={["对方：吃饭了没？", "我：吃了吃了", "对方：天冷了，多穿点，别感冒", "我：知道啦，你也早点休息"]}
					/>
				</Card>
				<Card title="案例 3：谈生意">
					<Example
						scene="客户问我报价能不能再便宜一点，我坚持不降价但可以送配件"
						result={["对方：这个价格能再优惠点吗？", "我：已经是最低价了，不过可以送您一套配件", "对方：配件包括什么？"]}
					/>
				</Card>

				<Card title="案例 4：截图复刻（1:1 还原一段真实聊天）">
					1. 进入编辑模式，打开想要复刻的联系人的聊天。
					<br />
					2. 点底部「AI 生成」→ 切到「截图复刻」。
					<br />
					3. 从相册选这段聊天的多张截图，<b>按时间从早到晚</b>选（最多 12 张）。
					<br />
					4. 选「追加到末尾」或「清空后替换」，点「识别并复刻」。
					<Example
						scene="选了 3 张和客户的聊天截图"
						result={["（时间）14:02", "对方：你好，报价发我一下", "我：[微信红包] 恭喜发财", "（系统）对方领取了你的红包", "……按截图顺序全部还原"]}
					/>
					<div className="mt-2 text-black/40">注意：截图里的图片、表情、视频没法还原，会变成「[图片]」这样的文字；头像用当前联系人的头像。截图越清晰、越完整，还原越准。</div>
				</Card>

				<Card title="小提示">
					· 场景写得越具体，生成越像。可以写语气、谁先说话、想聊到什么结果。
					<br />· 条数建议 8~15 条，太多容易跑偏。
					<br />· 提示「服务器繁忙」时会自动换备用模型重试，不用手动处理。
					<br />· 密钥只存在这台手机的浏览器里，不会上传。
				</Card>
			</div>
		</div>
	);
};

export default AiIntro;
