import AddFriendSVG from "@/assets/add-friend-outlined.svg?react";
import { EBottomNavBars } from "@/stateV2/bottomNavbars";
import useModeNavigate from "@/components/useModeNavigate";
import BottomNavbar, { useToggleNavbarActivated } from "@/wechatComponents/BottomNavbar";
import Loading from "@/wechatComponents/Loading";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import MainSection from "./MainSection";

const Contacts = () => {
	useToggleNavbarActivated(EBottomNavBars.ADDRESS_BOOK);
	const { t } = useTranslation();
	const navigate = useModeNavigate();

	return (
		<>
			<div className="grid h-11 shrink-0 grid-cols-3 items-center justify-center bg-[#EDEDED] px-4">
				<div />
				<div className="flex items-center justify-center font-medium text-[17px] text-black/90">
					{t("wechatPage.contacts.title")}
				</div>
				<div
					className="flex items-center justify-end"
					onClick={() => navigate("/wechat/add-friend")}
				>
					<AddFriendSVG height={24} width={24} fill="black" className="cursor-pointer" />
				</div>
			</div>
			<Suspense
				fallback={
					<div className="flex flex-1 items-center justify-center">
						<Loading className="h-8 w-8 text-wechatBrand-2" />
					</div>
				}
			>
				<MainSection />
			</Suspense>
			<BottomNavbar />
		</>
	);
};

export default Contacts;
