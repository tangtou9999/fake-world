import AiChatView from "@/pages/wechat/my/settings/AiChatView";
import { useParams } from "react-router-dom";

const ChatAi = () => {
	const { id } = useParams();
	return <AiChatView key={id} mode="chat" conversationId={id} />;
};

export default ChatAi;
