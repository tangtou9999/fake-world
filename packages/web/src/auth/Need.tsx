import type { ReactNode } from "react";
import { can, type PermKey, PERM_LABELS } from "./session";

/** 没有权限时显示提示页；有权限就正常显示 */
const Need = ({ perm, children }: { perm: PermKey; children: ReactNode }) =>
	can(perm) ? (
		<>{children}</>
	) : (
		<div className="flex h-full min-h-[60vh] flex-col items-center justify-center bg-[#EDEDED] px-8 text-center">
			<div className="text-[17px]">管理员还没有给你开通「{PERM_LABELS[perm]}」</div>
			<button type="button" className="mt-6 h-10 w-[120px] rounded-[6px] bg-white text-[15px]" onClick={() => window.history.back()}>
				返回
			</button>
		</div>
	);

export default Need;

/** 把组件包一层权限：没权限就什么都不渲染 */
export function withPerm<P extends object>(perm: PermKey, Comp: (props: P) => JSX.Element | null) {
	return (props: P) => (can(perm) ? <Comp {...props} /> : null);
}
