import { canBeDetected } from "@/components/NodeDetected";
import { inputterValueAtom } from "@/stateV2/conversation";
import { EMetaDataType } from "@/stateV2/detectedNode";
import Element from "@/wechatComponents/SlateText/Element";
import { SLATE_INITIAL_VALUE } from "@/wechatComponents/SlateText/utils";
import { useSetAtom } from "jotai";
import { memo, useEffect } from "react";
import { isMobileOnly } from "react-device-detect";
import { Editable, ReactEditor, Slate } from "slate-react";
import { useConversationAPI } from "../../context";
import { focusFix } from "./utils";

type Props = {
	dismissPanel?: () => void;
};

const Input = ({ dismissPanel }: Props) => {
	const {
		inputEditor: editor,
		sendTextMessage,
		scrollConversationListToBtm,
		mobileInputMode,
		previousMobileInputMode,
	} = useConversationAPI();
	const setInputValue = useSetAtom(inputterValueAtom);

	useEffect(() => {
		if (isMobileOnly && mobileInputMode === "text" && previousMobileInputMode === "none") {
			focusFix();
			ReactEditor.focus(editor);
		}
	}, [mobileInputMode]);

	return (
		<canBeDetected.div
			className="min-w-0 flex-1"
			metaData={{
				treeItemDisplayName: (data) => `发送消息（发送人：${data.sendRole}）`,
				type: EMetaDataType.ConversationInput,
			}}
		>
			<Slate
				editor={editor}
				initialValue={SLATE_INITIAL_VALUE}
				onChange={(v) => {
					setInputValue(v);
				}}
			>
				<Editable
					id="conversation-input"
					onFocus={() => {
						dismissPanel?.();
						if (isMobileOnly) {
							scrollConversationListToBtm();
						}
					}}
					className="min-h-[38px] rounded-[6px] bg-white px-3 py-2 text-[17px] leading-[22px] caret-wechatBrand-3 focus:outline-none"
					placeholder="可按住 转文字"
					renderPlaceholder={({ attributes, children }) => (
						<span
							{...attributes}
							style={{
								...attributes.style,
								top: 8,
								left: 0,
								width: "100%",
								textAlign: "center",
								color: "rgba(0,0,0,0.3)",
								opacity: 1,
							}}
						>
							{children}
						</span>
					)}
					renderElement={(props) => <Element {...props} />}
					onKeyDown={(ev) => {
						if (ev.key === "Enter") {
							ev.preventDefault();
							sendTextMessage();
						}
					}}
					// @ts-ignore
					enterKeyHint="send"
					inputMode={isMobileOnly ? mobileInputMode : "text"}
				/>
			</Slate>
		</canBeDetected.div>
	);
};

export default memo(Input);
