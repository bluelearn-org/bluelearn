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
