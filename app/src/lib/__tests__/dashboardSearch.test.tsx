// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardSearch } from "@/lib/dashboardFilters";
import {
  parseDashboardSearch,
  useDashboardSearch,
  usePageSelection,
} from "@/lib/dashboardFilters";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function renderSearch(initial: DashboardSearch) {
  const commit = vi.fn();
  const view = renderHook(({ search }) => useDashboardSearch(search, commit), {
    initialProps: { search: initial },
  });
  const rerenderWithSearch = (search: DashboardSearch) =>
    view.rerender({ search });

  return { ...view, rerenderWithSearch };
}

describe("useDashboardSearch", () => {
  it("preserves newer input when an earlier search update arrives", () => {
    const { result, rerenderWithSearch } = renderSearch({});

    act(() => result.current.updateFilters({ username: "ab" }));
    act(() => vi.advanceTimersToNextTimer());
    act(() => result.current.updateFilters({ username: "abc" }));

    rerenderWithSearch({ username: "ab" });
    expect(result.current.filters.username).toBe("abc");

    act(() => vi.runOnlyPendingTimers());
  });

  it("replaces local filters when the external search changes", () => {
    const { result, rerenderWithSearch } = renderSearch({ username: "ab" });

    rerenderWithSearch({ status: ["active"], page: 3 });
    expect(result.current.filters).toEqual({ status: ["active"] });

    act(() => vi.runOnlyPendingTimers());
  });
});

describe("usePageSelection", () => {
  it("starts empty when a new page of rows arrives", () => {
    const first = { data: [] };
    const view = renderHook(({ page }) => usePageSelection(page), {
      initialProps: { page: first },
    });

    act(() => view.result.current[1](new Set(["alice"])));
    expect([...view.result.current[0]]).toEqual(["alice"]);

    view.rerender({ page: first });
    expect([...view.result.current[0]]).toEqual(["alice"]);

    view.rerender({ page: { data: [] } });
    expect(view.result.current[0].size).toBe(0);
  });
});

describe("parseDashboardSearch", () => {
  it("normalizes numeric filter text and rejects invalid page values", () => {
    expect(
      parseDashboardSearch({ username: 123, status: ["active"], page: 2 })
    ).toEqual({ username: "123", status: ["active"], page: 2 });
    expect(parseDashboardSearch({ page: 1 })).toEqual({});
    expect(parseDashboardSearch({ page: "x" })).toEqual({});
    expect(parseDashboardSearch({ page: 2.5 })).toEqual({});
  });
});
