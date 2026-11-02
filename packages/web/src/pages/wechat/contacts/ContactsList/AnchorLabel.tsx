import { otherS, starS } from "@/stateV2/profile";
import { isSymbol } from "lodash-es";
import { forwardRef, memo } from "react";
import { useTranslation } from "react-i18next";

type Props = {
	labelKey: string;
	labelTitle: string | symbol;
	isStuck: boolean;
	isBeforeStuck: boolean;
};

const AnchorLabel = forwardRef<HTMLDivElement, Props>(({ labelKey, labelTitle }, ref) => {
	const { t } = useTranslation();

	const renderTitle = () => {
		if (isSymbol(labelTitle)) {
			switch (labelTitle) {
				case starS:
					return <span>☆ {t("wechatPage.contacts.starred")}</span>;
				case otherS:
					return <span>#</span>;
				default:
					return null;
			}
		}
		return <span>{labelTitle}</span>;
	};

	return (
		<div
			id={labelKey}
			data-key={labelKey}
			ref={ref}
			className="sticky top-0 z-40 flex h-8 items-center bg-[#EDEDED] px-4 text-[14px] text-black/50"
		>
			{renderTitle()}
		</div>
	);
});

AnchorLabel.displayName = "AnchorLabel";

export default memo(AnchorLabel);
