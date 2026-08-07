import { activitySortSchema } from "@bluelearn/schemas";
import type {
  ActivityFilters,
  ActivitySort,
  ActivityStatusFilter,
  ActivityTypeFilter,
} from "@bluelearn/schemas";
import type { getProfilePage } from "@/lib/api/identity";

// Everything the page renders, inferred from the loader so it tracks the API.
export type ProfilePageData = Awaited<ReturnType<typeof getProfilePage>>;
type ActivityRow = ProfilePageData["activity"][number];

const TYPE_LABELS: Record<ActivityTypeFilter, string> = {
  guide_creation: "Guide creation",
  guide_revision: "Guide revision",
  variant_creation: "Variant creation",
  variant_revision: "Variant revision",
  objective_creation: "Objective creation",
  objective_revision: "Objective revision",
  review: "Review",
};

// Collapse a row down to one of the labelled type buckets.
export function activityTypeKey(row: ActivityRow): ActivityTypeFilter {
  if (row.content_kind === "review") return "review";
  if (row.content_kind === "objective")
    return row.is_creation ? "objective_creation" : "objective_revision";
  if (row.is_variant)
    return row.is_creation ? "variant_creation" : "variant_revision";
  return row.is_creation ? "guide_creation" : "guide_revision";
}

export function activityTypeLabel(row: ActivityRow): string {
  return TYPE_LABELS[activityTypeKey(row)];
}

export const ACTIVITY_TYPE_FILTERS = (
  Object.keys(TYPE_LABELS) as Array<ActivityTypeFilter>
).map((value) => ({ value, label: TYPE_LABELS[value] }));

const STATUS_LABELS: Record<ActivityRow["status"], string> = {
  draft: "Draft",
  submitted: "Submitted",
  pending: "Pending",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
  published: "Published",
};

export function activityStatusLabel(status: ActivityRow["status"]): string {
  return STATUS_LABELS[status];
}

// Group raw statuses into easily accessible and understandable buckets.
const STATUS_BUCKETS = {
  draft: ["draft"],
  in_review: ["submitted", "pending", "in_review"],
  published: ["approved", "published"],
  rejected: ["rejected"],
} as const satisfies Record<
  ActivityStatusFilter,
  ReadonlyArray<ActivityRow["status"]>
>;

export const ACTIVITY_STATUS_FILTERS: Array<{
  value: ActivityStatusFilter;
  label: string;
}> = [
  { value: "draft", label: "Draft" },
  { value: "in_review", label: "In review" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
];

export const ACTIVITY_SORTS = activitySortSchema.options;

const DAY_MS = 24 * 60 * 60 * 1000;

// Parse a yyyy-mm-dd bound as local midnight, matching how the UI stores it.
// new Date("yyyy-mm-dd") would read it as UTC and shift the window by the offset.
function localDayMs(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}

const SORTERS: Record<
  ActivitySort,
  (a: ActivityRow, b: ActivityRow) => number
> = {
  title_asc: (a, b) => a.title.localeCompare(b.title),
  title_desc: (a, b) => b.title.localeCompare(a.title),
  summary_asc: (a, b) =>
    (a.change_summary ?? "").localeCompare(b.change_summary ?? ""),
  summary_desc: (a, b) =>
    (b.change_summary ?? "").localeCompare(a.change_summary ?? ""),
  date_asc: (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
};

export function filterActivity(
  rows: Array<ActivityRow>,
  { type, status, title, summary, from, to, sort }: ActivityFilters
): Array<ActivityRow> {
  const titleNeedle = title?.trim().toLowerCase();
  const summaryNeedle = summary?.trim().toLowerCase();
  const types = type?.length ? new Set(type) : null;
  // expand each status bucket back to the raw statuses it covers
  const statuses = status?.length
    ? new Set(status.flatMap((s) => STATUS_BUCKETS[s]))
    : null;
  const fromMs = from ? localDayMs(from) : null;
  // 'to' is a whole day, so include everything before the next midnight
  const toMs = to ? localDayMs(to) + DAY_MS : null;

  const matched = rows.filter((row) => {
    if (types && !types.has(activityTypeKey(row))) return false;
    if (statuses && !statuses.has(row.status)) return false;
    if (titleNeedle && !row.title.toLowerCase().includes(titleNeedle))
      return false;
    if (
      summaryNeedle &&
      !(row.change_summary ?? "").toLowerCase().includes(summaryNeedle)
    )
      return false;
    if (fromMs !== null || toMs !== null) {
      const t = new Date(row.created_at).getTime();
      if (fromMs !== null && t < fromMs) return false;
      if (toMs !== null && t >= toMs) return false;
    }
    return true;
  });

  return sort ? [...matched].sort(SORTERS[sort]) : matched;
}

// fucntion for getting the first two letters for the user's initials
export const getInitials = (value: string | null | undefined) => {
  const text = value?.trim() ?? "";
  if (!text) return "?";
  const parts = text.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

// Generates backend avatar URL for a given user id or seed
export const getAvatarUrl = (idOrSeed: string | null | undefined): string => {
  if (!idOrSeed) return "";
  const base = import.meta.env.VITE_API_BASE ?? "";
  return `${base}/avatar/${encodeURIComponent(idOrSeed)}`;
};
