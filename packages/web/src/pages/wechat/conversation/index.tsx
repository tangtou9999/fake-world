import { setDialogueListValue } from "@/stateV2/dialogueList";
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import ConversationFooter from "./ConversationFooter";
import ConversationHeader from "./ConversationHeader";
import ConversationList from "./ConversationList";
import PersonaBar from "./PersonaBar";
import ReplayLayer from "./ReplayLayer";
import { ConversationAPIProvider } from "./context";

const Conversation = () => {
	const { id } = useParams<{ id: string }>();

	// 点进聊天窗口就算已读：返回首页时未读角标消失
	useEffect(() => {
		if (!id) return;
		setDialogueListValue((prev) =>
			prev.some((v) => v.friendId === id && (v.unreadMarkNumber || v.unreadDisplayType === "dot"))
				? prev.map((v) =>
						v.friendId === id ? { ...v, unreadMarkNumber: undefined, unreadDisplayType: "number" } : v,
					)
				: prev,
		);
	}, [id]);

	return (
		<ConversationAPIProvider>
			<ConversationHeader />
			<PersonaBar />
			<ConversationList />
			<ConversationFooter />
			<ReplayLayer />
		</ConversationAPIProvider>
	);
};

export default Conversation;
