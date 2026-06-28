import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'
import { ServiceError } from '../lib/service-error'

type DB = SupabaseClient<Database>

type ReviewOutcome = Database['public']['Enums']['review_outcome']

// Cases in the caller's queue — open reviews where they are an assigned panelist.
export async function getReviewQueue(supabase: DB, userId: string) {
  const { data: memberships, error } = await supabase
    .from('panel_members')
    .select(
      `id, panel_id, assigned_at,
       review_panels!inner(
         id, target_seat_count, outcome, opened_at, closed_at, case_id,
         review_cases!inner(id, case_type, status, created_at, created_by, time_limit, updated_at)
       )`,
    )
    .eq('member_id', userId)
    .eq('status', 'assigned')

  if (error) throw new ServiceError(error.message, 500)

  const open = memberships.filter(
    (m) =>
      (m.review_panels as unknown as { review_cases: { status: string } }).review_cases.status ===
        'pending' ||
      (m.review_panels as unknown as { review_cases: { status: string } }).review_cases.status ===
        'in_review',
  )

  const caseIds = [...new Set(open.map((m) => (m.review_panels as unknown as { review_cases: { id: string } }).review_cases.id))]

  let guideLinks: Array<{
    case_id: string
    guide_revision_id: string
    guide_revisions: { title: string | null; summary: string | null } | null
  }> = []

  if (caseIds.length > 0) {
    const { data: links } = await supabase
      .from('guide_review_cases')
      .select('case_id, guide_revision_id, guide_revisions!inner(title, summary)')
      .in('case_id', caseIds)
    guideLinks = (links ?? []) as typeof guideLinks
  }

  return open.map((pm) => {
    const rp = pm.review_panels as unknown as {
      id: string
      target_seat_count: number
      outcome: ReviewOutcome | null
      opened_at: string
      closed_at: string | null
      case_id: string
      review_cases: {
        id: string
        case_type: string
        status: string
        created_at: string
        created_by: string | null
        time_limit: string | null
        updated_at: string
      }
    }
    const rc = rp.review_cases
    const link = guideLinks.find((gl) => gl.case_id === rc.id)
    return {
      id: rc.id,
      case_type: rc.case_type,
      status: rc.status,
      created_at: rc.created_at,
      created_by: rc.created_by,
      panel: {
        id: rp.id,
        target_seat_count: rp.target_seat_count,
        outcome: rp.outcome,
        opened_at: rp.opened_at,
        closed_at: rp.closed_at,
        my_member_id: pm.id,
      },
      guide_revision: link
        ? {
            id: link.guide_revision_id,
            title: link.guide_revisions?.title ?? null,
            summary: link.guide_revisions?.summary ?? null,
          }
        : null,
    }
  })
}

// All finished review cases — public browse.
export async function listReviewCases(supabase: DB) {
  const { data, error } = await supabase
    .from('review_cases')
    .select(
      `id, case_type, status, created_at, created_by, time_limit, updated_at,
       review_panels(id, target_seat_count, outcome, opened_at, closed_at),
       guide_review_cases(
         guide_revision_id,
         guide_revisions(title, summary)
       )`,
    )
    .in('status', ['approved', 'rejected'])
    .order('updated_at', { ascending: false })

  if (error) throw new ServiceError(error.message, 500)
  return data ?? []
}

// Full detail for a single review case: panels, members, decisions, reasons, guide revision.
export async function getReviewCase(supabase: DB, caseId: string) {
  const { data, error } = await supabase
    .from('review_cases')
    .select(
      `*,
       review_panels(
         *,
         panel_members(
           *,
           review_decisions(
             *,
             review_decision_reasons(reason)
           )
         )
       ),
       guide_review_cases(
         guide_revision_id,
         guide_revisions(id, title, summary, body, status, created_at)
       )`,
    )
    .eq('id', caseId)
    .maybeSingle()

  if (error) throw new ServiceError(error.message, 500)
  if (!data) throw new ServiceError('Review case not found', 404)

  return data
}

// Cast or update the caller's vote on an active case. Upserts on the
// panel_member_id unique constraint so the same panelist can change their
// vote.
export async function castDecision(
  supabase: DB,
  userId: string,
  caseId: string,
  input: { decision: ReviewOutcome; notes?: string | null },
) {
  const { data: panel, error: panelError } = await supabase
    .from('review_panels')
    .select('id')
    .eq('case_id', caseId)
    .is('closed_at', null)
    .maybeSingle()

  if (panelError) throw new ServiceError(panelError.message, 500)
  if (!panel) throw new ServiceError('No active review panel for this case', 400)

  const { data: member, error: memberError } = await supabase
    .from('panel_members')
    .select('id')
    .eq('panel_id', panel.id)
    .eq('member_id', userId)
    .eq('status', 'assigned')
    .maybeSingle()

  if (memberError) throw new ServiceError(memberError.message, 500)
  if (!member) throw new ServiceError('You are not an active panelist on this case', 403)

  const { data: decision, error: upsertError } = await supabase
    .from('review_decisions')
    .upsert(
      {
        panel_member_id: member.id,
        decision: input.decision,
        notes: input.notes ?? null,
      },
      { onConflict: 'panel_member_id' },
    )
    .select()
    .single()

  if (upsertError) throw new ServiceError(upsertError.message, 500)

  return decision
}
