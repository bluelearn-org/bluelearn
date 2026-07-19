import type { SupabaseClient } from "@supabase/supabase-js";
import type { DecisionReason } from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";
import { PANEL_POLICY_DEFAULTS } from "../lib/review-policy";

type DB = SupabaseClient<Database>;
type ReviewOutcome = Database["public"]["Enums"]["review_outcome"];

// -- Internal row shapes for single top-level casts --

type QueueRow = {
  id: string;
  panel_id: string;
  member_id: string | null;
  status: string;
  assigned_at: string;
  review_panels: {
    id: string;
    target_seat_count: number;
    outcome: ReviewOutcome | null;
    opened_at: string;
    closed_at: string | null;
    case_id: string;
    review_cases: {
      id: string;
      case_type: string;
      status: string;
      created_at: string;
      created_by: string | null;
      time_limit: string | null;
      updated_at: string;
    };
  };
};

type GuideLinkRow = {
  case_id: string;
  guide_revision_id: string;
  guide_revisions: { title: string | null; summary: string | null };
};

type CaseListRow = {
  id: string;
  case_type: string;
  status: string;
  created_at: string;
  created_by: string | null;
  time_limit: string | null;
  updated_at: string;
  review_panels: Array<{
    id: string;
    target_seat_count: number;
    outcome: ReviewOutcome | null;
    opened_at: string;
    closed_at: string | null;
  }>;
  guide_review_cases: {
    guide_revision_id: string;
    guide_revisions: { title: string | null; summary: string | null } | null;
  } | null;
};

type CaseDetailRow = {
  id: string;
  case_type: string;
  status: string;
  created_at: string;
  created_by: string | null;
  time_limit: string | null;
  updated_at: string;
  review_panels: Array<{
    id: string;
    target_seat_count: number;
    outcome: ReviewOutcome | null;
    opened_at: string;
    closed_at: string | null;
    panel_members: Array<{
      id: string;
      member_id: string | null;
      status: string;
      assigned_at: string;
      review_decisions: {
        id: string;
        decision: ReviewOutcome;
        notes: string | null;
        created_at: string;
        review_decision_reasons: Array<{ reason: string }> | null;
      } | null;
    }>;
  }>;
  guide_review_cases: {
    guide_revision_id: string;
    guide_revisions: {
      id: string;
      title: string | null;
      summary: string | null;
      body: string | null;
      status: string;
      created_at: string;
    } | null;
  } | null;
};

// ---- Exports ----

export async function getReviewQueue(supabase: DB, userId: string) {
  const { data: raw, error } = await supabase
    .from("panel_members")
    .select(
      `id, panel_id, member_id, status, assigned_at,
       review_panels!inner(
         id, target_seat_count, outcome, opened_at, closed_at, case_id,
         review_cases!inner(id, case_type, status, created_at, created_by, time_limit, updated_at)
       )`
    )
    .eq("member_id", userId)
    .eq("status", "assigned");

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load review queue", 500);
  }

  const memberships = (raw ?? []) as unknown as QueueRow[];

  const open = memberships.filter(
    (m) =>
      m.review_panels.review_cases.status === "pending" ||
      m.review_panels.review_cases.status === "in_review"
  );

  const caseIds = [
    ...new Set(open.map((m) => m.review_panels.review_cases.id)),
  ];

  let guideLinks: GuideLinkRow[] = [];
  if (caseIds.length > 0) {
    const { data: links, error: linkError } = await supabase
      .from("guide_review_cases")
      .select(
        "case_id, guide_revision_id, guide_revisions!inner(title, summary)"
      )
      .in("case_id", caseIds);

    if (linkError) {
      console.error(linkError);
      throw new ServiceError("Failed to load guide revision details", 500);
    }
    guideLinks = (links ?? []) as unknown as GuideLinkRow[];
  }

  return open.map((m) => {
    const rc = m.review_panels.review_cases;
    const link = guideLinks.find((l) => l.case_id === rc.id);
    return {
      id: rc.id,
      case_type: rc.case_type,
      status: rc.status,
      title: link?.guide_revisions?.title ?? null,
      created_at: rc.created_at,
    };
  });
}

export async function listReviewCases(supabase: DB) {
  const { data: raw, error } = await supabase
    .from("review_cases")
    .select(
      `id, case_type, status, created_at, created_by, time_limit, updated_at,
       review_panels(id, target_seat_count, outcome, opened_at, closed_at),
       guide_review_cases(
         guide_revision_id,
         guide_revisions(title, summary)
       )`
    )
    .in("status", ["approved", "rejected"])
    .order("updated_at", { ascending: false });

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to list review cases", 500);
  }

  const rows = (raw ?? []) as unknown as CaseListRow[];

  return rows.map((c) => ({
    id: c.id,
    case_type: c.case_type,
    status: c.status,
    title: c.guide_review_cases?.guide_revisions?.title ?? null,
    created_at: c.created_at,
  }));
}

export async function getReviewCase(supabase: DB, caseId: string) {
  const { data: raw, error } = await supabase
    .from("review_cases")
    .select(
      `id, case_type, status, created_at, created_by, time_limit, updated_at,
       review_panels(
         id, target_seat_count, outcome, opened_at, closed_at,
         panel_members(
           id, member_id, status, assigned_at,
           review_decisions(
             id, decision, notes, created_at,
             review_decision_reasons(reason)
           )
         )
       ),
       guide_review_cases(
         guide_revision_id,
         guide_revisions(id, title, summary, body, status, created_at)
       )`
    )
    .eq("id", caseId)
    .order("opened_at", { foreignTable: "review_panels", ascending: false })
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load review case", 500);
  }
  if (!raw) throw new ServiceError("Review case not found", 404);

  const data = raw as unknown as CaseDetailRow;
  const latestPanel = data.review_panels[0] ?? null;
  const members = latestPanel?.panel_members ?? [];

  return {
    case: {
      id: data.id,
      case_type: data.case_type,
      status: data.status,
      title: data.guide_review_cases?.guide_revisions?.title ?? null,
      created_by: data.created_by,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
    panel: members.map((pm) => ({
      id: pm.id,
      member_id: pm.member_id,
      status: pm.status,
      assigned_at: pm.assigned_at,
    })),
    decisions: members
      .filter((pm) => pm.review_decisions)
      .map((pm) => {
        const d = pm.review_decisions!;
        return {
          id: d.id,
          decision: d.decision,
          notes: d.notes,
          reasons: d.review_decision_reasons?.map((r) => r.reason) ?? [],
          created_at: d.created_at,
        };
      }),
    revision: data.guide_review_cases?.guide_revisions ?? null,
  };
}

export async function castDecision(
  supabase: DB,
  caseId: string,
  input: {
    decision: ReviewOutcome;
    notes?: string | null;
    reasons?: DecisionReason[];
  }
) {
  // Write the decision, its rubric reasons, and the seat completion in one
  // transaction.
  const { data, error } = await supabase.rpc("cast_review_decision", {
    p_case_id: caseId,
    p_decision: input.decision,
    p_notes: input.notes ?? undefined,
    p_reasons: input.decision === "rejected" ? (input.reasons ?? []) : [],
  });

  if (error) {
    if (error.code === "22023")
      throw new ServiceError("No active review panel for this case", 400);
    if (error.code === "42501")
      throw new ServiceError(
        "You are not an active panelist on this case",
        403
      );
    console.error(error);
    throw new ServiceError("Failed to record decision", 500);
  }

  // This cast may be the deciding vote. close_review_panel tallies, no-ops until
  // one outcome holds a majority, and on approval, publishes the revision.
  const { error: closeError } = await supabase.rpc("close_review_panel", {
    p_case_id: caseId,
  });

  if (closeError) {
    console.error(closeError);
    throw new ServiceError("Failed to record decision", 500);
  }

  return data as {
    id: string;
    decision: ReviewOutcome;
    notes: string | null;
    reasons: DecisionReason[];
    created_at: string;
  };
}

// Seat a panel on every case still waiting for one (used by cron trigger).
export async function assemblePendingPanels(supabase: DB) {
  const { data: cases, error } = await supabase
    .from("review_cases")
    .select("id, case_type")
    .eq("status", "pending");

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load pending review cases", 500);
  }

  for (const c of cases ?? []) {
    const { error: rpcError } = await supabase.rpc("assemble_review_panel", {
      p_case_id: c.id,
      p_policy_default: PANEL_POLICY_DEFAULTS[c.case_type],
    });
    // One case failing to seat must not stall the rest of the batch.
    if (rpcError) console.error(rpcError);
  }
}
