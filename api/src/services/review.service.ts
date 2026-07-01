import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'
import { ServiceError } from '../lib/service-error'
import type { CreateDecisionInput } from '@bluelearn/schemas'

type DB = SupabaseClient<Database>

// Cases in the caller's queue — open reviews where they are an assigned panelist.
export async function getReviewQueue(supabase: DB, userId: string) {
  const { data, error } = await supabase
    .from('review_cases')
    .select(
      `id, case_type, status, created_at,
       review_panels!inner(
         panel_members!inner(member_id)
       ),
       guide_review_cases(
         guide_revision_id,
         guide_revisions!inner(title)
       )`,
    )
    .in('status', ['pending', 'in_review'])
    .eq('review_panels.panel_members.member_id', userId)
    .eq('review_panels.panel_members.status', 'assigned')
    .order('created_at', { ascending: false })

  if (error) {
    console.error(error)
    throw new ServiceError('Failed to load review queue', 500)
  }

  if (!data) return []

  const titleMap = new Map<string, string | null>()
  for (const rc of data) {
    const guideReviewCase = (rc as Record<string, unknown>).guide_review_cases as
      | Array<Record<string, unknown>>
      | null
    const title = (guideReviewCase?.[0] as Record<string, unknown> | undefined)
      ?.guide_revisions as Record<string, unknown> | undefined
    titleMap.set(rc.id, (title?.title as string) ?? null)
  }

  return data.map((rc) => ({
    id: rc.id,
    case_type: rc.case_type,
    status: rc.status,
    title: titleMap.get(rc.id) ?? null,
    created_at: rc.created_at,
  }))
}

// All finished review cases — public browse.
export async function listReviewCases(supabase: DB) {
  const { data, error } = await supabase
    .from('review_cases')
    .select(
      `id, case_type, status, created_at,
       guide_review_cases(
         guide_revision_id,
         guide_revisions!inner(title)
       )`,
    )
    .in('status', ['approved', 'rejected'])
    .order('updated_at', { ascending: false })

  if (error) {
    console.error(error)
    throw new ServiceError('Failed to load review cases', 500)
  }

  if (!data) return []

  return data.map((rc) => {
    const guideReviewCase = (rc as Record<string, unknown>).guide_review_cases as
      | Array<Record<string, unknown>>
      | null
    const title = (guideReviewCase?.[0] as Record<string, unknown> | undefined)
      ?.guide_revisions as Record<string, unknown> | undefined

    return {
      id: rc.id,
      case_type: rc.case_type,
      status: rc.status,
      title: (title?.title as string) ?? null,
      created_at: rc.created_at,
    }
  })
}

// Full detail for a single finished review case: flattened case, panel, and decisions.
export async function getReviewCase(supabase: DB, caseId: string) {
  const { data, error } = await supabase
    .from('review_cases')
    .select(
      `id, case_type, status, created_by, created_at, updated_at,
       review_panels(
         id,
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
         guide_revisions!inner(title)
       )`,
    )
    .eq('id', caseId)
    .in('status', ['approved', 'rejected'])
    .maybeSingle()

  if (error) {
    console.error(error)
    throw new ServiceError('Failed to load review case', 500)
  }
  if (!data) throw new ServiceError('Review case not found', 404)

  const raw = data as unknown as {
    id: string
    case_type: string
    status: string
    created_by: string | null
    created_at: string
    updated_at: string
    review_panels: Array<{
      panel_members: Array<{
        id: string
        member_id: string
        status: string
        assigned_at: string
        review_decisions: Array<{
          id: string
          decision: string
          notes: string | null
          created_at: string
          review_decision_reasons: Array<{ reason: string }>
        }>
      }>
    }>
    guide_review_cases: Array<{
      guide_revisions: { title: string } | null
    }>
  }

  const caseData = {
    id: raw.id,
    case_type: raw.case_type,
    status: raw.status,
    title: raw.guide_review_cases?.[0]?.guide_revisions?.title ?? null,
    created_by: raw.created_by,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  }

  const panel = raw.review_panels?.flatMap((p) =>
    p.panel_members?.map((m) => ({
      id: m.id,
      member_id: m.member_id,
      status: m.status,
      assigned_at: m.assigned_at,
    })),
  ) ?? []

  const decisions = raw.review_panels?.flatMap((p) =>
    p.panel_members?.flatMap((m) =>
      m.review_decisions?.map((d) => ({
        id: d.id,
        decision: d.decision,
        justification: d.notes,
        reasons: d.review_decision_reasons?.map((r) => r.reason) ?? [],
        created_at: d.created_at,
      })),
    ),
  ) ?? []

  return { case: caseData, panel, decisions }
}

// Cast or update the caller's vote on an active case. Upserts on the
// panel_member_id unique constraint so the same panelist can change their
// vote. Writes rubric reasons on reject.
export async function castDecision(
  supabase: DB,
  userId: string,
  caseId: string,
  input: CreateDecisionInput,
) {
  const { data: panel, error: panelError } = await supabase
    .from('review_panels')
    .select('id')
    .eq('case_id', caseId)
    .is('closed_at', null)
    .maybeSingle()

  if (panelError) {
    console.error(panelError)
    throw new ServiceError('Failed to find review panel', 500)
  }
  if (!panel) throw new ServiceError('No active review panel for this case', 400)

  const { data: member, error: memberError } = await supabase
    .from('panel_members')
    .select('id')
    .eq('panel_id', panel.id)
    .eq('member_id', userId)
    .eq('status', 'assigned')
    .maybeSingle()

  if (memberError) {
    console.error(memberError)
    throw new ServiceError('Failed to verify panel membership', 500)
  }
  if (!member) throw new ServiceError('You are not an active panelist on this case', 403)

  const { data: decision, error: upsertError } = await supabase
    .from('review_decisions')
    .upsert(
      {
        panel_member_id: member.id,
        decision: input.decision,
        notes: input.justification,
      },
      { onConflict: 'panel_member_id' },
    )
    .select()
    .single()

  if (upsertError) {
    console.error(upsertError)
    throw new ServiceError('Failed to cast decision', 500)
  }

  // Clear old reasons so a vote change from reject→approve doesn't leave
  // stale reasons behind. PostgREST may reject the DELETE if RLS lacks
  // a DELETE policy — that's acceptable; old reasons remain as orphans.
  const { error: delErr } = await supabase
    .from('review_decision_reasons')
    .delete()
    .eq('decision_id', decision.id)
  if (delErr) console.error('Could not clear old reasons:', delErr)

  // Write rubric reasons on reject
  if (input.decision === 'rejected') {
    const { error: reasonsError } = await supabase
      .from('review_decision_reasons')
      .insert(input.reasons.map((r) => ({ decision_id: decision.id, reason: r })))

    if (reasonsError) {
      console.error(reasonsError)
      throw new ServiceError('Failed to record decision reasons', 500)
    }
  }

  // Re-fetch with reasons for a clean response
  const { data: full, error: fetchError } = await supabase
    .from('review_decisions')
    .select('id, decision, notes, created_at, review_decision_reasons(reason)')
    .eq('id', decision.id)
    .single()

  if (fetchError) {
    console.error(fetchError)
    throw new ServiceError('Failed to load recorded decision', 500)
  }

  const rawFull = full as unknown as {
    id: string
    decision: string
    notes: string | null
    created_at: string
    review_decision_reasons: Array<{ reason: string }> | null
  }

  return {
    id: rawFull.id,
    decision: rawFull.decision,
    justification: rawFull.notes,
    reasons: rawFull.review_decision_reasons?.map((r) => r.reason) ?? [],
    created_at: rawFull.created_at,
  }
}
