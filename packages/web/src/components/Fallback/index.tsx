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
				location.reload();
			}}
		>
			<div>点击下方按钮重新加载应用（不会清除你的聊天数据）</div>
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
