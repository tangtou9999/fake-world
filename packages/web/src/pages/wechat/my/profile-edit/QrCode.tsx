import BackFilledSVG from "@/assets/back-filled.svg?react";
import WECHAT_SVG from "@/assets/wechat.svg?react";
import { h } from "@/components/HashAssets";
import useModeNavigate from "@/components/useModeNavigate";
import useScreenTopBg from "@/components/useScreenTopBg";
import { myProfileAtom } from "@/stateV2/profile";
import { useAtomValue } from "jotai";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

const MyQrCode = () => {
	const profile = useAtomValue(myProfileAtom)!;
	const navigate = useModeNavigate();
	const [generated, setGenerated] = useState("");
	useScreenTopBg("#EDEDED");

	useEffect(() => {
		let cancelled = false;
		QRCode.toDataURL(profile.wechat || profile.nickname || "weixin", {
			errorCorrectionLevel: "H",
			margin: 1,
			width: 480,
			color: { dark: "#000000", light: "#ffffff" },
		}).then((url) => {
			if (!cancelled) setGenerated(url);
		});
		return () => {
			cancelled = true;
		};
	}, [profile.wechat, profile.nickname]);

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-[#EDEDED]">
			<div className="grid h-11 shrink-0 grid-cols-3 items-center px-4">
				<BackFilledSVG
					fill="black"
					className="-ml-0.5 h-6 w-6 cursor-pointer"
					onClick={() => navigate("/wechat/my/profile-edit")}
				/>
				<div className="text-center font-medium text-[17px]">我的二维码</div>
			</div>
			<div className="flex flex-1 flex-col items-center px-6 pt-8">
				<div className="w-full rounded-[12px] bg-white px-6 pt-6 pb-8">
					<div className="flex items-center">
						<h.img src={profile.avatarInfo} className="h-14 w-14 rounded-[6px] object-cover" />
						<div className="ml-3 min-w-0">
							<div className="truncate font-medium text-[18px] text-black/90">
								{profile.nickname}
							</div>
							{profile.area ? (
								<div className="mt-1 truncate text-[14px] text-black/40">{profile.area}</div>
							) : null}
						</div>
					</div>
					<div className="mt-6 flex justify-center">
						{profile.qrCodeImage ? (
							<h.img src={profile.qrCodeImage} className="h-[240px] w-[240px] object-contain" />
						) : (
							<div className="relative h-[240px] w-[240px]">
								{generated ? (
									<img src={generated} alt="" className="h-full w-full" />
								) : (
									<div className="h-full w-full bg-[#F7F7F7]" />
								)}
								<div className="absolute inset-0 flex items-center justify-center">
									<div className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-white">
										<WECHAT_SVG className="h-8 w-8" fill="#07C160" />
									</div>
								</div>
							</div>
						)}
					</div>
					<div className="mt-4 text-center text-[14px] text-black/40">微信号：{profile.wechat}</div>
				</div>
			</div>
		</div>
	);
};

export default MyQrCode;
