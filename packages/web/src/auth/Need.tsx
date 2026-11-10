import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { type Perm, useCan } from "./index";

/** 路由级权限：没开这项权限就显示提示页，不渲染里面的功能。 */
const Need = ({ perm, children }: { perm: Perm; children: ReactNode }) => {
	const ok = useCan(perm);
	const navigate = useNavigate();
	if (ok) return <>{children}</>;
	return (
		<div className="flex flex-1 flex-col items-center justify-center bg-white px-8 text-center">
			<div className="text-[17px]">当前账号没有这个功能的权限</div>
			<div className="mt-2 text-[14px] text-black/40">需要的话请联系管理员开通</div>
			<button type="button" className="mt-6 h-10 rounded-[6px] bg-[#F2F2F2] px-6 text-[15px]" onClick={() => navigate(-1)}>
				返回
			</button>
		</div>
	);
};

export default Need;
