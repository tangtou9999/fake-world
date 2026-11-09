import SearchOutlinedSVG from "@/assets/search-outlined.svg?react";
import { useTranslation } from "react-i18next";
import { twMerge } from "tailwind-merge";

/** WeChat search field (iOS 8.0.x): 35pt tall, 15pt side margin, 16pt placeholder, 6pt radius. */
const SearchBar = ({ className, onClick }: { className?: string; onClick?: () => void }) => {
	const { t } = useTranslation();
	return (
		<div className={twMerge("bg-[#EDEDED] px-[15px] pt-[7px] pb-2", className)} onClick={onClick}>
			<div className="flex h-[35px] items-center justify-center rounded-md bg-white text-[16px] text-black/35">
				<SearchOutlinedSVG width={24} height={24} fill="rgba(0,0,0,0.35)" />
				<span className="ml-1">{t("wechatPage.main.search")}</span>
			</div>
		</div>
	);
};

export default SearchBar;
