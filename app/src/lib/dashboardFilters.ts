import { useEffect, useRef, useState } from "react";

export type DashboardColumn = {
  key: string;
  label: string;
  kind?: "text" | "choice" | "date" | "duration";
  options?: ReadonlyArray<string>;
  // The choice that means "no value" (no status, no roles). The API calls it "none".
  noneOption?: string;
  // The order the table opens with while no column sort is picked. At most one
  // column per table declares it; without one the API falls back to oldest first.
  defaultSort?: "asc" | "desc";
};

export type DashboardFilters = Record<
  string,
  string | Array<string> | undefined
>;

// The route loader reads filters from the URL; local-only edits would not reload rows.
export type DashboardSearch = {
  page?: number;
  [key: string]: string | Array<string> | number | undefined;
};

export const DASHBOARD_PAGE_SIZE = 50;

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

const HOUR = 3600000;

// Presets exclude their upper bound; custom ranges include the selected maximum.
type HoursLeft = { from?: number; before?: number; through?: number };

const timeLeftPresets: Record<string, HoursLeft> = {
  expired: { before: 0 },
  under1: { from: 0, before: 1 },
  "1to4": { from: 1, before: 4 },
  "4to12": { from: 4, before: 12 },
  "12to24": { from: 12, through: 24 },
};

// An empty range: an invalid custom range matches no rows, and ColumnFilter
// shows the alert that says why.
const NOTHING: HoursLeft = { from: 0, before: 0 };

function hoursLeft(key: string, filters: DashboardFilters): HoursLeft | null {
  const mode = filterText(filters[key]);
  if (mode !== "custom") return timeLeftPresets[mode] ?? null;

  const min = filterText(filters[`${key}.min`]).trim();
  const max = filterText(filters[`${key}.max`]).trim();
  const reversed = min !== "" && max !== "" && Number(min) > Number(max);

  if (!validHours(min) || !validHours(max) || reversed) return NOTHING;
  return {
    from: min ? Number(min) : 0,
    through: max ? Number(max) : undefined,
  };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function localDayStart(day: string, offset = 0) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date + offset);
}

function searchFilters(search: DashboardSearch): DashboardFilters {
  const filters: DashboardFilters = {};
  for (const [key, value] of Object.entries(search)) {
    if (key !== "page" && typeof value !== "number") filters[key] = value;
  }
  return filters;
}

// URL equality uses JSON keys; normalize empty values and key order before comparison.
function cleanFilters(filters: DashboardFilters): DashboardFilters {
  const clean: DashboardFilters = {};
  for (const key of Object.keys(filters).sort()) {
    const value = filters[key];
    if (Array.isArray(value) ? value.length > 0 : value) clean[key] = value;
  }
  return clean;
}

export function parseDashboardSearch(
  raw: Record<string, unknown>
): DashboardSearch {
  const search: DashboardSearch = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === "page") {
      const page = Number(value);
      if (Number.isInteger(page) && page > 1) search.page = page;
    } else if (Array.isArray(value)) {
      search[key] = value.map(String);
    } else if (typeof value === "string" || typeof value === "number") {
      search[key] = String(value);
    }
  }
  return search;
}

// Only the browser knows the user's timezone; send date filters to the API as instants.
export function dashboardQuery(
  columns: ReadonlyArray<DashboardColumn>,
  search: DashboardSearch,
  now = Date.now()
) {
  const filters = searchFilters(search);
  const query: Record<string, string | Array<string>> = {
    page: String(search.page ?? 1),
    limit: String(DASHBOARD_PAGE_SIZE),
  };

  for (const { key, kind, noneOption } of columns) {
    if (kind === "date") {
      const from = filterText(filters[`${key}.from`]);
      const to = filterText(filters[`${key}.to`]);
      if (DAY.test(from))
        query[`${key}_from`] = localDayStart(from).toISOString();
      if (DAY.test(to)) query[`${key}_to`] = localDayStart(to, 1).toISOString();
    } else if (kind === "duration") {
      const { from, before, through } = hoursLeft(key, filters) ?? {};
      const at = (hours: number) => new Date(now + hours * HOUR);
      if (from !== undefined) query[`${key}_from`] = at(from).toISOString();
      if (before !== undefined) query[`${key}_to`] = at(before).toISOString();
      // `_to` is exclusive, so one millisecond past an inclusive bound.
      if (through !== undefined) {
        query[`${key}_to`] = new Date(at(through).getTime() + 1).toISOString();
      }
    } else if (kind === "choice") {
      const picked = filters[key];
      if (Array.isArray(picked) && picked.length > 0) {
        query[key] = picked.map((choice) =>
          choice === noneOption ? "none" : choice
        );
      }
    } else {
      const text = filterText(filters[key]).trim();
      if (text) query[key] = text;
    }
  }

  const sortBy = filterText(filters.sortBy);
  const direction = filterText(filters.sortDirection);
  const sortable = columns.some((column) => column.key === sortBy);
  if (sortable && (direction === "asc" || direction === "desc")) {
    query.sortBy = sortBy;
    query.sortDirection = direction;
  } else {
    const standing = defaultSort(columns);
    if (standing) Object.assign(query, standing);
  }

  return query;
}

// The sort a table opens with when the URL names none.
export function defaultSort(columns: ReadonlyArray<DashboardColumn>) {
  const column = columns.find((candidate) => candidate.defaultSort);
  return column?.defaultSort
    ? { sortBy: column.key, sortDirection: column.defaultSort }
    : null;
}

// Each URL update reloads the route; debounce typing to avoid a request per key.
export function useDashboardSearch(
  search: DashboardSearch,
  commit: (filters: DashboardFilters) => void
) {
  const urlKey = JSON.stringify(cleanFilters(searchFilters(search)));
  const [filters, setFilters] = useState<DashboardFilters>(
    () => JSON.parse(urlKey) as DashboardFilters
  );
  const committedKey = useRef(urlKey);
  const latestCommit = useRef(commit);
  latestCommit.current = commit;

  // An echoed local commit must not overwrite newer typing; only external search changes replace filters.
  useEffect(() => {
    if (urlKey === committedKey.current) return;
    committedKey.current = urlKey;
    setFilters(JSON.parse(urlKey) as DashboardFilters);
  }, [urlKey]);

  useEffect(() => {
    const clean = cleanFilters(filters);
    const key = JSON.stringify(clean);
    if (key === committedKey.current) return;

    const timer = setTimeout(() => {
      committedKey.current = key;
      latestCommit.current(clean);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters]);

  function updateFilters(changes: DashboardFilters) {
    setFilters((current) => ({ ...current, ...changes }));
  }

  return { filters, updateFilters };
}

// Bulk actions only touch rows on screen, so a new page, filter or sort
// starts with nothing selected.
export function usePageSelection(page: unknown) {
  const [selection, setSelection] = useState({
    page,
    ids: new Set<string>(),
  });
  const selectedIds =
    selection.page === page ? selection.ids : new Set<string>();

  function setSelectedIds(ids: Set<string>) {
    setSelection({ page, ids });
  }

  return [selectedIds, setSelectedIds] as const;
}
