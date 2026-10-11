// @vitest-environment jsdom
import { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssignmentTable } from "@/lib/api/dashboard";
import type { DashboardColumn, DashboardFilters } from "@/lib/dashboardFilters";
import { filterDashboardRows } from "@/lib/dashboardFilters";
import { AssignmentsTable } from "@/components/tables/AssignmentsTable";

const now = Date.parse("2026-09-16T12:00:00Z");
const deadline = (hours: number) =>
  new Date(now + hours * 3600000).toISOString();
const rows = [-1, 0, 0.5, 1, 4, 12, 24, 25].map((hours) => ({
  id: String(hours),
  deadline: deadline(hours),
}));
const columns: Array<DashboardColumn<{ id: string; deadline: string | null }>> =
  [
    {
      key: "time_left",
      label: "Time Left",
      kind: "duration",
      value: (row) => row.deadline,
    },
  ];
const allRows = [
  ...rows,
  { id: "missing", deadline: null },
  { id: "invalid", deadline: "invalid" },
];
const ids = (filters: DashboardFilters) =>
  filterDashboardRows(allRows, columns, filters, now).map((row) => row.id);

describe("Time Left range boundaries", () => {
  it.each([
    ["expired", ["-1"]],
    ["under1", ["0", "0.5"]],
    ["1to4", ["1"]],
    ["4to12", ["4"]],
    ["12to24", ["12", "24"]],
  ])("matches %s without overlapping adjacent presets", (mode, expected) => {
    expect(ids({ time_left: mode })).toEqual(expected);
  });
  it("Any includes missing deadlines and deadlines beyond 24 hours", () => {
    expect(ids({})).toEqual(allRows.map((row) => row.id));
  });
  it.each([
    ["0.5", "4", ["0.5", "1", "4"]],
    ["4", "4", ["4"]],
    ["", "1", ["0", "0.5", "1"]],
    ["24", "", ["24", "25"]],
    ["", "", ["0", "0.5", "1", "4", "12", "24", "25"]],
    ["4", "1", []],
    ["-1", "4", []],
    ["NaN", "4", []],
    ["0", "Infinity", []],
  ])("validates custom range %s to %s", (min, max, expected) => {
    expect(
      ids({ time_left: "custom", "time_left.min": min, "time_left.max": max })
    ).toEqual(expected);
  });
  it("preserves deadline sorting without mutating source rows", () => {
    const before = [...allRows];
    const sorted = filterDashboardRows(
      allRows,
      columns,
      { sortBy: "time_left", sortDirection: "desc" },
      now
    );
    expect(sorted.map((row) => row.id)).toEqual([
      "25",
      "24",
      "12",
      "4",
      "1",
      "0.5",
      "0",
      "-1",
      "missing",
      "invalid",
    ]);
    expect(allRows).toEqual(before);
  });
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
    time_left: deadline(0.5),
    date_created: deadline(-24),
    date_updated: deadline(-1),
  },
  {
    id: "bob",
    panel_id: "two",
    username: "bob",
    title: "Algebra",
    change_summary: "Add examples",
    status: "assigned",
    user_status: "active",
    type: "guide_publish",
    time_left: deadline(2),
    date_created: deadline(-24),
    date_updated: deadline(-1),
  },
];
function Dashboard({ data = assignments }: { data?: AssignmentTable }) {
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  return (
    <>
      <output aria-label="Selected rows">{[...selectedIds].join(",")}</output>
      <AssignmentsTable
        assignmentsData={data}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
      />
    </>
  );
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

it("shows every preset and restores rows when Any is selected", () => {
  render(<Dashboard />);
  const popup = openFilter();
  expect(within(popup).getAllByRole("radio")).toHaveLength(7);
  fireEvent.click(screen.getByRole("radio", { name: "< 1 hr" }));
  expect(document.querySelectorAll("tbody tr")).toHaveLength(1);
  expect(document.querySelector("tbody")?.textContent).toContain("alice");
  fireEvent.click(screen.getByRole("radio", { name: "Any" }));
  expect(document.querySelectorAll("tbody tr")).toHaveLength(2);
});

it("filters custom decimal hours, validates reversed bounds and clears the range", () => {
  render(<Dashboard />);
  openFilter();
  fireEvent.click(screen.getByRole("radio", { name: "Custom range" }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum hours" }), {
    target: { value: "0.5" },
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Maximum hours" }), {
    target: { value: "0.5" },
  });
  expect(document.querySelectorAll("tbody tr")).toHaveLength(1);
  expect(document.querySelector("tbody")?.textContent).toContain("alice");
  fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum hours" }), {
    target: { value: "2" },
  });
  expect(screen.getByRole("alert")).toBeDefined();
  expect(screen.getByText("No data matches these filters")).toBeDefined();
  closeFilter();
  fireEvent.click(
    screen.getByRole("button", { name: "Clear Time Left filter" })
  );
  expect(document.querySelectorAll("tbody tr")).toHaveLength(2);
  openFilter();
  fireEvent.click(screen.getByRole("radio", { name: "Custom range" }));
  expect(
    screen.getByRole("spinbutton", { name: "Minimum hours" })
  ).toHaveProperty("value", "");
});

it("combines Time Left with another column and prunes hidden selections", () => {
  render(<Dashboard />);
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Select all assignments" })
  );
  openFilter();
  fireEvent.click(screen.getByRole("radio", { name: "< 1 hr" }));
  expect(screen.getByLabelText("Selected rows").textContent).toBe("alice:one");
  closeFilter();
  fireEvent.click(screen.getByRole("button", { name: "Filter Title" }));
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "Algebra" },
  });
  expect(screen.getByText("No data matches these filters")).toBeDefined();
  expect(screen.getByLabelText("Selected rows").textContent).toBe("");
});

it("updates active ranges as time passes and removes expired selections", () => {
  render(
    <Dashboard
      data={[
        { ...assignments[0], time_left: new Date(now + 500).toISOString() },
      ]}
    />
  );
  openFilter();
  fireEvent.click(screen.getByRole("radio", { name: "< 1 hr" }));
  closeFilter();
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Select all assignments" })
  );
  expect(screen.getByLabelText("Selected rows").textContent).toBe("alice:one");
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(screen.getByText("No data matches these filters")).toBeDefined();
  expect(screen.getByLabelText("Selected rows").textContent).toBe("");
  openFilter();
  fireEvent.click(screen.getByRole("radio", { name: "Expired" }));
  expect(document.querySelector("tbody")?.textContent).toContain("alice");
});
