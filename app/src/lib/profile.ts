import { getMyActivity, getMyIdentity, getMyStats } from "@/lib/api/identity";

export async function loadProfilePage(signal?: AbortSignal) {
  const [identity, stats, activity] = await Promise.all([
    getMyIdentity({ signal }),
    getMyStats({ signal }),
    getMyActivity({ signal }),
  ]);
  return {
    profile: identity.profile,
    roles: identity.roles,
    stats,
    activity,
  };
}

// Everything the page renders, inferred from the loader so it tracks the API.
export type ProfilePageData = Awaited<ReturnType<typeof loadProfilePage>>;
type ActivityRow = ProfilePageData["activity"][number];

// "Guide creation", "Variant revision", "Objective creation", "Review".
export function activityTypeLabel(row: ActivityRow): string {
  if (row.content_kind === "review") return "Review";
  const noun =
    row.content_kind === "objective"
      ? "Objective"
      : row.is_variant
        ? "Variant"
        : "Guide";
  return `${noun} ${row.is_creation ? "creation" : "revision"}`;
}

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
} as const satisfies Record<string, ReadonlyArray<ActivityRow["status"]>>;

export type ActivityStatusFilter = keyof typeof STATUS_BUCKETS;
export type ActivityTypeFilter = ActivityRow["content_kind"];

export const ACTIVITY_STATUS_FILTERS: Array<{
  value: ActivityStatusFilter;
  label: string;
}> = [
  { value: "draft", label: "Draft" },
  { value: "in_review", label: "In review" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
];

export const ACTIVITY_TYPE_FILTERS: Array<{
  value: ActivityTypeFilter;
  label: string;
}> = [
  { value: "guide", label: "Guides" },
  { value: "objective", label: "Objectives" },
  { value: "review", label: "Reviews" },
];

export type ActivityFilters = {
  q?: string;
  type?: ActivityTypeFilter;
  status?: ActivityStatusFilter;
  sort?: "oldest";
};

export function filterActivity(
  rows: Array<ActivityRow>,
  { q, type, status, sort }: ActivityFilters
): Array<ActivityRow> {
  const needle = q?.trim().toLowerCase();
  const statuses: ReadonlyArray<string> | null = status
    ? STATUS_BUCKETS[status]
    : null;

  const matched = rows.filter((row) => {
    if (type && row.content_kind !== type) return false;
    if (statuses && !statuses.includes(row.status)) return false;
    if (needle && !row.title.toLowerCase().includes(needle)) return false;
    return true;
  });

  return sort === "oldest" ? matched.reverse() : matched;
}
