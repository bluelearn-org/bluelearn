import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  KEY_TAB_COMMAND,
} from "lexical";
import { $isLinkNode } from "@lexical/link";

export default function TabShortcutListener() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_TAB_COMMAND,
      (event: KeyboardEvent) => {
        let handled = false;
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          const anchorNode = selection.anchor.getNode();

          // Let Lexical handle Tab / Shift+Tab if we are in a list item (indenting/outdenting lists)
          const isInsideList =
            anchorNode.getType() === "listitem" ||
            anchorNode.getType() === "list" ||
            anchorNode.getParents().some((n) => n.getType() === "listitem");

          if (isInsideList) {
            return;
          }

          if (event.shiftKey) {
            // Shift+Tab: Outdent non-list text
            if ($isTextNode(anchorNode)) {
              const text = anchorNode.getTextContent();
              const offset = selection.anchor.offset;
              const beforeCursor = text.slice(0, offset);
              const spaceMatch = beforeCursor.match(/ {1,4}$/);
              if (spaceMatch) {
                const count = spaceMatch[0].length;
                const newText =
                  text.slice(0, offset - count) + text.slice(offset);
                anchorNode.setTextContent(newText);
                selection.setTextNodeRange(
                  anchorNode,
                  offset - count,
                  anchorNode,
                  offset - count
                );
                event.preventDefault();
                handled = true;
                return;
              }
              const leadingMatch = text.match(/^ {1,4}/);
              if (leadingMatch) {
                const count = leadingMatch[0].length;
                const newText = text.slice(count);
                anchorNode.setTextContent(newText);
                const newOffset = Math.max(0, offset - count);
                selection.setTextNodeRange(
                  anchorNode,
                  newOffset,
                  anchorNode,
                  newOffset
                );
                event.preventDefault();
                handled = true;
              }
            }
            return;
          }

          if (!selection.isCollapsed()) return;

          const offset = selection.anchor.offset;

          if ($isTextNode(anchorNode)) {
            const parent = anchorNode.getParent();

            if (
              parent &&
              ($isLinkNode(parent) || parent.getType() === "code")
            ) {
              const textContent = anchorNode.getTextContent();
              if (offset === textContent.length) {
                const nextSibling = parent.getNextSibling();
                event.preventDefault();
                if (nextSibling && $isTextNode(nextSibling)) {
                  nextSibling.select(0, 0);
                } else {
                  parent.selectNext();
                }
                handled = true;
                return;
              }
            }
          }

          event.preventDefault();
          selection.insertText("    ");
          handled = true;
        });
        return handled;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor]);

  return null;
}
