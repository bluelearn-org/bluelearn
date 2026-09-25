import { useEffect, useState } from "react";

export type DashboardColumn<T> = {
  key: string;
  label: string;
  kind?: "text" | "choice" | "date" | "duration";
  options?: ReadonlyArray<string>;
  value: (row: T) => string | Array<string> | null | undefined;
};

export type DashboardFilters = Record<
  string,
  string | Array<string> | undefined
>;

export function filterText(value: DashboardFilters[string]) {
  return typeof value === "string" ? value : "";
}

export const timeLeftOptions = [
  { value: "", label: "Any" },
  { value: "expired", label: "Expired" },
  { value: "under1", label: "< 1 hr" },
  { value: "1to4", label: "1-4 hrs" },
  { value: "4to12", label: "4-12 hrs" },
  { value: "12to24", label: "12-24 hrs" },
  { value: "custom", label: "Custom range" },
] as const;

export function validHours(value: string) {
  return (
    value.trim() === "" ||
    (Number.isFinite(Number(value)) && Number(value) >= 0)
  );
}

function matchesTimeLeft(
  value: unknown,
  key: string,
  filters: DashboardFilters,
  now: number
) {
  const mode = filterText(filters[key]);

  if (!mode) return true;

  const remaining =
    (new Date(typeof value === "string" ? value : "").getTime() - now) /
    3600000;

  if (!Number.isFinite(remaining)) return false;
  switch (mode) {
    case "expired":
      return remaining < 0;
    case "under1":
      return remaining >= 0 && remaining < 1;
    case "1to4":
      return remaining >= 1 && remaining < 4;
    case "4to12":
      return remaining >= 4 && remaining < 12;
    case "12to24":
      return remaining >= 12 && remaining <= 24;
    case "custom": {
      const min = filterText(filters[`${key}.min`]);
      const max = filterText(filters[`${key}.max`]);

      if (!validHours(min) || !validHours(max)) return false;
      return (
        remaining >= (min.trim() ? Number(min) : 0) &&
        (!max.trim() || remaining <= Number(max))
      );
    }
    default:
      return true;
  }
}

export function filterDashboardRows<T>(
  rows: Array<T>,
  columns: Array<DashboardColumn<T>>,
  filters: DashboardFilters,
  now = Date.now()
) {
  const filtered = rows.filter((row) =>
    columns.every((column) => {
      const value = column.value(row);
      if (column.kind === "duration") {
        return matchesTimeLeft(value, column.key, filters, now);
      }

      if (column.kind === "date") {
        const from = filterText(filters[`${column.key}.from`]);
        const to = filterText(filters[`${column.key}.to`]);
        if (!from && !to) return true;

        const date = new Date(typeof value === "string" ? value : "");

        if (Number.isNaN(date.getTime())) return false;

        // Match the local calendar date shown in the table, including both ends.
        const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        return (!from || day >= from) && (!to || day <= to);
      }

      const values = Array.isArray(value) ? value : [value ?? ""];
      if (column.kind === "choice") {
        const selected = filters[column.key];
        return (
          !Array.isArray(selected) ||
          selected.length === 0 ||
          selected.some((choice) => values.includes(choice))
        );
      }

      const query = filterText(filters[column.key]);

      if (!query.trim()) return true;

      return values.some((text) =>
        text.toLowerCase().includes(query.trim().toLowerCase())
      );
    })
  );

  const column = columns.find((candidate) => candidate.key === filters.sortBy);

  if (
    !column ||
    (filters.sortDirection !== "asc" && filters.sortDirection !== "desc")
  ) {
    return filtered;
  }

  const direction = filters.sortDirection === "asc" ? 1 : -1;

  return filtered.sort((left, right) => {
    const a = column.value(left);
    const b = column.value(right);
    if (column.kind === "date" || column.kind === "duration") {
      const aTime = new Date(typeof a === "string" ? a : "").getTime();
      const bTime = new Date(typeof b === "string" ? b : "").getTime();
      if (Number.isNaN(aTime)) return Number.isNaN(bTime) ? 0 : 1;
      if (Number.isNaN(bTime)) return -1;
      return (aTime - bTime) * direction;
    }

    return (
      String(a ?? "").localeCompare(String(b ?? ""), undefined, {
        sensitivity: "base",
      }) * direction
    );
  });
}

export function useDashboardFilters<T>(
  rows: Array<T>,
  columns: Array<DashboardColumn<T>>,
  selectedIds: Set<string>,
  setSelectedIds: (ids: Set<string>) => void,
  getKey: (row: T) => string
) {
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [now, setNow] = useState(Date.now);

  const liveDeadlineFilter = columns.some(
    (column) => column.kind === "duration" && Boolean(filters[column.key])
  );

  useEffect(() => {
    if (!liveDeadlineFilter) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [liveDeadlineFilter]);

  const visibleRows = filterDashboardRows(rows, columns, filters, now);

  useEffect(() => {
    if (!liveDeadlineFilter) return;
    const visibleIds = new Set(visibleRows.map(getKey));
    const next = new Set([...selectedIds].filter((id) => visibleIds.has(id)));
    if (next.size !== selectedIds.size) setSelectedIds(next);
  }, [liveDeadlineFilter, visibleRows, getKey, selectedIds, setSelectedIds]);

  function updateFilters(changes: DashboardFilters) {
    const nextFilters = { ...filters, ...changes };
    const nextNow = Date.now();
    setNow(nextNow);
    setFilters(nextFilters);

    const visibleIds = new Set(
      filterDashboardRows(rows, columns, nextFilters, nextNow).map(getKey)
    );

    // Bulk dashboard actions must not include rows hidden by a new filter.
    setSelectedIds(
      new Set([...selectedIds].filter((id) => visibleIds.has(id)))
    );
  }

  return { filters, visibleRows, updateFilters };
}
