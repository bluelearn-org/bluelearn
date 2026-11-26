import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { useRouter } from "@tanstack/react-router";
import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";

import type {
  AnnotationPermissions,
  ReviewAnnotationsData,
  ReviewPublication,
} from "@/lib/api/reviewAnnotations";
import type { PassageAnchor } from "@/lib/reviewAnchors";
import type {
  AnnotationItem,
  MarkedPassage,
  Placement,
} from "@/lib/reviewPlacement";
import { badgeId, cardId } from "@/components/review/AnnotationParts";
import { useBlockSelection } from "@/components/review/useBlockSelection";
import {
  createReviewSuggestion,
  createReviewThread,
  decideReviewSuggestion,
  deleteReviewReply,
  deleteReviewThread,
  getReviewAnnotations,
  replyToReviewThread,
  updateReviewReply,
  updateReviewThread,
} from "@/lib/api/reviewAnnotations";
import { useSuspensionStatus } from "@/lib/authContext";
import {
  ANNOTATION_UI_ATTR,
  blocksAnchor,
  sourceRangeFits,
} from "@/lib/reviewAnchors";
import { paintHighlights, placeItems } from "@/lib/reviewPlacement";

// The open composer. It holds the anchor taken before the composer took
// focus, so the page selection is free to change afterwards.
export type Draft = { mode: "comment" | "suggestion"; anchor: PassageAnchor };

type MessageTarget = { threadId: string; replyId: string | null };

type AnnotationsContext = {
  rootRef: RefObject<HTMLDivElement | null>;
  revisionBody: string;
  status: "loading" | "error" | "ready";
  error: string | null;
  reload: () => void;
  permissions: AnnotationPermissions;
  publication: ReviewPublication | null;
  itemCount: number;
  placed: Map<number, Array<AnnotationItem>>;
  passages: Map<number, MarkedPassage>;
  detached: Array<AnnotationItem>;
  expanded: ReadonlySet<string>;
  toggle: (id: string) => void;
  draft: Draft | null;
  openDraft: (draft: Draft) => void;
  closeDraft: () => void;
  selection: PassageAnchor | null;
  setSelection: Dispatch<SetStateAction<PassageAnchor | null>>;
  blockSelection: boolean;
  selectBlocks: (start: number, end: number) => void;
  selectionControls: ReturnType<typeof useBlockSelection>;
  // Composer text by draft key. A ref, so typing never re-renders the page.
  drafts: Map<string, string>;
  createThread: (anchor: PassageAnchor, body: string) => Promise<void>;
  reply: (threadId: string, body: string) => Promise<void>;
  editMessage: (target: MessageTarget, body: string) => Promise<void>;
  deleteMessage: (target: MessageTarget) => Promise<void>;
  createSuggestion: (
    anchor: PassageAnchor,
    proposed: string,
    note: string
  ) => Promise<void>;
  decide: (
    suggestionId: string,
    decision: "accepted" | "rejected"
  ) => Promise<void>;
};

const NO_PERMISSIONS: AnnotationPermissions = {
  can_comment: false,
  can_reply: false,
  can_suggest: false,
  can_decide_suggestions: false,
};

const Context = createContext<AnnotationsContext | null>(null);

export function useReviewAnnotations() {
  const value = useContext(Context);
  if (!value)
    throw new Error("useReviewAnnotations needs a ReviewAnnotationsProvider");
  return value;
}

// For the sidebar, which also renders on a case without a revision.
export function useOptionalReviewAnnotations() {
  return useContext(Context);
}

export function draftKey(draft: Draft) {
  const { anchor } = draft;
  return `${draft.mode}:${anchor.kind}:${anchor.start_block}:${anchor.start_offset}:${anchor.end_block}:${anchor.end_offset}`;
}

export const replyDraftKey = (threadId: string) => `reply:${threadId}`;

export const editDraftKey = (messageId: string) => `edit:${messageId}`;

type PropTypes = {
  caseId: string;
  revisionId: string;
  revisionBody: string;
  viewerExpiresAt: string | null;
  children: ReactNode;
};

export const ReviewAnnotationsProvider = ({
  caseId,
  revisionId,
  revisionBody,
  viewerExpiresAt,
  children,
}: PropTypes) => {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const drafts = useRef(new Map<string, string>()).current;

  const [data, setData] = useState<ReviewAnnotationsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selection, setSelectionState] = useState<PassageAnchor | null>(null);
  const [blockSelection, setBlockSelection] = useState(false);

  const [seatExpired, setSeatExpired] = useState(false);
  const suspensionStatus = useSuspensionStatus();

  useEffect(() => {
    const controller = new AbortController();

    getReviewAnnotations(caseId, { signal: controller.signal })
      .then((next) => {
        setData(next);
        setError(null);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(err.message || "Could not load review comments.");
      });

    return () => controller.abort();
  }, [caseId, reloadKey]);

  const reload = useCallback(() => {
    setError(null);
    setReloadKey((key) => key + 1);
  }, []);

  // The server refuses a mutation from a lapsed seat. This hides the controls
  // when the seat lapses, not after the next refusal.
  useEffect(() => {
    if (!viewerExpiresAt) return;

    const remaining = new Date(viewerExpiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      setSeatExpired(true);
      return;
    }

    const timer = setTimeout(
      () => setSeatExpired(true),
      Math.min(remaining, 2 ** 31 - 1)
    );
    return () => clearTimeout(timer);
  }, [viewerExpiresAt]);

  // A layout effect reads the rendered text before the browser paints, so
  // loaded data and its placement show in the same frame. A passive effect
  // let one frame show the publication hold with no badges and "Loading".
  useLayoutEffect(() => {
    const root = rootRef.current;

    if (!data || !root) return;

    setPlacement(placeItems(data, revisionId, root));
  }, [data, revisionId, revisionBody]);

  // No dependency list: a route reload re-renders the guide and can replace
  // its text nodes, which empties any Range built before it.
  useLayoutEffect(() => {
    const root = rootRef.current;

    if (!root || !placement) return;

    paintHighlights(root, [
      ["review-passage-draft", draft ? [draft.anchor] : []],
    ]);
  });

  useEffect(
    () => () => {
      if (typeof CSS === "undefined" || !("highlights" in CSS)) return;
      CSS.highlights.delete("review-passage-draft");
    },
    []
  );

  const permissions = useMemo(() => {
    if (!data || suspensionStatus !== "active") return NO_PERMISSIONS;

    return {
      can_comment: data.permissions.can_comment && !seatExpired,
      can_reply: data.permissions.can_reply && !seatExpired,
      can_suggest: data.permissions.can_suggest && !seatExpired,
      can_decide_suggestions: data.permissions.can_decide_suggestions,
    };
  }, [data, suspensionStatus, seatExpired]);

  const setSelection = useCallback<
    Dispatch<SetStateAction<PassageAnchor | null>>
  >((next) => {
    setBlockSelection(false);
    setSelectionState(next);
  }, []);

  const selectBlocks = useCallback((start: number, end: number) => {
    const root = rootRef.current;
    const anchor = root && blocksAnchor(root, start, end);

    if (!anchor) return;

    document.getSelection()?.removeAllRanges();
    setBlockSelection(true);
    setSelectionState(anchor);
  }, []);

  const selectionControls = useBlockSelection({
    rootRef,
    selection,
    enabled:
      blockSelection &&
      !draft &&
      (permissions.can_comment || permissions.can_suggest),
    selectBlocks,
    clear: () => setSelection(null),
  });

  const transition = useRef<ViewTransition | null>(null);
  const toggle = useCallback((id: string) => {
    transition.current?.skipTransition();

    const update = () => {
      flushSync(() => {
        setExpanded((prev) => {
          const next = new Set(prev);
          if (!next.delete(id)) next.add(id);
          return next;
        });
      });
      document.getElementById(badgeId(id))?.focus({ preventScroll: true });
    };
    if (
      "startViewTransition" in document &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      transition.current = document.startViewTransition(update);

      if ("types" in transition.current) transition.current.types.add("review");

      void transition.current.ready.catch((animationError: unknown) => {
        // A second toggle can skip the first animation before its snapshot is ready.
        if (
          animationError instanceof DOMException &&
          animationError.name === "AbortError"
        )
          return;

        console.error("Review animation failed.", animationError);
      });
    } else {
      update();
    }
  }, []);

  const openDraft = useCallback(
    (next: Draft) => {
      setDraft(next);
      setSelection(null);
    },
    [setSelection]
  );

  const closeDraft = useCallback(() => setDraft(null), []);

  // After a write the list is fetched again, so the page shows what the
  // server holds, attribution and anchor status included.
  const refresh = useCallback(async () => {
    try {
      setData(await getReviewAnnotations(caseId));
      setError(null);
      return true;
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Could not load review comments."
      );
      return false;
    }
  }, [caseId]);

  // Resolve focus after placement; deletion can remove both the message and its badge.
  const focusAfterPlacement = useRef<
    (() => HTMLElement | null | undefined) | null
  >(null);

  useLayoutEffect(() => {
    const target = focusAfterPlacement.current;
    if (!placement || target === null) return;

    focusAfterPlacement.current = null;
    target()?.focus({ preventScroll: true });
  }, [placement]);

  const finishDraft = useCallback(
    (finished: Draft, createdId: string) => {
      drafts.delete(draftKey(finished));
      focusAfterPlacement.current = () =>
        document.getElementById(badgeId(createdId));
      setDraft(null);
      setExpanded((prev) => new Set(prev).add(createdId));
    },
    [drafts]
  );

  const createThread = useCallback(
    async (anchor: PassageAnchor, body: string) => {
      // The API keeps source offsets only where they sit on line edges, so a
      // block that fails that check keeps a text-only anchor.
      const fits = sourceRangeFits(
        revisionBody,
        anchor.source_start,
        anchor.source_end
      );
      const thread = await createReviewThread(caseId, {
        anchor: {
          ...anchor,
          revision_id: revisionId,
          source_start: fits ? anchor.source_start : null,
          source_end: fits ? anchor.source_end : null,
        },
        body,
      });

      finishDraft({ mode: "comment", anchor }, thread.id);
      await refresh();
    },
    [caseId, revisionId, revisionBody, finishDraft, refresh]
  );

  const reply = useCallback(
    async (threadId: string, body: string) => {
      await replyToReviewThread(caseId, threadId, { body });
      drafts.delete(replyDraftKey(threadId));
      await refresh();
    },
    [caseId, drafts, refresh]
  );

  const editMessage = useCallback(
    async ({ threadId, replyId }: MessageTarget, body: string) => {
      if (replyId === null) {
        await updateReviewThread(caseId, threadId, { body });
      } else {
        await updateReviewReply(caseId, threadId, replyId, { body });
      }

      drafts.delete(editDraftKey(replyId ?? threadId));
      await refresh();
    },
    [caseId, drafts, refresh]
  );

  const deleteMessage = useCallback(
    async ({ threadId, replyId }: MessageTarget) => {
      // Capture the stable container before deletion can remove its thread.
      const place = document
        .getElementById(cardId(threadId))
        ?.closest<HTMLElement>(
          `[${ANNOTATION_UI_ATTR}], [data-review-detached]`
        );

      if (replyId === null) {
        await deleteReviewThread(caseId, threadId);
      } else {
        await deleteReviewReply(caseId, threadId, replyId);
      }

      focusAfterPlacement.current = () =>
        document.getElementById(badgeId(threadId)) ??
        document.getElementById(cardId(threadId)) ??
        place;
      if (!(await refresh())) focusAfterPlacement.current = null;
    },
    [caseId, refresh]
  );

  const createSuggestion = useCallback(
    async (anchor: PassageAnchor, proposed: string, note: string) => {
      const { source_start: start, source_end: end } = anchor;
      // An edit replaces the exact source of one whole block.
      if (
        anchor.kind !== "block" ||
        start === null ||
        end === null ||
        !sourceRangeFits(revisionBody, start, end)
      )
        throw new Error("This block cannot take a suggested edit.");

      const suggestion = await createReviewSuggestion(caseId, {
        anchor: {
          ...anchor,
          kind: "block",
          revision_id: revisionId,
          source_start: start,
          source_end: end,
        },
        proposed,
        ...(note.trim() === "" ? {} : { note }),
      });

      finishDraft({ mode: "suggestion", anchor }, suggestion.id);
      await refresh();
    },
    [caseId, revisionId, revisionBody, finishDraft, refresh]
  );

  const decide = useCallback(
    async (suggestionId: string, decision: "accepted" | "rejected") => {
      await decideReviewSuggestion(caseId, suggestionId, decision);
      await refresh();
      // The last decision can publish the guide or close the case, which
      // the sidebar reads from the case itself.
      await router.invalidate();
    },
    [caseId, refresh, router]
  );

  const value = useMemo<AnnotationsContext>(
    () => ({
      rootRef,
      revisionBody,
      status: error ? "error" : placement ? "ready" : "loading",
      error,
      reload,
      permissions,
      publication: data?.publication ?? null,
      itemCount: placement?.itemCount ?? 0,
      placed: placement?.placed ?? new Map(),
      passages: placement?.passages ?? new Map(),
      detached: placement?.detached ?? [],
      expanded,
      toggle,
      draft,
      openDraft,
      closeDraft,
      selection,
      setSelection,
      blockSelection,
      selectBlocks,
      selectionControls,
      drafts,
      createThread,
      reply,
      editMessage,
      deleteMessage,
      createSuggestion,
      decide,
    }),
    [
      revisionBody,
      error,
      placement,
      reload,
      permissions,
      data,
      expanded,
      toggle,
      draft,
      openDraft,
      closeDraft,
      selection,
      setSelection,
      blockSelection,
      selectBlocks,
      selectionControls,
      drafts,
      createThread,
      reply,
      editMessage,
      deleteMessage,
      createSuggestion,
      decide,
    ]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
};
