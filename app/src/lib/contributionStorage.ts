import { useEffect, useRef } from "react";
import { z } from "zod";
import type { ContributionType } from "@/types/contributions";
import {
  guideContributionSchema,
  objectiveContributionSchema,
  variantContributionSchema,
} from "@/types/contributions";

const STORAGE_KEYS: Record<ContributionType, string> = {
  guide: "bluelearn:contrib:guide",
  variant: "bluelearn:contrib:variant",
  objective: "bluelearn:contrib:objective",
};

export interface PersistedContributionDraft<T> {
  data: T;
  revisionId: string | null;
  step?: string;
  updatedAt: number;
}

// Checks a draft read back from local storage.
const persistedDraftSchema = (data: z.ZodType) =>
  z.object({
    data,
    revisionId: z
      .string()
      .nullish()
      .transform((v) => v ?? null),
    step: z.string().optional(),
    updatedAt: z.number(),
  });

const DRAFT_SCHEMAS: Record<ContributionType, z.ZodType> = {
  guide: persistedDraftSchema(guideContributionSchema),
  variant: persistedDraftSchema(variantContributionSchema),
  objective: persistedDraftSchema(objectiveContributionSchema),
};

/**
 * Safely reads a contribution draft from sessionStorage.
 * Handles SSR (returns null when window is not defined) and JSON parse errors.
 * A draft that doesn't match the expected shape is dropped and cleared, since
 * loading one into form state crashes the first render that touches it.
 */
export function getStoredDraft<T>(
  type: ContributionType
): PersistedContributionDraft<T> | null {
  if (typeof window === "undefined") return null;

  let parsed: unknown;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEYS[type]);
    if (!raw) return null;
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn(`Failed to read stored draft for ${type}:`, error);
    clearStoredDraft(type);
    return null;
  }

  const result = DRAFT_SCHEMAS[type].safeParse(parsed);
  if (!result.success) {
    console.warn(
      `Discarding malformed stored draft for ${type}:`,
      result.error
    );
    clearStoredDraft(type);
    return null;
  }

  return result.data as PersistedContributionDraft<T>;
}

/**
 * Safely writes a contribution draft to sessionStorage.
 */
export function setStoredDraft<T>(
  type: ContributionType,
  draft: PersistedContributionDraft<T>
): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(STORAGE_KEYS[type], JSON.stringify(draft));
  } catch (error) {
    console.warn(`Failed to save draft to sessionStorage for ${type}:`, error);
  }
}

/**
 * Clears the stored draft for a given contribution type from sessionStorage.
 */
export function clearStoredDraft(type: ContributionType): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(STORAGE_KEYS[type]);
  } catch (error) {
    console.warn(`Failed to clear stored draft for ${type}:`, error);
  }
}

/**
 * Checks if a stored draft exists for the given contribution type.
 */
export function hasStoredDraft(type: ContributionType): boolean {
  if (typeof window === "undefined") return false;

  try {
    return window.sessionStorage.getItem(STORAGE_KEYS[type]) !== null;
  } catch {
    return false;
  }
}

/**
 * Clears all stored drafts for all contribution types from sessionStorage.
 */
export function clearAllStoredDrafts(): void {
  const types = Object.keys(STORAGE_KEYS) as Array<ContributionType>;
  for (const type of types) {
    clearStoredDraft(type);
  }
}

export interface ContributionSaveControls {
  cancel: () => void;
}

/**
 * Hook to automatically and debouncingly save contribution form data to sessionStorage.
 * Passing a null type disables saving, flushing anything already queued.
 * Flushes pending changes immediately on component unmount.
 */
export function useDebouncedContributionSave<T>(
  type: ContributionType | null,
  data: T,
  revisionId: string | null,
  step?: string,
  delay: number = 400
): ContributionSaveControls {
  const pendingRef = useRef<{
    type: ContributionType;
    data: T;
    revisionId: string | null;
    step?: string;
  } | null>(null);
  if (type) pendingRef.current = { type, data, revisionId, step };

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPendingRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const flush = () => {
    clearTimer();
    if (!isPendingRef.current) return;
    isPendingRef.current = false;

    const pending = pendingRef.current;
    if (!pending) return;

    setStoredDraft(pending.type, {
      data: pending.data,
      revisionId: pending.revisionId,
      step: pending.step,
      updatedAt: Date.now(),
    });
  };

  const cancel = () => {
    clearTimer();
    isPendingRef.current = false;
  };

  const flushRef = useRef(flush);
  flushRef.current = flush;
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;

  useEffect(() => {
    if (!type) {
      flushRef.current();
      return;
    }

    isPendingRef.current = true;
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      flushRef.current();
    }, delay);
  }, [type, data, revisionId, step, delay]);

  useEffect(() => {
    return () => flushRef.current();
  }, []);

  return { cancel: () => cancelRef.current() };
}
