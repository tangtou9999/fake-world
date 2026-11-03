import { myProfileAtom } from "@/stateV2/profile";
import { useSetAtom } from "jotai";
import { useEffect } from "react";

export const DEFAULT_RINGTONE = "晴天";
export const DEFAULT_PHONE = "13612345666";

export function genderLabel(gender?: "male" | "female") {
	if (gender === "male") return "男";
	if (gender === "female") return "女";
	return "";
}

/** 11 位手机号显示为 136******66。 */
export function maskPhone(raw: string) {
	const digits = raw.replace(/\s/g, "");
	if (digits.length <= 5) return digits;
	return `${digits.slice(0, 3)}******${digits.slice(-2)}`;
}

export function useFillMeProfileDefaults() {
	const setMe = useSetAtom(myProfileAtom);
	useEffect(() => {
		setMe((prev) => {
			if (!prev) return prev;
			const ringtone = prev.ringtone ?? DEFAULT_RINGTONE;
			const phone = prev.phone ?? [DEFAULT_PHONE];
			const area = !prev.area || prev.area === "Hyrule" ? "江苏 常州" : prev.area;
			if (ringtone === prev.ringtone && phone === prev.phone && area === prev.area) return prev;
			return { ...prev, ringtone, phone, area };
		});
	}, [setMe]);
}
