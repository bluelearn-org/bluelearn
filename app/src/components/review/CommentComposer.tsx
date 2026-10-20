import { useEffect, useMemo, useRef, useState } from "react";
import {
  BoldItalicUnderlineToggles,
  CreateLink,
  ListsToggle,
  MDXEditor,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  toolbarPlugin,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";

import { Button } from "@/components/ui/button";

type PropTypes = {
  label: string;
  submitLabel: string;
  maxLength: number;
  // The saved draft to open with. The parent keeps drafts, so a failed save
  // or a collapsed card never loses what the reviewer wrote.
  initialValue: string;
  onDraftChange: (markdown: string) => void;
  onSubmit: (markdown: string) => Promise<void>;
  onCancel?: () => void;
  autoFocus?: boolean;
};

export const CommentComposer = ({
  label,
  submitLabel,
  maxLength,
  initialValue,
  onDraftChange,
  onSubmit,
  onCancel,
  autoFocus = false,
}: PropTypes) => {
  const [text, setText] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorBoxRef = useRef<HTMLDivElement>(null);

  // Built once: new plugin objects would rebuild the Lexical editor.
  const plugins = useMemo(
    () => [
      listsPlugin(),
      quotePlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      markdownShortcutPlugin(),
      toolbarPlugin({
        toolbarContents: () => (
          <>
            <BoldItalicUnderlineToggles options={["Bold", "Italic"]} />
            <ListsToggle options={["bullet", "number"]} />
            <CreateLink />
          </>
        ),
      }),
    ],
    []
  );

  // MDXEditor takes no label prop, so name its text box for screen readers.
  useEffect(() => {
    editorBoxRef.current
      ?.querySelector('[contenteditable="true"]')
      ?.setAttribute("aria-label", label);
  });

  const tooLong = text.length > maxLength;
  const empty = text.trim() === "";

  const submit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(text);
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : "Could not save your comment. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div role="group" aria-label={label} className="space-y-2">
      <div
        ref={editorBoxRef}
        data-review-composer
        className="rounded-md border border-input bg-background focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30"
      >
        <MDXEditor
          className="review-comment-editor"
          markdown={initialValue}
          autoFocus={autoFocus ? { preventScroll: true } : false}
          plugins={plugins}
          placeholder={`${label}...`}
          contentEditableClassName="review-comment-input max-h-64 min-h-16 overflow-y-auto text-sm [&_p]:mb-2 [&_p]:text-foreground [&_p:last-child]:mb-0"
          onChange={(markdown) => {
            setText(markdown);
            onDraftChange(markdown);
          }}
        />
      </div>

      {tooLong && (
        <p aria-live="polite" className="text-xs text-destructive">
          Use {maxLength} characters or fewer ({text.length} now).
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={submitting}
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          className="min-h-11"
          disabled={submitting || empty || tooLong}
          onClick={submit}
        >
          {submitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </div>
  );
};
