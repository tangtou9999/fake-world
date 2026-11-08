import { CloseCircleFilled } from "@ant-design/icons";
import { Button, Modal } from "antd";
import type { FallbackProps } from "react-error-boundary";

const Fallback = (props: FallbackProps) => {
	console.log(props);
	return (
		<Modal
			open={true}
			title={
				<div className="flex space-x-2">
					<CloseCircleFilled className="text-2xl text-red-600" />
					<div>出错啦</div>
				</div>
			}
			maskClosable={false}
			keyboard={false}
			cancelButtonProps={{ hidden: true }}
			okText="重新加载"
			onOk={() => {
				// 只重新加载，不清除任何本地数据（聊天、钱包、AI 设置都在本机，清掉就找不回来了）
				location.reload();
			}}
		>
			<div>点击下方按钮重新加载，你的本地数据不会被清除。</div>
			<div className="mt-2">
				<Button
					type="link"
					danger
					className="px-0"
					onClick={() => {
						if (window.confirm("这会清空本机所有数据（聊天、钱包、AI 设置、密钥），无法恢复。确定吗？")) {
							localStorage.clear();
							location.reload();
						}
					}}
				>
					仍然不行？清空本地数据并重载
				</Button>
			</div>
			<div>
				如果一直出现该提示，请联系
				<Button type="link" href="mailto:liangniangbaby@gmail.com" target="_blank" className="px-0">
					开发者
				</Button>
			</div>
		</Modal>
	);
};

export default Fallback;
