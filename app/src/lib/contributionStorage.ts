import { useEffect, useRef } from "react";
import { z } from "zod";
import type { ContributionType } from "@/types/contributions";
import {
  guideContributionSchema,
  objectiveContributionSchema,
  variantContributionSchema,
} from "@/types/contributions";

/**
 * All locally stored contribution drafts live under one localStorage key.
 */
const STORAGE_KEY = "bluelearn:contrib:drafts";

/**
 * localDraftId:
 *   Identifies the draft inside this browser.
 *
 * revisionId:
 *   Identifies the corresponding database revision, if one exists.
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
 * Raw localStorage structure.
 *
 * Values are unknown until they are validated against the
 * appropriate contribution schema.
 */
type StoredDrafts = Record<string, unknown>;

/**
 * Creates the complete validation schema for a particular
 * contribution type.
 */
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

/**
 * Schema used to determine which contribution schema should
 * validate an individual draft.
 */
const draftEnvelopeSchema = z.object({
  localDraftId: z.string().min(1),
  type: z.enum(["guide", "variant", "objective"]),
});

/**
 * Schemas for each contribution type.
 *
 * The literal `type` on each schema creates the discriminated
 * relationship between `type` and `data`.
 */
const DRAFT_SCHEMAS = {
  guide: persistedDraftSchema("guide", guideContributionSchema),
  variant: persistedDraftSchema("variant", variantContributionSchema),
  objective: persistedDraftSchema("objective", objectiveContributionSchema),
};

/**
 * Types generated directly from the Zod schemas.
 */
type StoredGuideDraft = z.infer<typeof DRAFT_SCHEMAS.guide>;

type StoredVariantDraft = z.infer<typeof DRAFT_SCHEMAS.variant>;

type StoredObjectiveDraft = z.infer<typeof DRAFT_SCHEMAS.objective>;

type AnyStoredDraft =
  | StoredGuideDraft
  | StoredVariantDraft
  | StoredObjectiveDraft;

/**
 * Safely reads the complete raw draft store from localStorage.
 *
 * Individual drafts are validated later - each contribution
 * type has a different data schema.
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

/**
 * Writes the complete draft store to localStorage.
 */
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

/**
 * Generates a unique ID for a new local draft.
 */
export function createLocalDraftId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  throw new Error("crypto.randomUUID() is not available in this environment.");
}

/**
 * Validates one raw localStorage entry.
 *
 * The switch preserves the relationship between
 * the contribution type and its corresponding data schema.
 */
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

/**
 * Gets a single stored guide draft.
 */
export function getStoredDraft(
  localDraftId: string,
  type: "guide"
): StoredGuideDraft | null;

/**
 * Gets a single stored variant draft.
 */
export function getStoredDraft(
  localDraftId: string,
  type: "variant"
): StoredVariantDraft | null;

/**
 * Gets a single stored objective draft.
 */
export function getStoredDraft(
  localDraftId: string,
  type: "objective"
): StoredObjectiveDraft | null;

/**
 * Implementation for getStoredDraft.
 */
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
      `Stored draft ${localDraftId} has type "${parsedDraft.type}" ` +
        `but "${type}" was requested.`
    );

    return null;
  }

  return parsedDraft;
}

/**
 * Gets every valid stored draft.
 *
 * Malformed drafts are removed from localStorage.
 */
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

    /**
     * The localStorage key and localDraftId should agree.
     */
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

/**
 * Gets all stored guide drafts.
 */
export function getStoredDraftsByType(type: "guide"): Array<StoredGuideDraft>;

/**
 * Gets all stored variant drafts.
 */
export function getStoredDraftsByType(
  type: "variant"
): Array<StoredVariantDraft>;

/**
 * Gets all stored objective drafts.
 */
export function getStoredDraftsByType(
  type: "objective"
): Array<StoredObjectiveDraft>;

/**
 * Implementation for getStoredDraftsByType.
 */
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

/**
 * Saves or updates one stored guide draft.
 */
export function setStoredDraft(draft: StoredGuideDraft): void;

/**
 * Saves or updates one stored variant draft.
 */
export function setStoredDraft(draft: StoredVariantDraft): void;

/**
 * Saves or updates one stored objective draft.
 */
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

/**
 * Deletes one local draft.
 */
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

/**
 * Checks whether a particular local draft exists.
 * Checks the presence of the ID only.
 */
export function hasStoredDraft(localDraftId: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const drafts = readStoredDrafts();

  return drafts[localDraftId] !== undefined;
}

/**
 * Deletes every locally stored contribution draft.
 */
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

/**
 * Deletes all drafts belonging to a particular
 * contribution type.
 */
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
 * Automatically and debouncingly saves one particular
 * contribution draft to localStorage.
 *
 * localDraftId identifies WHICH draft is being saved.
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

/**
 * Implementation for useDebouncedContributionSave.
 */
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

  /**
   * Always keep the latest contribution data available.
   */
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

  /**
   * Immediately save the latest pending data.
   */
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

  /**
   * Cancel the pending autosave.
   *
   * This does NOT delete an existing localStorage draft.
   */
  const cancel = () => {
    clearTimer();
    isPendingRef.current = false;
  };

  const flushRef = useRef(flush);
  flushRef.current = flush;

  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;

  /**
   * Start/restart debounce timer whenever the contribution changes.
   */
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

  /**
   * Flush anything still waiting when the component unmounts.
   */
  useEffect(() => {
    return () => {
      flushRef.current();
    };
  }, []);

  return {
    cancel: () => cancelRef.current(),
  };
}
