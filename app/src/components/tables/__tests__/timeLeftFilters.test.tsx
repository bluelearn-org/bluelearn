// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssignmentTable } from "@/lib/api/dashboard";
import type { DashboardColumn, DashboardFilters } from "@/lib/dashboardFilters";
import { dashboardQuery } from "@/lib/dashboardFilters";
import {
  AssignmentsTable,
  assignmentColumns,
} from "@/components/tables/AssignmentsTable";

const now = Date.parse("2026-09-16T12:00:00Z");
const at = (hours: number) => new Date(now + hours * 3600000).toISOString();
const justAfter = (hours: number) =>
  new Date(now + hours * 3600000 + 1).toISOString();

const columns: Array<DashboardColumn> = [
  { key: "time_left", label: "Time Left", kind: "duration" },
];

const range = (filters: DashboardFilters) => {
  const params = dashboardQuery(columns, filters, now);
  return [params.time_left_from, params.time_left_to];
};

describe("Time Left range boundaries", () => {
  it.each([
    {
      label: "expired (no minimum, upper bound at now)",
      mode: "expired",
      bounds: [undefined, at(0)],
    },
    {
      label: "under 1 hour (0 to 1 hour)",
      mode: "under1",
      bounds: [at(0), at(1)],
    },
    { label: "1 to 4 hours", mode: "1to4", bounds: [at(1), at(4)] },
    { label: "4 to 12 hours", mode: "4to12", bounds: [at(4), at(12)] },
    {
      label: "12 to 24 hours (upper bound just after 24)",
      mode: "12to24",
      bounds: [at(12), justAfter(24)],
    },
  ])(
    "converts the $label preset to API deadline bounds",
    ({ mode, bounds }) => {
      expect(range({ time_left: mode })).toEqual(bounds);
    }
  );

  it("omits deadline bounds when no preset is selected", () => {
    expect(range({})).toEqual([undefined, undefined]);
  });

  it.each([
    {
      label: "0.5 to 4 hours",
      min: "0.5",
      max: "4",
      bounds: [at(0.5), justAfter(4)],
    },
    {
      label: "4 to 4 hours",
      min: "4",
      max: "4",
      bounds: [at(4), justAfter(4)],
    },
    {
      label: "no minimum to 1 hour",
      min: "",
      max: "1",
      bounds: [at(0), justAfter(1)],
    },
    {
      label: "24 hours with no maximum",
      min: "24",
      max: "",
      bounds: [at(24), undefined],
    },
    {
      label: "no minimum or maximum",
      min: "",
      max: "",
      bounds: [at(0), undefined],
    },
  ])(
    "converts custom range $label to API deadline bounds",
    ({ min, max, bounds }) => {
      expect(
        range({
          time_left: "custom",
          "time_left.min": min,
          "time_left.max": max,
        })
      ).toEqual(bounds);
    }
  );

  it.each([
    { label: "minimum exceeds maximum", min: "4", max: "1" },
    { label: "negative minimum", min: "-1", max: "4" },
    { label: "non-numeric minimum", min: "NaN", max: "4" },
    { label: "infinite maximum", min: "0", max: "Infinity" },
  ])(
    "returns an empty range for an invalid custom range: $label",
    ({ min, max }) => {
      expect(
        range({
          time_left: "custom",
          "time_left.min": min,
          "time_left.max": max,
        })
      ).toEqual([at(0), at(0)]);
    }
  );
});

const assignments: AssignmentTable = [
  {
    id: "alice",
    panel_id: "one",
    username: "alice",
    title: "Gravity",
    change_summary: "Explain mass",
    status: "assigned",
    user_status: "active",
    type: "guide_publish",
    time_left: at(0.5),
    date_created: at(-24),
    date_updated: at(-1),
  },
];

function Dashboard() {
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [filters, setFilters] = useState<DashboardFilters>({});
  return (
    <>
      <output aria-label="Query">
        {JSON.stringify(dashboardQuery(assignmentColumns, filters, now))}
      </output>
      <AssignmentsTable
        assignmentsData={assignments}
        filters={filters}
        onFiltersChange={(changes) =>
          setFilters((current) => ({ ...current, ...changes }))
        }
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
      />
    </>
  );
}

function readRenderedQuery(): Record<string, string | Array<string>> {
  return JSON.parse(screen.getByLabelText("Query").textContent);
}

function openFilter() {
  fireEvent.click(screen.getByRole("button", { name: "Filter Time Left" }));
  return screen.getByRole("dialog", { name: "Filter Time Left" });
}

function closeFilter() {
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("clears deadline bounds when Any is selected", () => {
  render(<Dashboard />);
  openFilter();

  fireEvent.click(screen.getByRole("radio", { name: "< 1 hr" }));
  expect(readRenderedQuery()).toMatchObject({
    time_left_from: at(0),
    time_left_to: at(1),
  });

  fireEvent.click(screen.getByRole("radio", { name: "Any" }));
  expect(readRenderedQuery()).not.toHaveProperty("time_left_from");
  expect(readRenderedQuery()).not.toHaveProperty("time_left_to");
});

it("sends custom decimal hours, alerts on reversed bounds and clears the range", () => {
  render(<Dashboard />);
  openFilter();

  fireEvent.click(screen.getByRole("radio", { name: "Custom range" }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum hours" }), {
    target: { value: "0.5" },
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Maximum hours" }), {
    target: { value: "0.5" },
  });
  expect(readRenderedQuery()).toMatchObject({
    time_left_from: at(0.5),
    time_left_to: justAfter(0.5),
  });

  fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum hours" }), {
    target: { value: "2" },
  });
  expect(screen.getByRole("alert")).toBeDefined();
  expect(readRenderedQuery()).toMatchObject({
    time_left_from: at(0),
    time_left_to: at(0),
  });

  closeFilter();
  fireEvent.click(
    screen.getByRole("button", { name: "Clear Time Left filter" })
  );
  expect(readRenderedQuery()).not.toHaveProperty("time_left_from");

  openFilter();
  fireEvent.click(screen.getByRole("radio", { name: "Custom range" }));
  expect(
    screen.getByRole("spinbutton", { name: "Minimum hours" })
  ).toHaveProperty("value", "");
});

it("combines Time Left with another column", () => {
  render(<Dashboard />);

  openFilter();
  fireEvent.click(screen.getByRole("radio", { name: "< 1 hr" }));
  closeFilter();

  fireEvent.click(screen.getByRole("button", { name: "Filter Title" }));
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "Algebra" },
  });
  expect(readRenderedQuery()).toMatchObject({
    title: "Algebra",
    time_left_from: at(0),
    time_left_to: at(1),
  });
});
