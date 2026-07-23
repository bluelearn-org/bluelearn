import type { SupabaseClient } from "@supabase/supabase-js";
import type { UpdateProfileInput } from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";

type DB = SupabaseClient<Database>;

type GuideDraft = {
  revision_id: string;
  guide_id: string;
  title: string;
  guide_slug: string | null;
  created_at: string;
  updated_at: string;
};

type ObjectiveDraft = {
  revision_id: string;
  objective_id: string;
  title: string;
  objective_slug: string | null;
  created_at: string;
  updated_at: string;
};

async function fetchRoles(supabase: DB, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return data?.map((r) => r.role) ?? [];
}

// Public badges. user_roles RLS hides other users' roles, so this reads with the
// service client (RLS bypass) and excludes admin in code.
async function fetchPublicBadges(service: DB, userId: string) {
  const { data } = await service
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .neq("role", "admin");
  return data?.map((r) => r.role) ?? [];
}

// Escape LIKE metacharacters so a username containing `_` is matched literally
// rather than as a wildcard.
const escapeLike = (value: string) => value.replace(/[%_\\]/g, "\\$&");

// Map profile ids to their @username. Listing cards show the original
// author/curator, so callers pass creator ids and read the handle back.
export async function loadUsernames(supabase: DB, ids: Array<string | null>) {
  const map = new Map<string, string>();
  const unique = [...new Set(ids.filter((id): id is string => id !== null))];
  if (unique.length === 0) return map;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", unique);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load authors", 500);
  }
  for (const p of data ?? []) map.set(p.id, p.username);
  return map;
}

// The caller's own profile row and roles.
export async function getMyIdentity(supabase: DB, userId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !profile) throw new ServiceError("Profile not found", 404);

  const roles = await fetchRoles(supabase, userId);
  return { profile, roles };
}

// The caller's own draft revisions. Guide drafts and objective drafts are returned
// as separate lists, each ordered most-recently-edited first.
export async function getMyDrafts(
  supabase: DB,
  userId: string
): Promise<{ guide_drafts: GuideDraft[]; objective_drafts: ObjectiveDraft[] }> {
  const [guides, objectives] = await Promise.all([
    supabase
      .from("guide_revisions")
      .select(
        // Two FKs relate revisions to guides (authorship + live pointer);
        // drafts hang off the authorship one.
        "id, guide_id, title, created_at, updated_at, guides!guide_revisions_guide_id_fkey(slug)"
      )
      .eq("author_id", userId)
      .eq("status", "draft")
      .order("updated_at", { ascending: false }),
    supabase
      .from("objective_revisions")
      .select(
        "id, objective_id, title, created_at, updated_at, objectives!objective_revisions_objective_id_fkey(slug)"
      )
      .eq("author_id", userId)
      .eq("status", "draft")
      .order("updated_at", { ascending: false }),
  ]);

  if (guides.error) {
    console.error(guides.error);
    throw new ServiceError("Failed to load drafts", 500);
  }
  if (objectives.error) {
    console.error(objectives.error);
    throw new ServiceError("Failed to load drafts", 500);
  }

  return {
    guide_drafts: guides.data.map((r) => ({
      revision_id: r.id,
      guide_id: r.guide_id,
      title: r.title ?? "Untitled",
      guide_slug: r.guides?.slug ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
    objective_drafts: objectives.data.map((r) => ({
      revision_id: r.id,
      objective_id: r.objective_id,
      title: r.title ?? "Untitled",
      objective_slug: r.objectives?.slug ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
  };
}

// Apply the caller's profile edits and return the updated row and roles.
export async function updateMyProfile(
  supabase: DB,
  userId: string,
  updates: UpdateProfileInput
) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    // unique_violation: username (or its case-insensitive form) is taken.
    if (error.code === "23505")
      throw new ServiceError("Username already taken", 409);
    console.error(error);
    throw new ServiceError("Failed to update profile", 500);
  }

  const roles = await fetchRoles(supabase, userId);
  return { profile, roles };
}

// A public profile by username. Reads roles with the service client because
// user_roles RLS hides them; suspended members are treated as not found.
export async function getPublicProfile(
  supabase: DB,
  service: DB,
  username: string
) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, created_at")
    .ilike("username", escapeLike(username))
    .eq("is_suspended", false)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load profile", 500);
  }
  if (!profile) throw new ServiceError("Profile not found", 404);

  const roles = await fetchPublicBadges(service, profile.id);

  // Drop the internal id from the public payload.
  const { id: _id, ...publicProfile } = profile;
  return { profile: publicProfile, roles };
}

export type ProfileStats = {
  upvotes: number;
  downvotes: number;
  contributions: number;
  reviews: number;
};

export async function getMyProfileStats(
  supabase: DB,
  userId: string
): Promise<ProfileStats> {
  const fail = (error: unknown): never => {
    console.error(error);
    throw new ServiceError("Failed to load profile stats", 500);
  };

  const guides = await supabase
    .from("guides")
    .select("id")
    .eq("author_id", userId);
  if (guides.error) fail(guides.error);
  const guideIds = (guides.data ?? []).map((g) => g.id);

  let upvotes = 0;
  let downvotes = 0;
  if (guideIds.length > 0) {
    const tallies = await supabase
      .from("guide_vote_tallies")
      .select("upvotes, downvotes")
      .in("guide_id", guideIds);
    if (tallies.error) fail(tallies.error);
    for (const t of tallies.data ?? []) {
      upvotes += t.upvotes ?? 0;
      downvotes += t.downvotes ?? 0;
    }
  }

  const [guideRevs, objectiveRevs] = await Promise.all([
    supabase
      .from("guide_revisions")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId),
    supabase
      .from("objective_revisions")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId),
  ]);
  if (guideRevs.error) fail(guideRevs.error);
  if (objectiveRevs.error) fail(objectiveRevs.error);
  const contributions = (guideRevs.count ?? 0) + (objectiveRevs.count ?? 0);

  const seats = await supabase
    .from("panel_members")
    .select("id")
    .eq("member_id", userId);
  if (seats.error) fail(seats.error);
  const seatIds = (seats.data ?? []).map((s) => s.id);

  let reviews = 0;
  if (seatIds.length > 0) {
    const decisions = await supabase
      .from("review_decisions")
      .select("id", { count: "exact", head: true })
      .in("panel_member_id", seatIds);
    if (decisions.error) fail(decisions.error);
    reviews = decisions.count ?? 0;
  }

  return { upvotes, downvotes, contributions, reviews };
}

export type ProfileActivityRow = {
  content_kind: "guide" | "objective" | "review";
  is_variant: boolean;
  is_creation: boolean;
  title: string;
  change_summary: string | null;
  created_at: string;
  status:
    | "draft"
    | "submitted"
    | "pending"
    | "in_review"
    | "approved"
    | "rejected"
    | "published";
  target_slug: string | null;
  review_case_id: string | null;
};

// Earliest revision id per parent, so a row can be tagged as the "creation"
// (first revision of a guide/objective) rather than a later edit.
function findEarliestRevisionByParent<
  T extends { id: string; created_at: string },
>(rows: T[], parentOf: (row: T) => string): Map<string, string> {
  const earliest = new Map<string, string>();
  const seenAt = new Map<string, string>();
  for (const row of rows) {
    const parent = parentOf(row);
    const at = seenAt.get(parent);
    if (at === undefined || row.created_at < at) {
      seenAt.set(parent, row.created_at);
      earliest.set(parent, row.id);
    }
  }
  return earliest;
}

// The caller's activites, which include guide and objective revisions they
// authored and review cases they voted on.
export async function getMyActivity(
  supabase: DB,
  userId: string
): Promise<ProfileActivityRow[]> {
  const fail = (error: unknown): never => {
    console.error(error);
    throw new ServiceError("Failed to load activity", 500);
  };

  const rows: ProfileActivityRow[] = [];

  // Guide contributions.
  const guideRevs = await supabase
    .from("guide_revisions")
    .select("id, title, change_summary, created_at, status, guide_id")
    .eq("author_id", userId);
  if (guideRevs.error) fail(guideRevs.error);
  const myGuideRevs = guideRevs.data ?? [];

  if (myGuideRevs.length > 0) {
    const guideIds = [...new Set(myGuideRevs.map((r) => r.guide_id))];
    const revIds = myGuideRevs.map((r) => r.id);

    const [guides, allRevs, links] = await Promise.all([
      supabase
        .from("guides")
        .select("id, slug, guide_base_id")
        .in("id", guideIds),
      supabase
        .from("guide_revisions")
        .select("id, guide_id, created_at")
        .in("guide_id", guideIds),
      supabase
        .from("guide_review_cases")
        .select("guide_revision_id, case_id")
        .in("guide_revision_id", revIds),
    ]);
    if (guides.error) fail(guides.error);
    if (allRevs.error) fail(allRevs.error);
    if (links.error) fail(links.error);

    const baseIds = [
      ...new Set((guides.data ?? []).map((g) => g.guide_base_id)),
    ];
    const bases = await supabase
      .from("guide_bases")
      .select("id, canonical_guide_id")
      .in("id", baseIds);
    if (bases.error) fail(bases.error);

    const caseIds = (links.data ?? []).map((l) => l.case_id);
    const cases =
      caseIds.length > 0
        ? await supabase
            .from("review_cases")
            .select("id, status")
            .in("id", caseIds)
        : { data: [], error: null };
    if (cases.error) fail(cases.error);

    const guideById = new Map((guides.data ?? []).map((g) => [g.id, g]));
    const canonicalByBase = new Map(
      (bases.data ?? []).map((b) => [b.id, b.canonical_guide_id])
    );
    const caseByRev = new Map(
      (links.data ?? []).map((l) => [l.guide_revision_id, l.case_id])
    );
    const statusByCase = new Map(
      (cases.data ?? []).map((c) => [c.id, c.status])
    );
    const firstRev = findEarliestRevisionByParent(
      allRevs.data ?? [],
      (r) => r.guide_id
    );

    for (const rev of myGuideRevs) {
      const guide = guideById.get(rev.guide_id);
      const caseId = caseByRev.get(rev.id) ?? null;
      const status =
        rev.status === "draft"
          ? "draft"
          : caseId
            ? (statusByCase.get(caseId) ?? "submitted")
            : "submitted";
      rows.push({
        content_kind: "guide",
        is_variant: guide
          ? canonicalByBase.get(guide.guide_base_id) !== guide.id
          : false,
        is_creation: firstRev.get(rev.guide_id) === rev.id,
        title: rev.title ?? "Untitled",
        change_summary: rev.change_summary,
        created_at: rev.created_at,
        status,
        target_slug: guide?.slug ?? null,
        review_case_id: caseId,
      });
    }
  }

  const objectiveRevs = await supabase
    .from("objective_revisions")
    .select("id, title, change_summary, created_at, status, objective_id")
    .eq("author_id", userId);
  if (objectiveRevs.error) fail(objectiveRevs.error);
  const myObjectiveRevs = objectiveRevs.data ?? [];

  if (myObjectiveRevs.length > 0) {
    const objectiveIds = [
      ...new Set(myObjectiveRevs.map((r) => r.objective_id)),
    ];
    const [objectives, allRevs] = await Promise.all([
      supabase.from("objectives").select("id, slug").in("id", objectiveIds),
      supabase
        .from("objective_revisions")
        .select("id, objective_id, created_at")
        .in("objective_id", objectiveIds),
    ]);
    if (objectives.error) fail(objectives.error);
    if (allRevs.error) fail(allRevs.error);

    const slugById = new Map(
      (objectives.data ?? []).map((o) => [o.id, o.slug])
    );
    const firstRev = findEarliestRevisionByParent(
      allRevs.data ?? [],
      (r) => r.objective_id
    );

    for (const rev of myObjectiveRevs) {
      rows.push({
        content_kind: "objective",
        is_variant: false,
        is_creation: firstRev.get(rev.objective_id) === rev.id,
        title: rev.title ?? "Untitled",
        change_summary: rev.change_summary,
        created_at: rev.created_at,
        status: rev.status,
        target_slug: slugById.get(rev.objective_id) ?? null,
        review_case_id: null,
      });
    }
  }

  // Review cases the caller voted on.
  const seats = await supabase
    .from("panel_members")
    .select("id, panel_id")
    .eq("member_id", userId);
  if (seats.error) fail(seats.error);
  const mySeats = seats.data ?? [];

  if (mySeats.length > 0) {
    const seatIds = mySeats.map((s) => s.id);
    const decisions = await supabase
      .from("review_decisions")
      .select("panel_member_id, created_at")
      .in("panel_member_id", seatIds);
    if (decisions.error) fail(decisions.error);
    const myDecisions = decisions.data ?? [];

    if (myDecisions.length > 0) {
      const panelBySeat = new Map(mySeats.map((s) => [s.id, s.panel_id]));
      const votedSeatIds = myDecisions.map((d) => d.panel_member_id);
      const panelIds = [
        ...new Set(
          votedSeatIds
            .map((id) => panelBySeat.get(id))
            .filter((id): id is string => id != null)
        ),
      ];

      const panels = await supabase
        .from("review_panels")
        .select("id, case_id")
        .in("id", panelIds);
      if (panels.error) fail(panels.error);
      const caseByPanel = new Map(
        (panels.data ?? []).map((p) => [p.id, p.case_id])
      );
      const caseIds = [...new Set([...caseByPanel.values()])];

      const [cases, links] = await Promise.all([
        supabase.from("review_cases").select("id, status").in("id", caseIds),
        supabase
          .from("guide_review_cases")
          .select("case_id, guide_revision_id")
          .in("case_id", caseIds),
      ]);
      if (cases.error) fail(cases.error);
      if (links.error) fail(links.error);

      const revByCase = new Map(
        (links.data ?? []).map((l) => [l.case_id, l.guide_revision_id])
      );
      const revIds = [...new Set([...revByCase.values()])];
      const revs = await supabase
        .from("guide_revisions")
        .select("id, title, change_summary, guide_id")
        .in("id", revIds);
      if (revs.error) fail(revs.error);
      const guideIds = [...new Set((revs.data ?? []).map((r) => r.guide_id))];
      const guides = await supabase
        .from("guides")
        .select("id, slug")
        .in("id", guideIds);
      if (guides.error) fail(guides.error);

      const statusByCase = new Map(
        (cases.data ?? []).map((c) => [c.id, c.status])
      );
      const revById = new Map((revs.data ?? []).map((r) => [r.id, r]));
      const slugByGuide = new Map(
        (guides.data ?? []).map((g) => [g.id, g.slug])
      );

      for (const decision of myDecisions) {
        const panelId = panelBySeat.get(decision.panel_member_id);
        const caseId = panelId ? caseByPanel.get(panelId) : undefined;
        if (!caseId) continue;
        const rev = revByCase.get(caseId);
        const revData = rev ? revById.get(rev) : undefined;
        rows.push({
          content_kind: "review",
          is_variant: false,
          is_creation: false,
          title: revData?.title ?? "Untitled",
          change_summary: revData?.change_summary ?? null,
          created_at: decision.created_at,
          status: statusByCase.get(caseId) ?? "pending",
          target_slug: revData
            ? (slugByGuide.get(revData.guide_id) ?? null)
            : null,
          review_case_id: caseId,
        });
      }
    }
  }

  rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return rows;
}
