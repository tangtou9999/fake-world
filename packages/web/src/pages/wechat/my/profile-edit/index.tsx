import BackFilledSVG from "@/assets/back-filled.svg?react";
import QRCODE_OUTLINED_SVG from "@/assets/qrcode-outlined.svg?react";
import { h } from "@/components/HashAssets";
import { canBeDetected } from "@/components/NodeDetected";
import useModeNavigate from "@/components/useModeNavigate";
import useScreenTopBg from "@/components/useScreenTopBg";
import { EMetaDataType } from "@/stateV2/detectedNode";
import { myProfileAtom } from "@/stateV2/profile";
import List from "@/wechatComponents/List";
import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { genderLabel, maskPhone, useFillMeProfileDefaults } from "../profileText";

const valueClass = "ml-4 max-w-[58%] truncate text-right text-[16px] text-black/40";

function Row({
	label,
	value,
	extra,
	onClick,
	tall,
}: {
	label: string;
	value?: string;
	extra?: ReactNode;
	onClick?: () => void;
	tall?: boolean;
}) {
	return (
		<List.Item
			withJump
			onClick={onClick}
			rightClassName={tall ? "min-h-[72px] text-[17px]" : "min-h-[56px] text-[17px]"}
			extra={extra ?? (value ? <span className={valueClass}>{value}</span> : undefined)}
		>
			{label}
		</List.Item>
	);
}

const ProfileEdit = () => {
	const profile = useAtomValue(myProfileAtom)!;
	const navigate = useModeNavigate();
	useScreenTopBg("#EDEDED");
	useFillMeProfileDefaults();
	const phone = profile.phone?.[0];

	const edit = (field: string) => () => navigate(`/wechat/my/settings/profile/${field}`);

	return (
		<canBeDetected.div
			className="flex min-h-0 flex-1 flex-col bg-[#EDEDED]"
			metaData={{
				treeItemDisplayName: (data) => `个人资料（${data.nickname}）`,
				type: EMetaDataType.MyProfile,
			}}
		>
			<div className="grid h-11 shrink-0 grid-cols-3 items-center px-4">
				<BackFilledSVG
					fill="black"
					className="-ml-0.5 h-6 w-6 cursor-pointer"
					onClick={() => navigate("/wechat/my")}
				/>
				<div className="text-center font-medium text-[17px]">个人资料</div>
			</div>
			<div className="min-h-0 flex-1 overflow-auto pb-8">
				<List className="mt-2">
					<Row
						label="头像"
						tall
						extra={
							<h.img src={profile.avatarInfo} className="h-10 w-10 rounded-[4px] object-cover" />
						}
					/>
					<Row label="名字" value={profile.nickname} />
					<Row label="性别" value={genderLabel(profile.gender)} onClick={edit("gender")} />
					<Row label="地区" value={profile.area} onClick={edit("area")} />
					<Row label="手机号" value={phone ? maskPhone(phone) : ""} onClick={edit("phone")} />
					<Row label="微信号" value={profile.wechat} />
					<Row
						label="我的二维码"
						onClick={() => navigate("/wechat/my/qrcode")}
						extra={<QRCODE_OUTLINED_SVG fill="rgba(0,0,0,0.45)" className="h-5 w-5" />}
					/>
					<Row label="拍一拍" value={profile.tickleText} />
					<Row label="签名" value={profile.signature} onClick={edit("signature")} />
				</List>
				<List className="mt-2">
					<Row label="来电铃声" value={profile.ringtone} onClick={edit("ringtone")} />
				</List>
				<List className="mt-2">
					<Row label="我的地址" />
					<Row label="我的发票抬头" />
				</List>
				<List className="mt-2">
					<Row label="微信豆" value={profile.coin !== undefined ? String(profile.coin) : ""} />
				</List>
			</div>
		</canBeDetected.div>
	);
};

export default ProfileEdit;
