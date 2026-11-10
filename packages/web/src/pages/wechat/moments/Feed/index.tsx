import { canBeDetected } from "@/components/NodeDetected";
import TopOperations from "@/components/TopOperations";
import { inEditMode } from "@/components/SheetKit";
import useModeNavigate from "@/components/useModeNavigate";
import { MYSELF_ID } from "@/faker/wechat/user";
import { EMetaDataType } from "@/stateV2/detectedNode";
import { type IStateFeed, feedListAtom } from "@/stateV2/moments";
import { profileAtom } from "@/stateV2/profile";
import UserAvatar from "@/wechatComponents/User/UserAvatar";
import { CommentOutlined, SelectOutlined, UserOutlined } from "@ant-design/icons";
import { Modal, Tooltip } from "antd";
import { useAtomValue, useSetAtom } from "jotai";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { twJoin, twMerge } from "tailwind-merge";
import FeedSheet from "../FeedSheet";
import { commentTargetAtom } from "../CommentComposer";
import Comments from "./Comments";
import FeedContent from "./Content";
import LikeList from "./Likes";

type Props = {
	classNames?: Partial<{
		container: string;
		avatar: string;
		likeAndComments: string;
	}>;
	fromDetail?: boolean;
};

const Feed = ({
	id,
	userId,
	classNames,
	fromDetail,
}: Omit<IStateFeed, "sendTimestamp" | "content"> & Props) => {
	const { nickname, remark } = useAtomValue(profileAtom(userId))!;
	const setFeedList = useSetAtom(feedListAtom);
	const setCommentTarget = useSetAtom(commentTargetAtom);
	const [editing, setEditing] = useState(false);
	const pressTimer = useRef<ReturnType<typeof setTimeout>>();
	const startPress = () => {
		clearTimeout(pressTimer.current);
		pressTimer.current = setTimeout(() => inEditMode() && setEditing(true), 600);
	};
	const stopPress = () => clearTimeout(pressTimer.current);
	const originalNavigate = useNavigate();
	const navigate = useModeNavigate({ silence: true });

	const likeAndCommentsContent = useMemo(() => {
		return (
			<div
				className={twMerge(
					"mt-2 flex flex-col rounded-[4px] bg-[#F7F7F7]",
					classNames?.likeAndComments,
				)}
			>
				<LikeList id={id} fromDetail={fromDetail} />
				<Comments id={id} fromDetail={fromDetail} />
			</div>
		);
	}, []);

	const handleOperationDelete = () => {
		Modal.confirm({
			title: "是否删除该条朋友圈？",
			onOk: () => {
				setFeedList((v) => v.filter((v) => v.id !== id));
			},
		});
	};

	const toFriendPage = useCallback(() => {
		navigate(`/wechat/friend/${userId}`);
	}, [userId]);

	let operations = [
		{
			key: "delete",
			onClick: handleOperationDelete,
			element: <TopOperations.OperaionDeleteBase />,
		},
		{
			key: "new",
			onClick: TopOperations.OperationSelectParent.selectParentNode,
			element: <TopOperations.OperationNewBase tooltipProps={{ title: "新增朋友圈" }} />,
		},
		{
			onClick: () => {
				setCommentTarget(id);
			},
			element: (
				<Tooltip title="新增评论">
					<CommentOutlined />
				</Tooltip>
			),
		},
		{
			onClick: () => {
				originalNavigate(`/wechat/moments/user/${userId}`);
			},
			element: (
				<Tooltip title="进入到该用户的单独朋友圈页面">
					<UserOutlined />
				</Tooltip>
			),
		},
		{
			key: "detail",
			onClick: () => {
				originalNavigate(`/wechat/moments/${id}`);
			},
			element: (
				<Tooltip title="进入到单条朋友圈的详情页">
					<SelectOutlined />
				</Tooltip>
			),
		},
	];

	if (fromDetail) {
		operations = operations.filter((v) => !["new", "delete", "detail"].includes(v.key ?? ""));
	}

	return (
		<canBeDetected.div
			className={twMerge("flex flex-col border-black/5 border-b px-5 py-3", classNames?.container)}
			metaData={[
				{
					type: EMetaDataType.MomentsFeed,
					index: id,
					operations,
					label: "朋友圈",
				},
				userId === MYSELF_ID
					? {
							type: EMetaDataType.MyProfile,
							treeItemDisplayName: (data) => `${data.nickname}的朋友圈`,
							label: "用户信息",
						}
					: {
							type: EMetaDataType.FirendProfile,
							index: userId,
							treeItemDisplayName: (data) => `${data.nickname}的朋友圈`,
							label: "用户信息",
						},
			]}
			nodeTreeSort
			onTouchStart={startPress}
			onTouchEnd={stopPress}
			onTouchMove={stopPress}
			onTouchCancel={stopPress}
			onContextMenu={(e) => {
				if (!inEditMode()) return;
				e.preventDefault();
				setEditing(true);
			}}
		>
			{editing && (
				<div onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
					<FeedSheet feedId={id} onClose={() => setEditing(false)} />
				</div>
			)}
			<div className="flex">
				<UserAvatar
					id={userId}
					size="middle"
					className={twJoin("h-[42px] w-[42px] cursor-pointer rounded-[4px]", classNames?.avatar)}
					onClick={toFriendPage}
				/>
				<div className="ml-[10px] flex flex-1 flex-col overflow-hidden">
					<span
						className="cursor-pointer self-start font-medium text-[16px] text-wechatLink-3 leading-[22px]"
						onClick={toFriendPage}
					>
						{remark ?? nickname}
					</span>
					<FeedContent id={id} fromDetail={fromDetail} />
					{!fromDetail && likeAndCommentsContent}
				</div>
			</div>
			{fromDetail && likeAndCommentsContent}
		</canBeDetected.div>
	);
};

export default memo(Feed);
