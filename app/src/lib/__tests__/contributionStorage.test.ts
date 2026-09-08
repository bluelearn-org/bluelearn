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
  getStoredDraft,
  hasStoredDraft,
  setStoredDraft,
  useDebouncedContributionSave,
} from "@/lib/contributionStorage";

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
    const sampleGuide: GuideContribution = {
      type: "theoretical",
      title: "Understanding Persistent State",
      summary: "A short summary",
      body: "# Markdown Content",
      subjects: ["sub-1"],
      newSubjects: [],
      prereqs: [],
      todoPrereqs: [],
    };

    setStoredDraft("guide", {
      data: sampleGuide,
      revisionId: "rev-123",
      step: "guide-details",
      updatedAt: Date.now(),
    });

    expect(hasStoredDraft("guide")).toBe(true);

    const stored = getStoredDraft<GuideContribution>("guide");
    expect(stored).not.toBeNull();
    expect(stored?.data.title).toBe("Understanding Persistent State");
    expect(stored?.revisionId).toBe("rev-123");
    expect(stored?.step).toBe("guide-details");
  });

  it("clears a stored draft", () => {
    setStoredDraft("variant", {
      data: {} as VariantContribution,
      revisionId: null,
      updatedAt: Date.now(),
    });

    expect(hasStoredDraft("variant")).toBe(true);
    clearStoredDraft("variant");
    expect(hasStoredDraft("variant")).toBe(false);
    expect(getStoredDraft("variant")).toBeNull();
  });

  it("clears all stored drafts with clearAllStoredDrafts", () => {
    setStoredDraft("guide", {
      data: { title: "Guide Draft" } as GuideContribution,
      revisionId: "rev-g",
      updatedAt: Date.now(),
    });
    setStoredDraft("variant", {
      data: { title: "Variant Draft" } as VariantContribution,
      revisionId: "rev-v",
      updatedAt: Date.now(),
    });
    setStoredDraft("objective", {
      data: { title: "Objective Draft" } as ObjectiveContribution,
      revisionId: "rev-o",
      updatedAt: Date.now(),
    });

    expect(hasStoredDraft("guide")).toBe(true);
    expect(hasStoredDraft("variant")).toBe(true);
    expect(hasStoredDraft("objective")).toBe(true);

    clearAllStoredDrafts();

    expect(hasStoredDraft("guide")).toBe(false);
    expect(hasStoredDraft("variant")).toBe(false);
    expect(hasStoredDraft("objective")).toBe(false);
    expect(getStoredDraft("guide")).toBeNull();
    expect(getStoredDraft("variant")).toBeNull();
    expect(getStoredDraft("objective")).toBeNull();
  });

  it("safely handles corrupted JSON in localStorage", () => {
    window.localStorage.setItem("bluelearn:contrib:guide", "{invalid-json");
    expect(getStoredDraft("guide")).toBeNull();
  });

  it("debounces saves and flushes pending changes on unmount", () => {
    const initialData: GuideContribution = {
      type: "theoretical",
      title: "Draft Initial",
      summary: "",
      body: "",
      subjects: [],
      newSubjects: [],
      prereqs: [],
      todoPrereqs: [],
    };

    const { rerender, unmount } = renderHook(
      ({ data, step }: { data: GuideContribution; step?: string }) =>
        useDebouncedContributionSave("guide", data, "rev-1", step, 300),
      {
        initialProps: {
          data: initialData,
          step: "guide-details",
        },
      }
    );

    // Initial render should not have written immediately before timer
    expect(hasStoredDraft("guide")).toBe(false);

    // Advance timer past delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(hasStoredDraft("guide")).toBe(true);
    expect(getStoredDraft<GuideContribution>("guide")?.data.title).toBe(
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
    expect(getStoredDraft<GuideContribution>("guide")?.data.title).toBe(
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

    const stored = getStoredDraft<GuideContribution>("guide");
    expect(stored?.data.title).toBe("Draft Update 2");
    expect(stored?.step).toBe("content");
  });
});
