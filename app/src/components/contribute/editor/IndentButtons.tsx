import { useCallback } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
} from "lexical";
import { Indent, Outdent } from "lucide-react";
import type { LexicalEditor } from "lexical";

/**
 * Executes an increase indent action on the active editor selection.
 * In lists, nests the list item. In regular text/code, inserts 4 spaces.
 */
export function executeIndent(editor: LexicalEditor) {
  editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;

    const anchorNode = selection.anchor.getNode();
    const isInsideList =
      anchorNode.getType() === "listitem" ||
      anchorNode.getType() === "list" ||
      anchorNode.getParents().some((n) => n.getType() === "listitem");

    if (isInsideList) {
      editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
      return;
    }

    // If outside a list, insert 4 spaces at cursor
    selection.insertText("    ");
  });
}

/**
 * Executes a decrease indent action on the active editor selection.
 * In lists, outdents the list item. In regular text/code, trims up to 4 leading spaces.
 */
export function executeOutdent(editor: LexicalEditor) {
  editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;

    const anchorNode = selection.anchor.getNode();
    const isInsideList =
      anchorNode.getType() === "listitem" ||
      anchorNode.getType() === "list" ||
      anchorNode.getParents().some((n) => n.getType() === "listitem");

    if (isInsideList) {
      editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
      return;
    }

    // If outside a list, remove up to 4 leading spaces
    if ($isTextNode(anchorNode)) {
      const text = anchorNode.getTextContent();
      const offset = selection.anchor.offset;

      // Check if there are spaces directly before the cursor
      const beforeCursor = text.slice(0, offset);
      const spaceMatch = beforeCursor.match(/ {1,4}$/);
      if (spaceMatch) {
        const count = spaceMatch[0].length;
        const newText = text.slice(0, offset - count) + text.slice(offset);
        anchorNode.setTextContent(newText);
        selection.setTextNodeRange(
          anchorNode,
          offset - count,
          anchorNode,
          offset - count
        );
        return;
      }

      // Check if the beginning of the text node starts with spaces
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
      }
    }
  });
}

export function OutdentButton({ className }: { className?: string }) {
  const [editor] = useLexicalComposerContext();

  const handleOutdent = useCallback(() => {
    executeOutdent(editor);
  }, [editor]);

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={handleOutdent}
      title="Decrease Indent (Shift+Tab)"
      aria-label="Decrease Indent"
      className={className}
    >
      <Outdent className="h-4 w-4" />
    </button>
  );
}

export function IndentButton({ className }: { className?: string }) {
  const [editor] = useLexicalComposerContext();

  const handleIndent = useCallback(() => {
    executeIndent(editor);
  }, [editor]);

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={handleIndent}
      title="Increase Indent (Tab)"
      aria-label="Increase Indent"
      className={className}
    >
      <Indent className="h-4 w-4" />
    </button>
  );
}

export function IndentButtons({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-0.5 ${className ?? ""}`}>
      <OutdentButton />
      <IndentButton />
    </div>
  );
}

export default IndentButtons;
