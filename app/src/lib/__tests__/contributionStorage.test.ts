// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GuideContribution,
  ObjectiveContribution,
  VariantContribution,
} from "@/types/contributions";
import {
  clearAllStoredDrafts,
  clearStoredDraft,
  createLocalDraftId,
  getStoredDraft,
  hasStoredDraft,
  setStoredDraft,
  useDebouncedContributionSave,
} from "@/lib/contributionStorage";

const STORAGE_KEY = "bluelearn:contrib:drafts";

const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

const sampleGuide: GuideContribution = {
  type: "theoretical",
  title: "Understanding Persistent State",
  summary: "A short summary",
  body: "# Markdown Content",
  subjects: ["sub-1"],
  newSubjects: [],
  prereqs: [],
  todoPrereqs: [],
  disclaimers: [],
};

const sampleVariant: VariantContribution = {
  type: "theoretical",
  title: "Variant Draft",
  summary: "A short summary",
  baseGuide: "base-guide-slug",
  subjects: ["sub-1"],
  newSubjects: [],
  body: "# Markdown Content",
};

const sampleObjective: ObjectiveContribution = {
  title: "Objective Draft",
  summary: "A short summary",
  changeSummary: "Initial draft",
  targets: ["target-1"],
  featuredSubObjective: "sub-obj-1",
  subObjectives: [],
  subjects: ["sub-1"],
};

describe("contributionStorage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "localStorage", {
      value: createLocalStorageMock(),
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves and retrieves a guide draft from localStorage", () => {
    const localDraftId = createLocalDraftId();

    setStoredDraft({
      localDraftId,
      type: "guide",
      data: sampleGuide,
      revisionId: "rev-123",
      step: "guide-details",
      updatedAt: Date.now(),
    });

    expect(hasStoredDraft(localDraftId)).toBe(true);

    const stored = getStoredDraft(localDraftId, "guide");
    expect(stored).not.toBeNull();
    expect(stored?.data.title).toBe("Understanding Persistent State");
    expect(stored?.revisionId).toBe("rev-123");
    expect(stored?.step).toBe("guide-details");
  });

  it("clears a stored draft", () => {
    const localDraftId = createLocalDraftId();

    setStoredDraft({
      localDraftId,
      type: "variant",
      data: sampleVariant,
      revisionId: null,
      updatedAt: Date.now(),
    });

    expect(hasStoredDraft(localDraftId)).toBe(true);

    clearStoredDraft(localDraftId);

    expect(hasStoredDraft(localDraftId)).toBe(false);
    expect(getStoredDraft(localDraftId, "variant")).toBeNull();
  });

  it("clears all stored drafts with clearAllStoredDrafts", () => {
    const guideId = createLocalDraftId();
    const variantId = createLocalDraftId();
    const objectiveId = createLocalDraftId();

    setStoredDraft({
      localDraftId: guideId,
      type: "guide",
      data: sampleGuide,
      revisionId: "rev-g",
      updatedAt: Date.now(),
    });
    setStoredDraft({
      localDraftId: variantId,
      type: "variant",
      data: sampleVariant,
      revisionId: "rev-v",
      updatedAt: Date.now(),
    });
    setStoredDraft({
      localDraftId: objectiveId,
      type: "objective",
      data: sampleObjective,
      revisionId: "rev-o",
      updatedAt: Date.now(),
    });

    expect(hasStoredDraft(guideId)).toBe(true);
    expect(hasStoredDraft(variantId)).toBe(true);
    expect(hasStoredDraft(objectiveId)).toBe(true);

    clearAllStoredDrafts();

    expect(hasStoredDraft(guideId)).toBe(false);
    expect(hasStoredDraft(variantId)).toBe(false);
    expect(hasStoredDraft(objectiveId)).toBe(false);
    expect(getStoredDraft(guideId, "guide")).toBeNull();
    expect(getStoredDraft(variantId, "variant")).toBeNull();
    expect(getStoredDraft(objectiveId, "objective")).toBeNull();
  });

  it("safely handles corrupted JSON in localStorage", () => {
    window.localStorage.setItem(STORAGE_KEY, "{invalid-json");
    expect(getStoredDraft(createLocalDraftId(), "guide")).toBeNull();
  });

  it("debounces saves and flushes pending changes on unmount", () => {
    const localDraftId = createLocalDraftId();

    const initialData: GuideContribution = {
      type: "theoretical",
      title: "Draft Initial",
      summary: "",
      body: "",
      subjects: [],
      newSubjects: [],
      prereqs: [],
      todoPrereqs: [],
      disclaimers: [],
    };

    const { rerender, unmount } = renderHook(
      ({ data, step }: { data: GuideContribution; step?: string }) =>
        useDebouncedContributionSave(
          localDraftId,
          "guide",
          data,
          "rev-1",
          step,
          300
        ),
      {
        initialProps: {
          data: initialData,
          step: "guide-details",
        },
      }
    );

    // Initial render should not have written immediately before timer
    expect(hasStoredDraft(localDraftId)).toBe(false);

    // Advance timer past delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(hasStoredDraft(localDraftId)).toBe(true);
    expect(getStoredDraft(localDraftId, "guide")?.data.title).toBe(
      "Draft Initial"
    );

    // Update data with rapid changes
    const updatedData1: GuideContribution = {
      ...initialData,
      title: "Draft Update 1",
    };
    rerender({
      data: updatedData1,
      step: "guide-details",
    });

    // Not yet updated before delay
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(getStoredDraft(localDraftId, "guide")?.data.title).toBe(
      "Draft Initial"
    );

    const updatedData2: GuideContribution = {
      ...initialData,
      title: "Draft Update 2",
    };
    rerender({
      data: updatedData2,
      step: "content",
    });

    // Unmount before timer finishes flushes pending changes
    unmount();

    const stored = getStoredDraft(localDraftId, "guide");
    expect(stored?.data.title).toBe("Draft Update 2");
    expect(stored?.step).toBe("content");
  });
});
