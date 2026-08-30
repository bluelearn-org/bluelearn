import type { SupabaseClient } from "@supabase/supabase-js";
import type { UpdateRevisionInput } from "@bluelearn/schemas";
import type { DisclaimerSlug } from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";
import { diffField } from "../lib/diff";
import { createSubject } from "./subject.service";
import { createPrerequisite } from "./prerequisite.service";
import { createTodo } from "./todo.service";
import { loadDisclaimers, replaceDisclaimers } from "./disclaimer.service";

type DB = SupabaseClient<Database>;

type DraftTagsAndEdges = {
  tags?: string[];
  prerequisites?: string[];
  newSubjects?: { name: string; summary?: string | null }[];
  todoPrereqs?: { title: string; summary: string }[];
};

// The full snapshot of a single revision. RLS exposes a revision once it is
// submitted, or earlier to its own author.
const REVISION_DETAIL =
  "id, guide_id, title, summary, body, change_summary, status, created_at";

// Slimmer row used by diffRevisions: adds author_id for the RevisionRef
// header and drops guide_id/status that the diff response does not surface.
const DIFF_REVISION_DETAIL =
  "id, author_id, title, summary, body, change_summary, created_at";

// The revision's subject tags for the editor. Status comes along so the editor
// can keep a tag that is still awaiting approval out of the picker.
async function loadRevisionTags(supabase: DB, id: string) {
  const { data, error } = await supabase
    .from("guide_revision_subjects")
    .select("subject:subjects(id, slug, name, summary, status)")
    .eq("guide_revision_id", id);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load revision subjects", 500);
  }
  return (data ?? []).map((r) => r.subject).filter((s) => s !== null);
}

// Replace a draft revision's subject tag set. Tags are keyed by subject id, not
// slug, because a subject proposed inline has no slug until it is approved.
// Checking existence up front makes an unknown tag fail the whole write; the
// delete/insert are RLS-gated to the author's draft. Callers confirm
// editability first.
async function replaceRevisionTags(
  supabase: DB,
  id: string,
  ids: string[],
  extraIds: string[] = []
) {
  const subjectIds = await resolveSubjectIds(supabase, [...ids, ...extraIds]);

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

async function resolveSubjectIds(supabase: DB, ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];

  const { data, error } = await supabase
    .from("subjects")
    .select("id")
    .in("id", unique);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to resolve subjects", 500);
  }
  if ((data ?? []).length !== unique.length) {
    throw new ServiceError("Unknown subject tag", 400);
  }
  return unique;
}

export async function resolveRevisionBase(supabase: DB, revisionId: string) {
  const { data: rev, error } = await supabase
    .from("guide_revisions")
    .select("guide_id")
    .eq("id", revisionId)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new ServiceError("Failed to resolve guide base", 500);
  }
  if (!rev) throw new ServiceError("Revision not found", 404);

  const { data: guide, error: guideError } = await supabase
    .from("guides")
    // Explicit fkey: guide_bases.canonical_guide_id points back at guides, so a
    // bare embed is ambiguous.
    .select("guide_base_id, guide_bases!guides_guide_base_id_fkey(status)")
    .eq("id", rev.guide_id)
    .single();
  if (guideError) {
    console.error(guideError);
    throw new ServiceError("Failed to resolve guide base", 500);
  }
  return {
    id: guide.guide_base_id,
    status: guide.guide_bases.status,
  };
}

// Wipe the base's prerequisite edges and re-add them from the given guide slugs.
// Edge direction is prereq -> this base. An unknown slug fails the whole update.
async function replacePrerequisites(
  supabase: DB,
  baseId: string,
  slugs: string[]
) {
  const unique = [...new Set(slugs.map((s) => s.toLowerCase()))];

  let prereqIds: string[] = [];
  if (unique.length > 0) {
    const { data, error } = await supabase
      .from("guide_bases")
      .select("id, slug")
      .in("slug", unique);
    if (error) {
      console.error(error);
      throw new ServiceError("Failed to resolve prerequisites", 500);
    }
    if ((data ?? []).length !== unique.length) {
      throw new ServiceError("Unknown prerequisite guide", 400);
    }
    prereqIds = (data ?? []).map((b) => b.id);
  }

  const { error: delError } = await supabase
    .from("guide_edges")
    .delete()
    .eq("to_guide_base_id", baseId)
    .eq("edge_type", "prerequisite");
  if (delError) {
    console.error(delError);
    throw new ServiceError("Unable to update prerequisites", 400);
  }

  for (const fromId of prereqIds) {
    await createPrerequisite(supabase, fromId, baseId);
  }
}

// Replace a draft guide's open todos.
async function replaceTodos(
  supabase: DB,
  baseId: string,
  todos: { title: string; summary: string }[]
) {
  const { error: delError } = await supabase
    .from("todo_prerequisites")
    .delete()
    .eq("dependent_guide_base_id", baseId)
    .eq("status", "open");
  if (delError) {
    console.error(delError);
    throw new ServiceError("Unable to update todos", 400);
  }

  for (const todo of todos) {
    await createTodo(supabase, baseId, todo.title, todo.summary);
  }
}

// Saves a draft's subject tags, prerequisite links, and todo notes.
export async function syncDraftTagsAndEdges(
  supabase: DB,
  userId: string,
  revisionId: string,
  input: DraftTagsAndEdges
) {
  const { tags, prerequisites, newSubjects = [], todoPrereqs } = input;

  const createdIds: string[] = [];
  for (const s of newSubjects) {
    const subject = await createSubject(supabase, userId, s.name, s.summary);
    createdIds.push(subject.id);
  }

  if (tags !== undefined || createdIds.length > 0) {
    const keptIds =
      tags !== undefined
        ? []
        : (await loadRevisionTags(supabase, revisionId)).map((t) => t.id);
    await replaceRevisionTags(supabase, revisionId, tags ?? [], [
      ...keptIds,
      ...createdIds,
    ]);
  }

  if (prerequisites !== undefined || todoPrereqs !== undefined) {
    const base = await resolveRevisionBase(supabase, revisionId);
    // Guide revisions cannot edit prerequisites or todos because those
    // belong to the guide base.
    if (base.status !== "draft") {
      throw new ServiceError(
        "Prerequisites and todos can't be changed from a revision once the guide is published",
        422
      );
    }
    if (prerequisites !== undefined) {
      await replacePrerequisites(supabase, base.id, prerequisites);
    }
    if (todoPrereqs !== undefined) {
      await replaceTodos(supabase, base.id, todoPrereqs);
    }
  }
}

// Gets knowledge type, prerequisites, todos, disclaimers, and whether the guide is a variant.
async function loadDraftContext(supabase: DB, guideId: string) {
  const empty = {
    knowledge_type: null,
    is_variant: false,
    base_slug: null,
    variant_slug: null,
    prerequisites: [],
    todos: [],
    disclaimers: [] as DisclaimerSlug[],
  };
  const { data: guide, error: guideError } = await supabase
    .from("guides")
    .select("guide_base_id, slug")
    .eq("id", guideId)
    .maybeSingle();
  if (guideError) {
    console.error(guideError);
    throw new ServiceError("Failed to load revision", 500);
  }
  if (!guide) return empty;
  const baseId = guide.guide_base_id;

  const [baseRes, edgeRes, todoRes, disclaimers] = await Promise.all([
    supabase
      .from("guide_bases")
      .select("knowledge_type, slug, canonical_guide_id")
      .eq("id", baseId)
      .maybeSingle(),
    supabase
      .from("guide_edges")
      .select("from:guide_bases!from_guide_base_id(slug)")
      .eq("to_guide_base_id", baseId)
      .eq("edge_type", "prerequisite"),
    supabase
      .from("todo_prerequisites")
      .select("title, summary")
      .eq("dependent_guide_base_id", baseId)
      .eq("status", "open"),
    loadDisclaimers(supabase, baseId),
  ]);

  if (baseRes.error || edgeRes.error || todoRes.error) {
    console.error(baseRes.error ?? edgeRes.error ?? todoRes.error);
    throw new ServiceError("Failed to load revision", 500);
  }

  const canonical = baseRes.data?.canonical_guide_id ?? null;

  return {
    knowledge_type: baseRes.data?.knowledge_type ?? null,
    is_variant: canonical != null && canonical !== guideId,
    base_slug: baseRes.data?.slug ?? null,
    variant_slug: guide.slug,
    prerequisites: (edgeRes.data ?? [])
      .map((e) => e.from?.slug)
      .filter((s): s is string => s != null),
    todos: (todoRes.data ?? []).map((t) => ({
      title: t.title,
      summary: t.summary,
    })),
    disclaimers,
  };
}

// The rejected case this draft was forked from, so the editor can show the
// panel's feedback next to the fields being fixed.
async function loadRevisedFromCaseId(
  supabase: DB,
  revisedFromRevisionId: string | null
) {
  if (!revisedFromRevisionId) return null;

  const { data, error } = await supabase
    .from("guide_review_cases")
    .select("case_id")
    .eq("guide_revision_id", revisedFromRevisionId)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load revision", 500);
  }
  return data?.case_id ?? null;
}

// Includes revision with subject tags, and draft context (knowledge type,
// prerequisites, todos).
export async function getRevision(supabase: DB, id: string) {
  const { data, error } = await supabase
    .from("guide_revisions")
    .select(`${REVISION_DETAIL}, revised_from_revision_id`)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load revision", 500);
  }
  if (!data) throw new ServiceError("Revision not found", 404);
  const { revised_from_revision_id, ...revision } = data;
  const subjects = await loadRevisionTags(supabase, id);
  const [context, revised_from_case_id] = await Promise.all([
    loadDraftContext(supabase, revision.guide_id),
    loadRevisedFromCaseId(supabase, revised_from_revision_id),
  ]);
  const {
    knowledge_type,
    is_variant,
    base_slug,
    variant_slug,
    prerequisites,
    todos,
    disclaimers,
  } = context;
  return {
    revision,
    subjects,
    knowledge_type,
    is_variant,
    base_slug,
    variant_slug,
    prerequisites,
    todos,
    revised_from_case_id,
    disclaimers,
  };
}

// Fork a rejected revision into a fresh draft, so the author can fix it and
// resubmit.
export async function reviseRevision(supabase: DB, id: string) {
  const { data: revision_id, error } = await supabase.rpc(
    "revise_guide_revision",
    { p_revision_id: id }
  );

  if (error) {
    if (error.code === "P0002") {
      throw new ServiceError(
        "Revision not found or not a rejected submission",
        404
      );
    }
    console.error(error);
    throw new ServiceError("Unable to revise revision", 500);
  }

  return { revision_id };
}

// Overwrite a draft revision in place. RLS permits this only on the author's own
// draft, so an out-of-reach or already-submitted revision matches zero rows.
export async function updateRevision(
  supabase: DB,
  userId: string,
  id: string,
  input: UpdateRevisionInput
) {
  const { tags, prerequisites, newSubjects, todoPrereqs, disclaimers, ...fields } = input;

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

  await syncDraftTagsAndEdges(supabase, userId, id, {
    tags,
    prerequisites,
    newSubjects,
    todoPrereqs,
  });

  if (disclaimers !== undefined) {
    const base = await resolveRevisionBase(supabase, id);
    if (base.status !== "draft") {
      throw new ServiceError(
        "Disclaimers can't be changed from a revision once the guide is published",
        422
      );
    }
    await replaceDisclaimers(supabase, base.id, disclaimers);
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
    // The RPC raises check_violation when the draft is missing a required field.
    if (error.code === "23514") {
      throw new ServiceError(
        "Add a title, summary, body, and at least one tag before submitting",
        422
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

  let query = supabase
    .from("guide_revisions")
    .select("id")
    .eq("guide_id", current.guide_id)
    .not("approved_at", "is", null)
    .neq("id", id);

  if (current.approved_at) query = query.lt("approved_at", current.approved_at);

  const { data: prev, error: prevError } = await query
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
