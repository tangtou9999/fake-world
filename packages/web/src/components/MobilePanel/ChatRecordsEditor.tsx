import ConversationListMetaDataEditor from "@/components/MetaDataEditor/ConversationMetaDataEditor/List";
import { MYSELF_ID } from "@/faker/wechat/user";
import { allProfilesAtom } from "@/stateV2/profile";
import { Select } from "antd";
import { useAtomValue } from "jotai";
import { useState } from "react";

/**
 * Conversation editing used to live on the chat "+" button.
 * The list editor only needs the friend id, so it can live here even when that chat is not open.
 */
const ChatRecordsEditor = () => {
	const profiles = useAtomValue(allProfilesAtom);
	const [friendId, setFriendId] = useState<string>();
	const friends = profiles.filter((profile) => profile.id !== MYSELF_ID);

	return (
		<div id="chat-records-editor" className="mt-4 border-black/10 border-t pt-3">
			<div className="mb-1 font-medium">聊天记录</div>
			<p className="mb-2 text-gray-500 text-xs">
				选择联系人后新增文字、图片或视频，并用「我自己 /
				朋友」决定显示在哪一侧。图片和视频从本机选择，写入 IndexedDB（图片不超过 20MB，视频不超过
				300MB）。对话里的「+」只负责以「我」发送相册内容。
			</p>
			<Select
				className="mb-3 w-full"
				placeholder="选择对话"
				showSearch
				optionFilterProp="label"
				value={friendId}
				onChange={setFriendId}
				options={friends.map((profile) => ({
					label: profile.remark || profile.nickname,
					value: profile.id,
				}))}
			/>
			{friendId && <ConversationListMetaDataEditor index={friendId} data={null} />}
		</div>
	);
};

export default ChatRecordsEditor;
