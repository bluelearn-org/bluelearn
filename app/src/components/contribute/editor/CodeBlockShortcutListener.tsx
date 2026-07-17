import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createCodeBlockNode, lexical } from "@mdxeditor/editor";
import { COMMAND_PRIORITY_LOW, KEY_DOWN_COMMAND } from "lexical";

export default function CodeBlockShortcutListener() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const {
      $getSelection,
      $isRangeSelection,
      $getNodeByKey,
      $isTextNode,
      $getRoot,
    } = lexical;

    // 1. Intercept typed Markdown code block shortcuts: ```[language] followed by Space or Enter
    const removeKeyboardListener = editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        if (event.key === " " || event.key === "Enter") {
          const state = { handled: false };

          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
              return;
            }

            const anchorKey = selection.anchor.key;
            const offset = selection.anchor.offset;
            const anchorNode = $getNodeByKey(anchorKey);

            if (!$isTextNode(anchorNode)) {
              return;
            }

            const textContent = anchorNode.getTextContent();

            // Only trigger if the cursor is at the end of the text node
            if (offset !== textContent.length) {
              return;
            }

            const parentNode = anchorNode.getParent();
            if (parentNode && parentNode.getType() === "paragraph") {
              const match = textContent.match(/^```([\w-]+)?$/);
              if (match) {
                const lang = match[1] || "text";
                const codeBlockNode = $createCodeBlockNode({
                  code: "",
                  language: lang,
                  meta: "",
                });

                // To avoid "Point.getNode: node not found" crash, we insert the new node,
                // update selection to it, and then delete the old parent node.
                parentNode.insertAfter(codeBlockNode);
                codeBlockNode.select();
                parentNode.remove();

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

    // 2. Scan and convert multi-line ``` code blocks (from pastes or text entries)
    const removeUpdateListener = editor.registerUpdateListener(
      ({ editorState, tags }) => {
        if (
          tags.has("historic") ||
          tags.has("collaboration") ||
          tags.has("code-block-conversion")
        ) {
          return;
        }

        editorState.read(() => {
          const root = $getRoot();
          const children = root.getChildren();

          let startNode: any = null;
          let language = "";
          let collectedLines: Array<string> = [];
          let nodesToDelete: Array<any> = [];

          for (const child of children) {
            if (child.getType() === "paragraph") {
              const text = child.getTextContent().trim();

              if (startNode === null) {
                // Check if this paragraph starts a code block (single line ```[lang])
                const startMatch = text.match(/^```([\w-]+)?$/);
                if (startMatch) {
                  startNode = child;
                  language = startMatch[1] || "text";
                  collectedLines = [];
                  nodesToDelete = [];
                } else {
                  // Check if it's a self-contained multi-line code block in a single paragraph (typical for single pasted block)
                  const singleMatch = child
                    .getTextContent()
                    .match(/^```([\w-]+)?\n([\s\S]*?)\n```$/);
                  if (singleMatch) {
                    const code = singleMatch[2];
                    const lang = singleMatch[1] || "text";

                    // Defer the editor update to avoid updating during the active commit/read phase
                    setTimeout(() => {
                      editor.update(
                        () => {
                          const codeBlockNode = $createCodeBlockNode({
                            code,
                            language: lang,
                            meta: "",
                          });
                          child.insertAfter(codeBlockNode);
                          codeBlockNode.select();
                          child.remove();
                        },
                        { tag: "code-block-conversion" }
                      );
                    }, 0);
                    return; // Exit scanning on match to let the scheduled update complete
                  }
                }
              } else {
                // We are currently scanning/collecting within an active block
                const endMatch = text.match(/^```$/);
                if (endMatch) {
                  const code = collectedLines.join("\n");
                  const finalLang = language;
                  const finalStartNode = startNode;
                  const finalNodesToDelete = [...nodesToDelete];
                  const finalEndNode = child;

                  // Defer the editor update to avoid updating during the active commit/read phase
                  setTimeout(() => {
                    editor.update(
                      () => {
                        const codeBlockNode = $createCodeBlockNode({
                          code,
                          language: finalLang,
                          meta: "",
                        });

                        finalStartNode.insertAfter(codeBlockNode);
                        codeBlockNode.select();

                        finalStartNode.remove();
                        finalEndNode.remove();
                        for (const n of finalNodesToDelete) {
                          n.remove();
                        }
                      },
                      { tag: "code-block-conversion" }
                    );
                  }, 0);
                  return; // Exit scanning on match to let the scheduled update complete
                } else {
                  collectedLines.push(child.getTextContent());
                  nodesToDelete.push(child);
                }
              }
            } else {
              // If we hit any non-paragraph node (like another code block, table, etc.), abort current scanning
              startNode = null;
            }
          }
        });
      }
    );

    return () => {
      removeKeyboardListener();
      removeUpdateListener();
    };
  }, [editor]);

  return null;
}
