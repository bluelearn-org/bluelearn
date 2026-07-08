import { admin, insert, type Insert } from "../helpers";

export function createGuideBase(
  overrides: Partial<Insert<"guide_bases">> = {}
) {
  return insert("guide_bases", {
    slug: `guide-${crypto.randomUUID()}`,
    title: "Test Guide",
    knowledge_type: "theory",
    ...overrides,
  });
}

export function createGuide(
  guideBaseId: string,
  overrides: Partial<Insert<"guides">> = {}
) {
  return insert("guides", { guide_base_id: guideBaseId, ...overrides });
}

export function createGuideRevision(
  guideId: string,
  overrides: Partial<Insert<"guide_revisions">> = {}
) {
  return insert("guide_revisions", {
    guide_id: guideId,
    title: "Test Guide",
    // Submitted so a panelist (not the author) can read it under RLS; a queued
    // case always points at a submitted revision.
    status: "submitted",
    ...overrides,
  });
}

// A fully published guide: published base + canonical published guide + live
// submitted revision, with both deferred pointers set. This is the shape every
// public read joins over.
export async function createPublishedGuide(
  opts: {
    title?: string;
    slug?: string;
    summary?: string;
    body?: string;
    authorId?: string;
    variantSlug?: string;
  } = {}
) {
  const base = await createGuideBase({
    title: opts.title ?? "Test Guide",
    slug: opts.slug ?? `guide-${crypto.randomUUID()}`,
    status: "published",
  });
  const guide = await createGuide(base.id, {
    status: "published",
    slug: opts.variantSlug ?? "main",
    author_id: opts.authorId,
  });
  const revision = await createGuideRevision(guide.id, {
    title: opts.title ?? "Test Guide",
    summary: opts.summary,
    body: opts.body ?? "Body",
    author_id: opts.authorId,
    approved_at: new Date().toISOString(),
  });
  await admin
    .from("guides")
    .update({ current_revision_id: revision.id })
    .eq("id", guide.id)
    .throwOnError();
  await admin
    .from("guide_bases")
    .update({ canonical_guide_id: guide.id })
    .eq("id", base.id)
    .throwOnError();
  return { base, guide, revision };
}

export function createVote(
  voterId: string,
  guideId: string,
  overrides: Partial<Insert<"votes">> = {}
) {
  return insert("votes", {
    voter_id: voterId,
    guide_id: guideId,
    direction: "up",
    ...overrides,
  });
}
