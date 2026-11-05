import { canBeDetected } from "@/components/NodeDetected";
import useMode from "@/components/useMode";
import { EMetaDataType, allNodesTreeAtom } from "@/stateV2/detectedNode";
import { dialogueListAtom, dialogueListEffect } from "@/stateV2/dialogueList";
import { useAtom, useSetAtom } from "jotai";
import { useEffect, useMemo } from "react";
import { ReactSortable } from "react-sortablejs";
import DialogueItem from "./DialogueItem";

const DialogueList = () => {
	const { isEdit } = useMode();
	const [dialogueList, setDialogueList] = useAtom(dialogueListAtom);
	const rebuildTree = useSetAtom(allNodesTreeAtom);
	useAtom(dialogueListEffect);

	// 置顶的对话永远排在最前面（新对话、手动设置置顶后都会自动归位），背景条也就不会残留在中间
	useEffect(() => {
		const pinned = dialogueList.filter((v) => v.isPinned);
		if (pinned.length === 0) return;
		const sorted = [...pinned, ...dialogueList.filter((v) => !v.isPinned)];
		if (sorted.some((v, i) => v !== dialogueList[i])) setDialogueList(sorted);
	}, [dialogueList, setDialogueList]);

	const mappedSortableListData = useMemo(() => {
		return dialogueList.map((item) => ({
			id: item.id,
		}));
	}, [dialogueList]);

	return (
		<canBeDetected.section
			metaData={{
				type: EMetaDataType.DialogueList,
				treeItemDisplayName: "对话列表",
				label: "从好友列表快速新建对话项",
			}}
			className="flex-1"
		>
			<ReactSortable
				disabled={!isEdit}
				list={mappedSortableListData}
				animation={400}
				setList={(v, sortable) => {
					if (isEdit && sortable) {
						const needUpdate = v.some((_, i) => v[i].id !== dialogueList[i].id);
						if (needUpdate) {
							setDialogueList(
								v.map((i) => {
									return dialogueList.find((d) => d.id === i.id)!;
								}),
							);
						}
					}
				}}
				onSort={() => {
					rebuildTree();
				}}
			>
				{dialogueList.map((item) => (
					<DialogueItem itemId={item.id} key={item.id} className={isEdit ? "cursor-grab" : ""} />
				))}
			</ReactSortable>
		</canBeDetected.section>
	);
};

export default DialogueList;
