import type { SupabaseClient } from '@supabase/supabase-js'
import type { UpdateRevisionInput } from '@bluelearn/schemas'
import type { Database } from '../database.types'
import { ServiceError } from '../lib/service-error'

type DB = SupabaseClient<Database>

// The full snapshot of a single revision. RLS exposes a revision once it is
// submitted, or earlier to its own author.
const REVISION_DETAIL =
  'id, guide_id, title, summary, body, change_summary, status, created_at'

// Resolve a revision by id to its snapshot. 404 when RLS hides it.
export async function getRevision(supabase: DB, id: string) {
  const { data: revision, error } = await supabase
    .from('guide_revisions')
    .select(REVISION_DETAIL)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new ServiceError(error.message, 500)
  if (!revision) throw new ServiceError('Revision not found', 404)

  return { revision }
}

// Overwrite a draft revision in place. RLS permits this only on the author's own
// draft, so an out-of-reach or already-submitted revision matches zero rows.
// Blank summary/body/change_summary are stored as NULL.
export async function updateRevision(supabase: DB, id: string, input: UpdateRevisionInput) {
  const patch = {
    ...input,
    ...('summary' in input && { summary: input.summary || null }),
    ...('body' in input && { body: input.body || null }),
    ...('change_summary' in input && { change_summary: input.change_summary || null }),
  }

  const { data, error } = await supabase
    .from('guide_revisions')
    .update(patch)
    .eq('id', id)
    .select(REVISION_DETAIL)

  if (error) throw new ServiceError(error.message, 400)
  if (!data || data.length === 0) {
    throw new ServiceError('Revision not found or not an editable draft', 404)
  }
  return { revision: data[0] }
}

// Submit a draft for review: flips it to submitted, opens a review case, and
// links the two in one transaction via the submit_guide_revision RPC (RLS still
// applies). Returns the opened review case id.
export async function submitRevision(supabase: DB, id: string) {
  const { data: review_case_id, error } = await supabase.rpc('submit_guide_revision', {
    p_revision_id: id,
  })

  if (error) {
    if (error.code === 'P0002') {
      throw new ServiceError('Revision not found or not an editable draft', 404)
    }
    throw new ServiceError(error.message, 400)
  }

  return { review_case_id }
}
