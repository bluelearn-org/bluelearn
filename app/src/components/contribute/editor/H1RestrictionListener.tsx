import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createHeadingNode, HeadingNode } from "@lexical/rich-text";
import { COMMAND_PRIORITY_LOW, KEY_DOWN_COMMAND } from "lexical";
import { lexical } from "@mdxeditor/editor";

interface H1RestrictionListenerProps {
  onH1Attempted: () => void;
}

export default function H1RestrictionListener({
  onH1Attempted,
}: H1RestrictionListenerProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const { $getSelection, $isRangeSelection, $getNodeByKey, $isTextNode } =
      lexical;

    // 1. Listen for new or updated HeadingNodes to intercept pasted H1s
    const removeMutationListener = editor.registerMutationListener(
      HeadingNode,
      (mutatedNodes) => {
        for (const [nodeKey, mutation] of mutatedNodes) {
          if (mutation === "created" || mutation === "updated") {
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if (
                node instanceof HeadingNode &&
                (node.getTag() as string) === "h1"
              ) {
                const newHeading = $createHeadingNode("h2");
                const children = node.getChildren();
                for (const child of children) {
                  newHeading.append(child);
                }
                node.replace(newHeading);
                onH1Attempted();
              }
            });
          }
        }
      }
    );

    // 2. Intercept typed Markdown H1 shortcuts: '# ' at the beginning of a line via keyboard command
    const removeKeyboardListener = editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        if (event.key !== " ") return false;

        // Lexical command handlers already run inside an editor update.
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return false;
        }

        const anchorNode = selection.anchor.getNode();
        if (!$isTextNode(anchorNode) || selection.anchor.offset !== 1) {
          return false;
        }

        const textContent = anchorNode.getTextContent();
        const parentNode = anchorNode.getParent();
        if (
          !textContent.startsWith("#") ||
          !parentNode ||
          parentNode.getType() !== "paragraph" ||
          parentNode.getFirstChild() !== anchorNode
        ) {
          return false;
        }

        // A lone hash can still have siblings, including a break and guide text.
        // Strip only the shortcut marker and move every child to the heading.
        const headingNode = $createHeadingNode("h2");
        anchorNode.setTextContent(textContent.slice(1));
        headingNode.append(...parentNode.getChildren());
        parentNode.replace(headingNode);
        headingNode.selectStart();
        event.preventDefault();
        onH1Attempted();
        return true;
      },
      COMMAND_PRIORITY_LOW
    );

    // Unsubscribe both listeners on unmount
    return () => {
      removeMutationListener();
      removeKeyboardListener();
    };
  }, [editor, onH1Attempted]);

  return null;
}
