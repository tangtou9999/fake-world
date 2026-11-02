import SearchOutlinedSVG from "@/assets/search-outlined.svg?react";
import { useTranslation } from "react-i18next";
import { twMerge } from "tailwind-merge";

/** WeChat search field: 36pt, 16pt placeholder, 6pt radius, on the #EDEDED bar. */
const SearchBar = ({ className }: { className?: string }) => {
	const { t } = useTranslation();
	return (
		<div className={twMerge("bg-[#EDEDED] px-2 pb-2", className)}>
			<div className="flex h-9 items-center justify-center rounded-md bg-white text-[16px] text-black/30">
				<SearchOutlinedSVG width={16} height={16} fill="rgba(0,0,0,0.3)" />
				<span className="ml-1">{t("wechatPage.main.search")}</span>
			</div>
		</div>
	);
};

export default SearchBar;
