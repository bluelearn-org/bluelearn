import type { SupabaseClient } from "@supabase/supabase-js";
import type { UpdateRevisionInput } from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";
import { diffField } from "../lib/diff";

type DB = SupabaseClient<Database>;

// The full snapshot of a single revision. RLS exposes a revision once it is
// submitted, or earlier to its own author.
const REVISION_DETAIL =
  "id, guide_id, title, summary, body, change_summary, status, created_at";

// Slimmer row used by diffRevisions: adds author_id for the RevisionRef
// header and drops guide_id/status that the diff response does not surface.
const DIFF_REVISION_DETAIL =
  "id, author_id, title, summary, body, change_summary, created_at";

// The revision's subject tags, resolved to {slug, name} references for the editor.
async function loadRevisionTags(supabase: DB, id: string) {
  const { data, error } = await supabase
    .from("guide_revision_subjects")
    .select("subject:subjects(id, slug, name)")
    .eq("guide_revision_id", id);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load revision subjects", 500);
  }
  return (data ?? []).map((r) => r.subject).filter((s) => s !== null);
}

// Replace a draft revision's subject tag set with the given slugs. Resolving
// slugs up front makes an unknown tag fail the whole write; the delete/insert
// are RLS-gated to the author's draft. Callers confirm editability first.
async function replaceRevisionTags(supabase: DB, id: string, slugs: string[]) {
  const unique = [...new Set(slugs)];

  let subjectIds: string[] = [];
  if (unique.length > 0) {
    const { data, error } = await supabase
      .from("subjects")
      .select("id")
      .in("slug", unique);

    if (error) {
      console.error(error);
      throw new ServiceError("Failed to resolve subjects", 500);
    }
    if ((data ?? []).length !== unique.length) {
      throw new ServiceError("Unknown subject tag", 400);
    }
    subjectIds = (data ?? []).map((s) => s.id);
  }

  const { error: delError } = await supabase
    .from("guide_revision_subjects")
    .delete()
    .eq("guide_revision_id", id);

  if (delError) {
    console.error(delError);
    throw new ServiceError("Unable to update revision subjects", 400);
  }

  if (subjectIds.length > 0) {
    const { error: insError } = await supabase
      .from("guide_revision_subjects")
      .insert(
        subjectIds.map((subject_id) => ({ guide_revision_id: id, subject_id }))
      );

    if (insError) {
      console.error(insError);
      throw new ServiceError("Unable to update revision subjects", 400);
    }
  }
}

// Resolve a revision by id to its snapshot and subject tags. 404 when RLS hides it.
export async function getRevision(supabase: DB, id: string) {
  const { data: revision, error } = await supabase
    .from("guide_revisions")
    .select(REVISION_DETAIL)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load revision", 500);
  }
  if (!revision) throw new ServiceError("Revision not found", 404);

  const subjects = await loadRevisionTags(supabase, id);
  return { revision, subjects };
}

// Overwrite a draft revision in place. RLS permits this only on the author's own
// draft, so an out-of-reach or already-submitted revision matches zero rows.
export async function updateRevision(
  supabase: DB,
  id: string,
  input: UpdateRevisionInput
) {
  const { tags, ...fields } = input;

  const patch = {
    ...fields,
    ...("summary" in fields && { summary: fields.summary || null }),
    ...("body" in fields && { body: fields.body || null }),
    ...("change_summary" in fields && {
      change_summary: fields.change_summary || null,
    }),
  };

  // Check if metadata changes are present.
  let revision;
  if (Object.keys(patch).length > 0) {
    const { data, error } = await supabase
      .from("guide_revisions")
      .update(patch)
      .eq("id", id)
      .select(REVISION_DETAIL);

    if (error) throw new ServiceError("Unable to update revision", 400);
    if (!data || data.length === 0) {
      throw new ServiceError(
        "Revision not found or not an editable draft",
        404
      );
    }
    revision = data[0];
  } else {
    const { data, error } = await supabase
      .from("guide_revisions")
      .select(REVISION_DETAIL)
      .eq("id", id)
      .eq("status", "draft")
      .maybeSingle();

    if (error) {
      console.error(error);
      throw new ServiceError("Unable to update revision", 400);
    }
    if (!data) {
      throw new ServiceError(
        "Revision not found or not an editable draft",
        404
      );
    }
    revision = data;
  }

  if (tags !== undefined) {
    await replaceRevisionTags(supabase, id, tags);
  }

  const subjects = await loadRevisionTags(supabase, id);
  return { revision, subjects };
}

// Submit a draft for review: flips it to submitted, opens a review case, and
// links the two in one transaction via the submit_guide_revision RPC (RLS still
// applies). Returns the opened review case id.
export async function submitRevision(supabase: DB, id: string) {
  const { data: review_case_id, error } = await supabase.rpc(
    "submit_guide_revision",
    {
      p_revision_id: id,
    }
  );

  if (error) {
    if (error.code === "P0002") {
      throw new ServiceError(
        "Revision not found or not an editable draft",
        404
      );
    }
    throw new ServiceError("Unable to submit revision", 400);
  }

  return { review_case_id };
}

// Rendered diff between two guide revision snapshots. RLS still applies, so a
// hidden revision 404s. Each versioned text field (title/summary/body) is
// compared with strict equality; when changed, `diff` carries a unified-diff
// style string (lines starting with " " are unchanged, "-" only in `from`,
// "+" only in `to`). null === null is treated as unchanged.
export async function diffRevisions(supabase: DB, id: string, otherId: string) {
  const [fromRes, toRes] = await Promise.all([
    supabase
      .from("guide_revisions")
      .select(DIFF_REVISION_DETAIL)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("guide_revisions")
      .select(DIFF_REVISION_DETAIL)
      .eq("id", otherId)
      .maybeSingle(),
  ]);

  if (fromRes.error) {
    console.error(fromRes.error);
    throw new ServiceError("Failed to load revision", 500);
  }
  if (toRes.error) {
    console.error(toRes.error);
    throw new ServiceError("Failed to load revision", 500);
  }
  if (!fromRes.data) throw new ServiceError("Revision not found", 404);
  if (!toRes.data) throw new ServiceError("Revision not found", 404);

  const from = fromRes.data;
  const to = toRes.data;

  return {
    from: toRevisionRef(from),
    to: toRevisionRef(to),
    fields: {
      title: diffField(from.title, to.title),
      summary: diffField(from.summary, to.summary),
      body: diffField(from.body, to.body),
    },
  };
}

// Diff a revision against the revision approved directly before it (same guide,
// ordered by approved_at). Returns the same { from, to, fields } shape as
// diffRevisions. 404 if no previous revision exists.
export async function diffWithPrevious(supabase: DB, id: string) {
  const { data: current, error: currentError } = await supabase
    .from("guide_revisions")
    .select("id, guide_id, approved_at")
    .eq("id", id)
    .maybeSingle();

  if (currentError) {
    console.error(currentError);
    throw new ServiceError("Failed to load revision", 500);
  }
  if (!current) throw new ServiceError("Revision not found", 404);

  const { data: prev, error: prevError } = await supabase
    .from("guide_revisions")
    .select("id")
    .eq("guide_id", current.guide_id)
    .not("approved_at", "is", null)
    .neq("id", id)
    .lt("approved_at", current.approved_at)
    .order("approved_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (prevError) {
    console.error(prevError);
    throw new ServiceError("Failed to load previous revision", 500);
  }
  if (!prev) throw new ServiceError("No previous revision found", 404);

  return diffRevisions(supabase, prev.id, id);
}

// Project a revision row down to the RevisionRef shape used in diff headers.
function toRevisionRef(row: {
  id: string;
  author_id: string | null;
  created_at: string;
  change_summary: string | null;
}) {
  return {
    id: row.id,
    author_id: row.author_id,
    created_at: row.created_at,
    change_summary: row.change_summary,
  };
}
