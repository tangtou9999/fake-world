import { MYSELF_ID } from "@/faker/wechat/user";
import { feedAtom } from "@/stateV2/moments";
import { atom, useAtom, useSetAtom } from "jotai";
import { nanoid } from "nanoid";
import { type FormEvent, useEffect, useRef, useState } from "react";

export const commentTargetAtom = atom<string | null>(null);

type Props = {
	feedId: string;
	autoFocus?: boolean;
	onClose?: () => void;
};

const CommentComposer = ({ feedId, autoFocus, onClose }: Props) => {
	const setFeed = useSetAtom(feedAtom(feedId));
	const [text, setText] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (autoFocus) inputRef.current?.focus();
	}, [autoFocus, feedId]);

	const submit = (event?: FormEvent) => {
		event?.preventDefault();
		const value = text.trim();
		if (!value) return;
		setFeed((prev) => {
			if (!prev) return prev;
			return {
				...prev,
				comments: [
					...(prev.comments ?? []),
					{
						id: nanoid(8),
						fromUserId: MYSELF_ID,
						text: [{ type: "paragraph", children: [{ text: value }] }],
						sendTimestamp: Date.now(),
					},
				],
			};
		});
		setText("");
		onClose?.();
	};

	return (
		<form
			className="flex items-center gap-2 border-black/10 border-t bg-[#F7F7F7] px-3 py-2"
			onSubmit={submit}
		>
			<input
				ref={inputRef}
				value={text}
				onChange={(event) => setText(event.target.value)}
				placeholder="评论"
				className="h-9 min-w-0 flex-1 rounded-[6px] bg-white px-3 text-[16px] text-black/90 leading-[22px] outline-none placeholder:text-black/30"
			/>
			<button
				type="submit"
				disabled={!text.trim()}
				className="shrink-0 px-1 text-[16px] text-wechatBrand-1 leading-[22px] disabled:text-black/25"
			>
				发送
			</button>
		</form>
	);
};

export function MomentsCommentBar() {
	const [feedId, setFeedId] = useAtom(commentTargetAtom);
	if (!feedId) return null;
	return <CommentComposer feedId={feedId} autoFocus onClose={() => setFeedId(null)} />;
}

export default CommentComposer;
