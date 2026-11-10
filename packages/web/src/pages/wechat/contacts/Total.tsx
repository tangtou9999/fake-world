import { canBeDetected } from "@/components/NodeDetected";
import { EMetaDataType } from "@/stateV2/detectedNode";
import { friendsTotalCountAtom } from "@/stateV2/profile";
import { useAtomValue } from "jotai";
import { memo, useState } from "react";
import { TotalSheet } from "@/components/PhoneSheets";
import { useLongPress } from "@/components/SheetKit";
import { useTranslation } from "react-i18next";

const Total = () => {
	const count = useAtomValue(friendsTotalCountAtom);
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const lp = useLongPress(() => setOpen(true), "editChat");
	return (
		<canBeDetected.div
			metaData={{
				type: EMetaDataType.FriendsTotalCount,
				treeItemDisplayName: (data) =>
					`好友总数 ${data.calcuateType === "auto" ? count : data.count} 人`,
			}}
			className="flex items-center justify-center py-6 text-[14px] text-black/45"
			{...lp}
		>
			{open && <TotalSheet onClose={() => setOpen(false)} />}
			{t("wechatPage.contacts.total", {
				num: count,
			})}
		</canBeDetected.div>
	);
};

export default memo(Total);
