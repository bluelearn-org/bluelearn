import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";

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
          justification: d.notes,
          reasons: d.review_decision_reasons?.map((r) => r.reason) ?? [],
          created_at: d.created_at,
        };
      }),
  };
}

export async function castDecision(
  supabase: DB,
  userId: string,
  caseId: string,
  input: { decision: ReviewOutcome; notes?: string | null }
) {
  const { data: panel, error: panelError } = await supabase
    .from("review_panels")
    .select("id")
    .eq("case_id", caseId)
    .is("closed_at", null)
    .maybeSingle();

  if (panelError) {
    console.error(panelError);
    throw new ServiceError("Failed to find active panel", 500);
  }
  if (!panel)
    throw new ServiceError("No active review panel for this case", 400);

  const { data: member, error: memberError } = await supabase
    .from("panel_members")
    .select("id")
    .eq("panel_id", panel.id)
    .eq("member_id", userId)
    .eq("status", "assigned")
    .maybeSingle();

  if (memberError) {
    console.error(memberError);
    throw new ServiceError("Failed to verify panel membership", 500);
  }
  if (!member)
    throw new ServiceError("You are not an active panelist on this case", 403);

  const { data: decision, error: upsertError } = await supabase
    .from("review_decisions")
    .upsert(
      {
        panel_member_id: member.id,
        decision: input.decision,
        notes: input.notes ?? null,
      },
      { onConflict: "panel_member_id" }
    )
    .select()
    .single();

  if (upsertError) {
    console.error(upsertError);
    throw new ServiceError("Failed to record decision", 500);
  }

  return decision;
}
