import BackFilledSVG from "@/assets/back-filled.svg?react";
import { h } from "@/components/HashAssets";
import useModeNavigate from "@/components/useModeNavigate";
import useScreenTopBg from "@/components/useScreenTopBg";
import { hashAssetsDB } from "@/db";
import { myProfileAtom } from "@/stateV2/profile";
import { getFileMD5 } from "@/utils";
import { message } from "antd";
import { useAtom } from "jotai";
import { type ChangeEvent, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { genderLabel } from "../profileText";

const TITLES = {
	gender: "性别",
	area: "地区",
	phone: "手机号",
	signature: "签名",
	ringtone: "来电铃声",
	qr: "我的二维码",
} as const;

type Field = keyof typeof TITLES;

const ProfileField = () => {
	const { field } = useParams<{ field: string }>();
	const navigate = useModeNavigate();
	const [profile, setProfile] = useAtom(myProfileAtom);
	const key = field as Field;
	const known = key in TITLES;
	const [draft, setDraft] = useState(() => {
		if (!profile || !known || key === "gender" || key === "qr") return "";
		if (key === "phone") return profile.phone?.[0] ?? "";
		return profile[key] ?? "";
	});
	const fileRef = useRef<HTMLInputElement>(null);
	useScreenTopBg("#EDEDED");

	const saveText = () => {
		if (!profile) return;
		const value = draft.trim();
		if (key === "phone") {
			setProfile({ ...profile, phone: value ? [value.replace(/\s/g, "")] : [] });
		} else if (key === "area" || key === "signature" || key === "ringtone") {
			setProfile({ ...profile, [key]: value });
		}
		navigate(-1);
	};

	const chooseGender = (gender: "male" | "female") => {
		if (!profile) return;
		setProfile({ ...profile, gender });
		navigate(-1);
	};

	const upload = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.item(0);
		event.target.value = "";
		if (!file || !profile) return;
		if (!file.type.startsWith("image/")) {
			message.error("请选择图片");
			return;
		}
		if (file.size > 8 * 1024 * 1024) {
			message.error("图片不能超过 8MB");
			return;
		}
		const hash = await getFileMD5(file);
		await hashAssetsDB.images.put({ id: hash, file });
		setProfile({ ...profile, qrCodeImage: hash });
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-[#EDEDED]">
			<div className="grid h-11 shrink-0 grid-cols-3 items-center px-4">
				<BackFilledSVG
					fill="black"
					className="-ml-0.5 h-6 w-6 cursor-pointer"
					onClick={() => navigate(-1)}
				/>
				<div className="text-center font-medium text-[17px]">
					{known ? TITLES[key] : "个人资料"}
				</div>
			</div>
			{!known || !profile ? (
				<div className="pt-24 text-center text-[15px] text-black/40">没有这项资料</div>
			) : key === "gender" ? (
				<div className="mt-2 bg-white">
					{(["male", "female"] as const).map((gender) => (
						<button
							key={gender}
							type="button"
							className="flex h-14 w-full items-center justify-between px-4 text-[17px] text-black/90"
							onClick={() => chooseGender(gender)}
						>
							<span>{genderLabel(gender)}</span>
							{profile.gender === gender && <span className="text-[#07C160]">✓</span>}
						</button>
					))}
				</div>
			) : key === "qr" ? (
				<div className="px-4 pt-6">
					<div className="flex h-48 items-center justify-center rounded-[12px] bg-white">
						{profile.qrCodeImage ? (
							<h.img src={profile.qrCodeImage} className="h-40 w-40 object-contain" />
						) : (
							<div className="text-[15px] text-black/30">未上传，二维码页会显示生成的二维码</div>
						)}
					</div>
					<input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={upload} />
					<button
						type="button"
						className="mt-6 h-11 w-full rounded-[8px] bg-[#07C160] text-[17px] text-white"
						onClick={() => fileRef.current?.click()}
					>
						上传二维码图片
					</button>
					{profile.qrCodeImage ? (
						<button
							type="button"
							className="mt-4 w-full text-center text-[#FA5151] text-[16px]"
							onClick={() => setProfile({ ...profile, qrCodeImage: "" })}
						>
							恢复为生成的二维码
						</button>
					) : null}
				</div>
			) : (
				<div className="px-4 pt-4">
					<input
						value={draft}
						maxLength={key === "phone" ? 20 : 40}
						inputMode={key === "phone" ? "numeric" : "text"}
						onChange={(event) => setDraft(event.target.value)}
						placeholder={key === "phone" ? "如 13612345666" : ""}
						className="h-11 w-full rounded-[8px] bg-white px-3 text-[16px] text-black/90 outline-none"
					/>
					<button
						type="button"
						onClick={saveText}
						className="mt-6 h-11 w-full rounded-[8px] bg-[#07C160] text-[17px] text-white"
					>
						保存
					</button>
				</div>
			)}
		</div>
	);
};

export default ProfileField;
