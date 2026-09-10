import { useEffect, useRef } from "react";
import { z } from "zod";
import type { ContributionType } from "@/types/contributions";
import type { UUID } from "node:crypto";
import {
  guideContributionSchema,
  objectiveContributionSchema,
  variantContributionSchema,
} from "@/types/contributions";

/**
 * all locally stored contribution drafts exist under one localStorage key
 */
const STORAGE_KEY = "bluelearn:contrib:drafts";

/**
 * localDraftId - identifies the draft inside this browser
 * revisionId - identifies the corresponding database revision (if it exists)
 */
export interface PersistedContributionDraft<T> {
  localDraftId: string;
  type: ContributionType;
  data: T;
  revisionId: string | null;
  step?: string;
  updatedAt: number;
}

/**
 * localStorage structure - values are unknown until they are validated against the contribution schema
 */
type StoredDrafts = Record<string, unknown>;

const persistedDraftSchema = <T extends z.ZodType>(
  type: ContributionType,
  dataSchema: T
) =>
  z.object({
    localDraftId: z.string().min(1),
    type: z.literal(type),
    data: dataSchema,
    revisionId: z
      .string()
      .nullish()
      .transform((value) => value ?? null),
    step: z.string().optional(),
    updatedAt: z.number(),
  });

// schema determine which contribution schema should validate an individual draft
const draftEnvelopeSchema = z.object({
  localDraftId: z.string().min(1),
  type: z.enum(["guide", "variant", "objective"]),
});

// schemas for each contribution type
const DRAFT_SCHEMAS = {
  guide: persistedDraftSchema("guide", guideContributionSchema),
  variant: persistedDraftSchema("variant", variantContributionSchema),
  objective: persistedDraftSchema("objective", objectiveContributionSchema),
};

// types generated directly from Zod schemas
type StoredGuideDraft = z.infer<typeof DRAFT_SCHEMAS.guide>;

type StoredVariantDraft = z.infer<typeof DRAFT_SCHEMAS.variant>;

type StoredObjectiveDraft = z.infer<typeof DRAFT_SCHEMAS.objective>;

export type AnyStoredDraft =
  | StoredGuideDraft
  | StoredVariantDraft
  | StoredObjectiveDraft;

/**
 * reads the complete raw draft from localStorage
 * individual drafts are validated later - each contribution type has a different data schema
 */
function readStoredDrafts(): StoredDrafts {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed: unknown = JSON.parse(raw);

    const result = z.record(z.string(), z.unknown()).safeParse(parsed);

    if (!result.success) {
      console.warn(
        "Discarding malformed contribution draft store:",
        result.error
      );

      clearAllStoredDrafts();
      return {};
    }

    return result.data;
  } catch (error) {
    console.warn("Failed to read contribution drafts:", error);

    clearAllStoredDrafts();
    return {};
  }
}

// writes the complete draft store to localStorage
function writeStoredDrafts(drafts: StoredDrafts): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch (error) {
    console.warn("Failed to save contribution drafts:", error);
  }
}

// generates a unique ID for new local draft
export function createLocalDraftId(): UUID {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  throw new Error("crypto.randomUUID() is not available in this environment.");
}

// validates one raw localStorage entry
function parseStoredDraft(value: unknown): AnyStoredDraft | null {
  const envelopeResult = draftEnvelopeSchema.safeParse(value);

  if (!envelopeResult.success) {
    return null;
  }

  switch (envelopeResult.data.type) {
    case "guide": {
      const result = DRAFT_SCHEMAS.guide.safeParse(value);

      return result.success ? result.data : null;
    }

    case "variant": {
      const result = DRAFT_SCHEMAS.variant.safeParse(value);

      return result.success ? result.data : null;
    }

    case "objective": {
      const result = DRAFT_SCHEMAS.objective.safeParse(value);

      return result.success ? result.data : null;
    }
  }
}

// get a single stored draft
export function getStoredDraft(
  localDraftId: string,
  type: "guide"
): StoredGuideDraft | null;
export function getStoredDraft(
  localDraftId: string,
  type: "variant"
): StoredVariantDraft | null;
export function getStoredDraft(
  localDraftId: string,
  type: "objective"
): StoredObjectiveDraft | null;

export function getStoredDraft(
  localDraftId: string,
  type: ContributionType
): AnyStoredDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  const drafts = readStoredDrafts();
  const rawDraft = drafts[localDraftId];
  if (rawDraft === undefined) {
    return null;
  }

  const parsedDraft = parseStoredDraft(rawDraft);
  if (!parsedDraft) {
    console.warn(`Discarding malformed stored draft ${localDraftId}.`);
    delete drafts[localDraftId];
    writeStoredDrafts(drafts);
    return null;
  }

  if (parsedDraft.type !== type) {
    console.warn(
      `Stored draft ${localDraftId} has type "${parsedDraft.type}" but "${type}" was requested.`
    );
    return null;
  }

  return parsedDraft;
}

// get all valid stored draft - malformed drafts are removed from localStorage
export function getAllStoredDrafts(): Array<AnyStoredDraft> {
  if (typeof window === "undefined") {
    return [];
  }

  const drafts = readStoredDrafts();

  const validDrafts: Array<AnyStoredDraft> = [];

  let changed = false;

  for (const [localDraftId, rawDraft] of Object.entries(drafts)) {
    const parsedDraft = parseStoredDraft(rawDraft);

    if (!parsedDraft) {
      console.warn(`Discarding malformed stored draft ${localDraftId}.`);

      delete drafts[localDraftId];
      changed = true;
      continue;
    }

    // localStorage key and localDraftId should be the same
    if (parsedDraft.localDraftId !== localDraftId) {
      console.warn(
        `Discarding stored draft with mismatched localDraftId: ${localDraftId}.`
      );

      delete drafts[localDraftId];
      changed = true;
      continue;
    }

    validDrafts.push(parsedDraft);
  }

  if (changed) {
    writeStoredDrafts(drafts);
  }

  return validDrafts.sort((a, b) => b.updatedAt - a.updatedAt);
}

// get all stored drafts
export function getStoredDraftsByType(type: "guide"): Array<StoredGuideDraft>;
export function getStoredDraftsByType(
  type: "variant"
): Array<StoredVariantDraft>;
export function getStoredDraftsByType(
  type: "objective"
): Array<StoredObjectiveDraft>;

export function getStoredDraftsByType(
  type: ContributionType
): Array<AnyStoredDraft> {
  switch (type) {
    case "guide":
      return getAllStoredDrafts().filter(
        (draft): draft is StoredGuideDraft => draft.type === "guide"
      );

    case "variant":
      return getAllStoredDrafts().filter(
        (draft): draft is StoredVariantDraft => draft.type === "variant"
      );

    case "objective":
      return getAllStoredDrafts().filter(
        (draft): draft is StoredObjectiveDraft => draft.type === "objective"
      );
  }
}

// save or update one stored draft
export function setStoredDraft(draft: StoredGuideDraft): void;
export function setStoredDraft(draft: StoredVariantDraft): void;
export function setStoredDraft(draft: StoredObjectiveDraft): void;

export function setStoredDraft(draft: AnyStoredDraft): void {
  if (typeof window === "undefined") {
    return;
  }

  const parsedDraft = parseStoredDraft(draft);

  if (!parsedDraft) {
    console.warn(`Refusing to store malformed ${draft.type} draft.`);
    return;
  }

  const drafts = readStoredDrafts();
  drafts[draft.localDraftId] = parsedDraft;
  writeStoredDrafts(drafts);
}

// deletes one local draft
export function clearStoredDraft(localDraftId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const drafts = readStoredDrafts();

  if (drafts[localDraftId] === undefined) {
    return;
  }

  delete drafts[localDraftId];

  writeStoredDrafts(drafts);
}

// checks whether a particular local draft exists - checks ID presence only
export function hasStoredDraft(localDraftId: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const drafts = readStoredDrafts();
  return drafts[localDraftId] !== undefined;
}

// deletes every locally stored contribution draft
export function clearAllStoredDrafts(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear contribution drafts:", error);
  }
}

// deletes all drafts belonging to a particular contribution type
export function clearStoredDraftsByType(type: ContributionType): void {
  if (typeof window === "undefined") {
    return;
  }

  const drafts = readStoredDrafts();
  let changed = false;

  for (const [localDraftId, rawDraft] of Object.entries(drafts)) {
    const parsedDraft = parseStoredDraft(rawDraft);

    if (!parsedDraft) {
      delete drafts[localDraftId];
      changed = true;
      continue;
    }

    if (parsedDraft.type === type) {
      delete drafts[localDraftId];
      changed = true;
    }
  }

  if (changed) {
    writeStoredDrafts(drafts);
  }
}

export interface ContributionSaveControls {
  cancel: () => void;
}

/**
 * automatically saves contribution drafts to localStorage
 * localDraftId identifies WHICH draft is being saved
 */
export function useDebouncedContributionSave(
  localDraftId: string | null,
  type: "guide" | null,
  data: StoredGuideDraft["data"],
  revisionId: string | null,
  step?: string,
  delay?: number
): ContributionSaveControls;

export function useDebouncedContributionSave(
  localDraftId: string | null,
  type: "variant" | null,
  data: StoredVariantDraft["data"],
  revisionId: string | null,
  step?: string,
  delay?: number
): ContributionSaveControls;

export function useDebouncedContributionSave(
  localDraftId: string | null,
  type: "objective" | null,
  data: StoredObjectiveDraft["data"],
  revisionId: string | null,
  step?: string,
  delay?: number
): ContributionSaveControls;

export function useDebouncedContributionSave(
  localDraftId: string | null,
  type: ContributionType | null,
  data:
    | StoredGuideDraft["data"]
    | StoredVariantDraft["data"]
    | StoredObjectiveDraft["data"],
  revisionId: string | null,
  step?: string,
  delay: number = 400
): ContributionSaveControls {
  const pendingRef = useRef<{
    localDraftId: string;
    type: ContributionType;
    data:
      | StoredGuideDraft["data"]
      | StoredVariantDraft["data"]
      | StoredObjectiveDraft["data"];
    revisionId: string | null;
    step?: string;
  } | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPendingRef = useRef(false);

  // keep the latest contribution data available
  if (localDraftId && type) {
    pendingRef.current = {
      localDraftId,
      type,
      data,
      revisionId,
      step,
    };
  }

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // save the latest pending data
  const flush = () => {
    clearTimer();

    if (!isPendingRef.current) {
      return;
    }

    isPendingRef.current = false;

    const pending = pendingRef.current;

    if (!pending) {
      return;
    }

    switch (pending.type) {
      case "guide":
        setStoredDraft({
          localDraftId: pending.localDraftId,
          type: "guide",
          data: pending.data as StoredGuideDraft["data"],
          revisionId: pending.revisionId,
          step: pending.step,
          updatedAt: Date.now(),
        });
        break;

      case "variant":
        setStoredDraft({
          localDraftId: pending.localDraftId,
          type: "variant",
          data: pending.data as StoredVariantDraft["data"],
          revisionId: pending.revisionId,
          step: pending.step,
          updatedAt: Date.now(),
        });
        break;

      case "objective":
        setStoredDraft({
          localDraftId: pending.localDraftId,
          type: "objective",
          data: pending.data as StoredObjectiveDraft["data"],
          revisionId: pending.revisionId,
          step: pending.step,
          updatedAt: Date.now(),
        });
        break;
    }
  };

  // cancel pending autosave - this does NOT delete an existing localStorage draft
  const cancel = () => {
    clearTimer();
    isPendingRef.current = false;
  };

  const flushRef = useRef(flush);
  flushRef.current = flush;

  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;

  // start debounce timer whenever the contribution changes
  useEffect(() => {
    if (!localDraftId || !type) {
      flushRef.current();
      return;
    }

    isPendingRef.current = true;

    clearTimer();

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      flushRef.current();
    }, delay);

    return clearTimer;
  }, [localDraftId, type, data, revisionId, step, delay]);

  // flush anything still waiting when the component unmounts.
  useEffect(() => {
    return () => {
      flushRef.current();
    };
  }, []);

  return {
    cancel: () => cancelRef.current(),
  };
}
