import App from "@/App";
import Contacts from "@/pages/wechat/contacts";
import Conversation from "@/pages/wechat/conversation";
import Discover from "@/pages/wechat/discover";
import AddFriend from "@/pages/wechat/addFriend/AddFriend";
import RequestDetail from "@/pages/wechat/addFriend/RequestDetail";
import NewFriends from "@/pages/wechat/addFriend/NewFriends";
import ChatSearch from "@/pages/wechat/search";
import ChatAi from "@/pages/wechat/conversation/ChatAi";
import GroupInfo from "@/pages/wechat/group/GroupInfo";
import GroupList from "@/pages/wechat/group/GroupList";
import NewGroup from "@/pages/wechat/group/NewGroup";
import AiChat from "@/pages/wechat/my/settings/AiChat";
import AiIntro from "@/pages/wechat/my/settings/AiIntro";
import AiSettings from "@/pages/wechat/my/settings/AiSettings";
import PayBill from "@/pages/wechat/pay/PayBill";
import PayService from "@/pages/wechat/pay/PayService";
import ScanPay from "@/pages/wechat/pay/ScanPay";
import Friend from "@/pages/wechat/friend";
import WechatIndex from "@/pages/wechat/index";
import MomentsIndex from "@/pages/wechat/moments";
import MomentDetail from "@/pages/wechat/moments/Detail";
import MomentsLayout from "@/pages/wechat/moments/Layout";
import PersonalMoments from "@/pages/wechat/moments/Personal";
import My from "@/pages/wechat/my";
import ProfileEdit from "@/pages/wechat/my/profile-edit";
import MyQrCode from "@/pages/wechat/my/profile-edit/QrCode";
import Settings from "@/pages/wechat/my/settings";
import BankCardForm from "@/pages/wechat/my/settings/BankCardForm";
import ProfileField from "@/pages/wechat/my/settings/ProfileField";
import Service from "@/pages/wechat/service";
import DetailAdapter from "@/pages/wechat/transaction";
import Wallet from "@/pages/wechat/wallet";
import Balance from "@/pages/wechat/wallet/Balance";
import BalanceRecords from "@/pages/wechat/wallet/BalanceRecords";
import { RedPacketSend, TransferSend } from "@/pages/wechat/conversation/MoneyPages";
import Withdraw from "@/pages/wechat/wallet/Withdraw";
import WithdrawResult from "@/pages/wechat/wallet/WithdrawResult";
import { BUILT_IN_TRANSACTION_TYPES_LABELS } from "@/stateV2/transaction";
import type { TFunction } from "i18next";
import { Navigate, type RouteObject, type UIMatch } from "react-router-dom";

export interface ICommonRouteHandle {
	label?: string | ((params: UIMatch["params"], t: TFunction) => string);
}

export const routes: RouteObject[] = [
	{
		path: "/",
		element: <App />,
		children: [
			{
				index: true,
				element: <Navigate replace to="/wechat" />,
			},
			{
				path: "wechat",
				handle: {
					label: "app.wechat",
				},
				children: [
					{
						index: true,
						element: <WechatIndex />,
						handle: {
							label: "routerLabel.wechat.index",
						},
					},
					{
						path: "conversation/:id",
						element: <Conversation />,
						handle: {
							label: "routerLabel.wechat.cHistory",
						},
					},
					{ path: "conversation/:id/ai", element: <ChatAi /> },
					{ path: "conversation/:id/info", element: <GroupInfo /> },
					{ path: "group/new", element: <NewGroup /> },
					{ path: "search", element: <ChatSearch /> },
					{ path: "add-friend", element: <AddFriend /> },
					{ path: "new-friends", element: <NewFriends /> },
					{ path: "new-friends/:id", element: <RequestDetail /> },
					{ path: "scan-pay", element: <ScanPay /> },
					{ path: "pay-service", element: <PayService /> },
					{ path: "pay-service/bill/:id", element: <PayBill /> },
					{
						path: "conversation/:id/red-packet",
						element: <RedPacketSend />,
					},
					{
						path: "conversation/:id/transfer",
						element: <TransferSend />,
					},
					{
						path: "my",
						handle: {
							label: "routerLabel.wechat.my",
						},
						children: [
							{
								index: true,
								element: <My />,
							},
							{
								path: "profile-edit",
								element: <ProfileEdit />,
								handle: {
									label: "routerLabel.wechat.profileEdit",
								},
							},
							{
								path: "qrcode",
								element: <MyQrCode />,
								handle: {
									label: "routerLabel.wechat.myQr",
								},
							},
							{
								path: "settings",
								element: <Settings />,
								handle: {
									label: "routerLabel.wechat.settings",
								},
							},
							{
								path: "settings/ai",
								element: <AiIntro />,
								handle: {
									label: "routerLabel.wechat.settings",
								},
							},
							{
								path: "settings/ai/chat",
								element: <AiChat />,
								handle: {
									label: "routerLabel.wechat.settings",
								},
							},
							{
								path: "settings/ai/key",
								element: <AiSettings />,
								handle: {
									label: "routerLabel.wechat.settings",
								},
							},
							{
								path: "settings/card/:id",
								element: <BankCardForm />,
								handle: {
									label: "routerLabel.wechat.bankCard",
								},
							},
							{
								path: "settings/profile/:field",
								element: <ProfileField />,
								handle: {
									label: "routerLabel.wechat.profileEdit",
								},
							},
						],
					},
					{
						path: "service",
						handle: {
							label: "routerLabel.wechat.services",
						},
						element: <Service />,
					},
					{
						path: "wallet",
						handle: {
							label: "routerLabel.wechat.wallet",
						},
						children: [
							{
								index: true,
								element: <Wallet />,
							},
							{
								path: "balance",
								element: <Balance />,
								handle: {
									label: "routerLabel.wechat.balance",
								},
							},
							{
								path: "balance/records",
								element: <BalanceRecords />,
								handle: {
									label: "routerLabel.wechat.balanceRecords",
								},
							},
							{
								path: "balance/withdraw",
								element: <Withdraw />,
								handle: {
									label: "routerLabel.wechat.withdraw",
								},
							},
							{
								path: "balance/withdraw/result/:id",
								element: <WithdrawResult />,
								handle: {
									label: "routerLabel.wechat.withdrawResult",
								},
							},
						],
					},
					{
						path: "discover",
						handle: {
							label: "routerLabel.wechat.discover",
						},
						children: [
							{
								index: true,
								element: <Discover />,
							},
						],
					},
					{
						path: "contacts",
						handle: {
							label: "routerLabel.wechat.contacts",
						},
						children: [
							{
								index: true,
								element: <Contacts />,
							},
							{
								path: "groups",
								element: <GroupList />,
							},
						],
					},
					{
						path: "moments",
						element: <MomentsLayout />,
						handle: {
							label: "routerLabel.wechat.moments",
						},
						children: [
							{
								index: true,
								element: <MomentsIndex />,
							},
							{
								path: "user/:id",
								element: <PersonalMoments />,
								handle: {
									label: "routerLabel.wechat.personalMoments",
								},
							},
						],
					},
					{
						path: "moments/:id",
						element: <MomentDetail />,
						handle: {
							label: "routerLabel.wechat.momentDetail",
						},
					},
					{
						path: "friend",
						handle: {
							label: "routerLabel.wechat.user",
						},
						children: [
							{
								path: ":id",
								element: <Friend />,
							},
						],
					},
					{
						path: "transaction",
						handle: {
							label: "routerLabel.wechat.transaction",
						},
						children: [
							{
								path: ":type",
								element: <DetailAdapter />,
								handle: {
									label: (p: UIMatch["params"], t: TFunction) =>
										t(
											BUILT_IN_TRANSACTION_TYPES_LABELS[
												p.type as keyof typeof BUILT_IN_TRANSACTION_TYPES_LABELS
											],
										),
								},
							},
						],
					},
				],
			},
		],
	},
];
