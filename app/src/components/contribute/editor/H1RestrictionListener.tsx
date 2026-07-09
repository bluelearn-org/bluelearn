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
        if (event.key === " ") {
          const state = { handled: false };

          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
              return;
            }

            const anchorKey = selection.anchor.key;
            const offset = selection.anchor.offset;
            const anchorNode = $getNodeByKey(anchorKey);

            if (!$isTextNode(anchorNode) || offset !== 1) {
              return;
            }

            const textContent = anchorNode.getTextContent();
            if (textContent.startsWith("#")) {
              const parentNode = anchorNode.getParent();
              if (
                parentNode &&
                parentNode.getType() === "paragraph" &&
                parentNode.getFirstChild() === anchorNode
              ) {
                const headingNode = $createHeadingNode("h2");

                if (textContent === "#") {
                  // Paragraph is empty other than the "#" character.
                  const textNode = lexical.$createTextNode("");
                  headingNode.append(textNode);
                  parentNode.replace(headingNode);
                  textNode.select();
                } else {
                  // Paragraph has other content after the "#". Strip it and keep children.
                  anchorNode.setTextContent(textContent.slice(1));
                  parentNode.getChildren().forEach((child) => {
                    headingNode.append(child);
                  });
                  parentNode.replace(headingNode);
                  headingNode.select(0, 0);
                }
                onH1Attempted();
                state.handled = true;
              }
            }
          });

          if (state.handled) {
            event.preventDefault();
            return true;
          }
        }
        return false;
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
