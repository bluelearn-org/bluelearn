import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createLinkNode } from "@lexical/link";
import { $createImageNode, lexical } from "@mdxeditor/editor";

export default function MarkdownLinkImageShortcutListener() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const {
      $getSelection,
      $isRangeSelection,
      $getNodeByKey,
      $isTextNode,
      $createRangeSelection,
      $setSelection,
      $insertNodes,
      $createTextNode,
    } = lexical;

    return editor.registerUpdateListener(
      ({ tags, dirtyLeaves, editorState }) => {
        if (
          tags.has("collaboration") ||
          tags.has("historic") ||
          editor.isComposing()
        ) {
          return;
        }

        editorState.read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;

          const anchorKey = selection.anchor.key;
          const anchorOffset = selection.anchor.offset;
          const anchorNode = $getNodeByKey(anchorKey);

          if (!$isTextNode(anchorNode) || !dirtyLeaves.has(anchorKey)) return;

          // Skip processing inside code blocks
          const parentNode = anchorNode.getParent();
          if (parentNode === null || parentNode.getType() === "code") return;

          const textContent = anchorNode.getTextContent();
          const textBeforeCursor = textContent.slice(0, anchorOffset);

          // 1. Match Image syntax: ![alt](url)
          const imageMatch = textBeforeCursor.match(
            /!\[([^\]]*)\]\(([^)]+)\)$/
          );
          if (imageMatch) {
            const fullMatchText = imageMatch[0];
            const altText = imageMatch[1];
            const src = imageMatch[2];
            const startOffset = anchorOffset - fullMatchText.length;

            editor.update(() => {
              const rangeSelection = $createRangeSelection();
              rangeSelection.anchor.set(
                anchorNode.getKey(),
                startOffset,
                "text"
              );
              rangeSelection.focus.set(
                anchorNode.getKey(),
                anchorOffset,
                "text"
              );
              $setSelection(rangeSelection);

              const imageNode = $createImageNode({ src, altText });
              $insertNodes([imageNode]);
            });
            return;
          }

          // 2. Match Link syntax: [text](url)
          const linkMatch = textBeforeCursor.match(/\[([^\]]+)\]\(([^)]+)\)$/);
          if (linkMatch) {
            const fullMatchText = linkMatch[0];
            const isImage = textBeforeCursor
              .slice(0, anchorOffset - fullMatchText.length)
              .endsWith("!");
            if (!isImage) {
              const text = linkMatch[1];
              const url = linkMatch[2];
              const startOffset = anchorOffset - fullMatchText.length;

              editor.update(() => {
                const rangeSelection = $createRangeSelection();
                rangeSelection.anchor.set(
                  anchorNode.getKey(),
                  startOffset,
                  "text"
                );
                rangeSelection.focus.set(
                  anchorNode.getKey(),
                  anchorOffset,
                  "text"
                );
                $setSelection(rangeSelection);

                const linkNode = $createLinkNode(url);
                const textNode = $createTextNode(text);
                linkNode.append(textNode);
                $insertNodes([linkNode]);
              });
              return;
            }
          }
        });
      }
    );
  }, [editor]);

  return null;
}
