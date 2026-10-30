// @vitest-environment jsdom
import { useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type {
  AssignmentTable,
  DashboardRoleRow,
  MemberRow,
} from "@/lib/api/dashboard";
import type { DashboardFilters } from "@/lib/dashboardFilters";
import { dashboardQuery } from "@/lib/dashboardFilters";
import { MembersTable, memberColumns } from "@/components/tables/MembersTable";
import { RolesTable, roleColumns } from "@/components/tables/RolesTable";
import {
  AssignmentsTable,
  assignmentColumns,
} from "@/components/tables/AssignmentsTable";

const members: Array<MemberRow> = [
  {
    id: "alice",
    username: "alice",
    display_name: "Alice Smith",
    bio: "Physics",
    status: "active",
    date_created: "2026-09-01T12:00:00",
    date_updated: "2026-09-15T12:00:00",
  },
  {
    id: "bob",
    username: "bob",
    display_name: null,
    bio: null,
    status: "inactive",
    date_created: "2026-09-10T12:00:00",
    date_updated: "2026-09-15T12:00:00",
  },
];
const roles: DashboardRoleRow = members.map((member, index) => ({
  ...member,
  roles: index ? [] : ["verifier", "moderator"],
}));

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
    time_left: null,
    date_created: "2026-09-01T12:00:00",
    date_updated: "2026-09-15T12:00:00",
  },
  {
    id: "alice",
    panel_id: "two",
    username: "alice",
    title: "Algebra",
    change_summary: "Add examples",
    status: "completed",
    user_status: "active",
    type: "guide_edit",
    time_left: "2026-09-10T12:00:00",
    date_created: "2026-09-10T12:00:00",
    date_updated: "2026-09-15T12:00:00",
  },
];

const columnsFor = {
  members: memberColumns,
  roles: roleColumns,
  assignments: assignmentColumns,
};

function Dashboard({
  table,
  empty = false,
}: {
  table: "members" | "roles" | "assignments";
  empty?: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [filters, setFilters] = useState<DashboardFilters>({});
  const props = {
    selectedIds,
    setSelectedIds,
    filters,
    onFiltersChange: (changes: DashboardFilters) =>
      setFilters((current) => ({ ...current, ...changes })),
  };
  return (
    <>
      <output aria-label="Selected rows">
        {[...selectedIds].sort().join(",")}
      </output>
      <output aria-label="Query">
        {JSON.stringify(dashboardQuery(columnsFor[table], filters))}
      </output>
      {table === "members" ? (
        <MembersTable MemberData={empty ? [] : members} {...props} />
      ) : table === "roles" ? (
        <RolesTable roleData={empty ? [] : roles} {...props} />
      ) : (
        <AssignmentsTable
          assignmentsData={empty ? [] : assignments}
          {...props}
        />
      )}
    </>
  );
}

function readRenderedQuery(): Record<string, string | Array<string>> {
  return JSON.parse(screen.getByLabelText("Query").textContent);
}

function openFilter(label: string) {
  fireEvent.click(screen.getByRole("button", { name: `Filter ${label}` }));
  return screen.getByRole("dialog", { name: `Filter ${label}` });
}

function closeFilter() {
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
}

afterEach(cleanup);

it("sends a trimmed member search and drops it when cleared", () => {
  render(<Dashboard table="members" />);

  openFilter("Display Name");
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "  SMITH " },
  });
  expect(readRenderedQuery().display_name).toBe("SMITH");

  closeFilter();
  fireEvent.click(
    screen.getByRole("button", { name: "Clear Display Name filter" })
  );
  expect(readRenderedQuery()).not.toHaveProperty("display_name");
});

it("combines member text and status filters", () => {
  render(<Dashboard table="members" />);

  openFilter("Username");
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "alice" },
  });
  closeFilter();

  const popup = openFilter("Status");
  fireEvent.click(within(popup).getByRole("checkbox", { name: "inactive" }));
  expect(readRenderedQuery()).toMatchObject({
    username: "alice",
    status: ["inactive"],
  });

  closeFilter();
  fireEvent.click(screen.getByRole("button", { name: "Clear Status filter" }));
  expect(readRenderedQuery()).not.toHaveProperty("status");
  expect(readRenderedQuery().username).toBe("alice");
});

it("sends picked days as local midnights, the end day included", () => {
  render(<Dashboard table="members" />);

  openFilter("Date Created");
  for (const bound of ["from", "to"]) {
    fireEvent.click(
      screen.getByRole("button", { name: `Date Created ${bound}` })
    );
    fireEvent.change(screen.getByPlaceholderText("MM"), {
      target: { value: "09" },
    });
    fireEvent.change(screen.getByPlaceholderText("DD"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByPlaceholderText("YYYY"), {
      target: { value: "2026" },
    });
    const dialogs = screen.getAllByRole("dialog");
    fireEvent.keyDown(dialogs[dialogs.length - 1], { key: "Escape" });
  }

  expect(readRenderedQuery()).toMatchObject({
    date_created_from: new Date(2026, 8, 10).toISOString(),
    date_created_to: new Date(2026, 8, 11).toISOString(),
  });

  closeFilter();
  fireEvent.click(
    screen.getByRole("button", { name: "Clear Date Created filter" })
  );
  expect(readRenderedQuery()).not.toHaveProperty("date_created_from");
  expect(readRenderedQuery()).not.toHaveProperty("date_created_to");
});

it("sends picked roles to the query", () => {
  render(<Dashboard table="roles" />);

  openFilter("Roles");
  fireEvent.click(screen.getByRole("checkbox", { name: "moderator" }));
  expect(readRenderedQuery().roles).toEqual(["moderator"]);
});

it("selects or deselects every role row on the page", () => {
  render(<Dashboard table="roles" />);

  fireEvent.click(screen.getByRole("checkbox", { name: "Select all users" }));
  expect(screen.getByLabelText("Selected rows").textContent).toBe("alice,bob");

  fireEvent.click(screen.getByRole("checkbox", { name: "Select all users" }));
  expect(screen.getByLabelText("Selected rows").textContent).toBe("");
});

it.each([
  { table: "roles", label: "Roles", choice: "No roles", key: "roles" },
  { table: "roles", label: "Status", choice: "No status", key: "status" },
  { table: "members", label: "Status", choice: "No Status", key: "status" },
  {
    table: "assignments",
    label: "Assignee Status",
    choice: "No status.",
    key: "user_status",
  },
] as const)(
  "encodes $choice as none for $table.$key",
  ({ table, label, choice, key }) => {
    render(<Dashboard table={table} />);
    const popup = openFilter(label);

    fireEvent.click(within(popup).getByRole("checkbox", { name: choice }));
    expect(readRenderedQuery()[key]).toEqual(["none"]);
  }
);

it("selects assignments of the same user one panel at a time", () => {
  render(<Dashboard table="assignments" />);

  fireEvent.click(
    screen.getByRole("checkbox", { name: "Select alice - Gravity" })
  );
  expect(screen.getByLabelText("Selected rows").textContent).toBe("alice:one");

  fireEvent.click(
    screen.getByRole("checkbox", { name: "Select all assignments" })
  );
  expect(screen.getByLabelText("Selected rows").textContent).toBe(
    "alice:one,alice:two"
  );
});

it("combines assignment type and status filters", () => {
  render(<Dashboard table="assignments" />);

  openFilter("Type");
  fireEvent.click(screen.getByRole("checkbox", { name: "guide_edit" }));
  closeFilter();

  openFilter("Status");
  fireEvent.click(screen.getByRole("checkbox", { name: "assigned" }));
  expect(readRenderedQuery()).toMatchObject({
    type: ["guide_edit"],
    status: ["assigned"],
  });
});

describe.each(["members", "roles", "assignments"] as const)(
  "%s table",
  (table) => {
    it("handles an empty page without selecting any rows", () => {
      render(<Dashboard table={table} empty />);

      fireEvent.click(screen.getByRole("checkbox", { name: /^Select all/ }));
      expect(screen.getByLabelText("Selected rows").textContent).toBe("");
    });
  }
);

it("sorts text in both directions and clears the active heading", () => {
  render(<Dashboard table="members" />);
  const popup = openFilter("Username");

  fireEvent.click(within(popup).getByRole("button", { name: "Sort Z - A" }));
  expect(readRenderedQuery()).toMatchObject({
    sortBy: "username",
    sortDirection: "desc",
  });

  fireEvent.click(within(popup).getByRole("button", { name: "Sort A - Z" }));
  expect(readRenderedQuery()).toMatchObject({
    sortBy: "username",
    sortDirection: "asc",
  });
  closeFilter();

  fireEvent.click(
    screen.getByRole("button", { name: "Clear Username filter" })
  );
  expect(readRenderedQuery()).not.toHaveProperty("sortBy");
  expect(
    screen.queryByRole("button", { name: "Clear Username filter" })
  ).toBeNull();
});

it("keeps another column's sort when a text filter is cleared", () => {
  render(<Dashboard table="members" />);

  openFilter("Username");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "o" } });
  closeFilter();

  const popup = openFilter("Date Created");
  fireEvent.click(within(popup).getByRole("button", { name: "Sort Newest" }));
  closeFilter();

  fireEvent.click(
    screen.getByRole("button", { name: "Clear Username filter" })
  );
  expect(readRenderedQuery()).not.toHaveProperty("username");
  expect(readRenderedQuery()).toMatchObject({
    sortBy: "date_created",
    sortDirection: "desc",
  });

  openFilter("Date Created");
  fireEvent.click(screen.getByRole("button", { name: "Sort Oldest" }));
  expect(readRenderedQuery().sortDirection).toBe("asc");
  closeFilter();

  fireEvent.click(
    screen.getByRole("button", { name: "Clear Date Created filter" })
  );
  expect(readRenderedQuery()).not.toHaveProperty("sortBy");
});

it("combines multiple choices within a column", () => {
  render(<Dashboard table="members" />);

  openFilter("Status");
  fireEvent.click(screen.getByRole("checkbox", { name: "active" }));
  expect(readRenderedQuery().status).toEqual(["active"]);

  fireEvent.click(screen.getByRole("checkbox", { name: "inactive" }));
  expect(readRenderedQuery().status).toEqual(
    expect.arrayContaining(["active", "inactive"])
  );
  expect(readRenderedQuery().status).toHaveLength(2);

  fireEvent.click(screen.getByRole("checkbox", { name: "active" }));
  expect(readRenderedQuery().status).toEqual(["inactive"]);
});

it.each([
  ["members", "Status", ["active", "inactive", "suspended"]],
  [
    "roles",
    "Roles",
    ["verifier", "moderator", "curator", "admin", "official", "No roles"],
  ],
  ["assignments", "Status", ["assigned", "recused", "replaced", "completed"]],
  [
    "assignments",
    "Type",
    ["guide_publish", "guide_edit", "official_publish", "official_edit"],
  ],
] as const)(
  "shows all %s %s choices without loaded rows",
  (table, label, options) => {
    render(<Dashboard table={table} empty />);
    const popup = openFilter(label);
    for (const name of options) {
      expect(within(popup).getByRole("checkbox", { name })).toBeDefined();
    }
  }
);
