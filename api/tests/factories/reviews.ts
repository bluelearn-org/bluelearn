import { admin, insert, makeUser, type Insert } from "../helpers";
import { createGuideBase, createGuide, createGuideRevision } from "./guides";

export function createReviewCase(
  createdBy: string,
  overrides: Partial<Insert<"review_cases">> = {}
) {
  return insert("review_cases", {
    case_type: "guide_publish",
    status: "pending",
    created_by: createdBy,
    ...overrides,
  });
}

export function createReviewPanel(
  caseId: string,
  overrides: Partial<Insert<"review_panels">> = {}
) {
  return insert("review_panels", {
    case_id: caseId,
    target_seat_count: 1,
    ...overrides,
  });
}

export function createPanelMember(
  panelId: string,
  memberId: string,
  overrides: Partial<Insert<"panel_members">> = {}
) {
  return insert("panel_members", {
    panel_id: panelId,
    member_id: memberId,
    status: "assigned",
    ...overrides,
  });
}

export function createGuideReviewCase(
  caseId: string,
  guideRevisionId: string,
  overrides: Partial<Insert<"guide_review_cases">> = {}
) {
  return insert("guide_review_cases", {
    case_id: caseId,
    guide_revision_id: guideRevisionId,
    ...overrides,
  });
}

export async function createVerifier() {
  const user = await makeUser();
  await admin
    .from("user_roles")
    .insert({ user_id: user.userId, role: "verifier" })
    .throwOnError();
  return user;
}

// The verifier pool is global across the whole test database, so a test that
// needs an exact pool size must first suspend every verifier other tests left
// behind, then seat the handful it controls.
export async function suspendAllVerifiers() {
  const { data } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "verifier");
  const ids = (data ?? []).map((r) => r.user_id);
  if (ids.length > 0) {
    await admin
      .from("profiles")
      .update({ is_suspended: true })
      .in("id", ids)
      .throwOnError();
  }
}

// A pending guide_publish case linked to a fresh submitted revision, with no
// panel yet.
export async function seedPendingReviewCase(
  authorId: string,
  title = "Topology"
) {
  const base = await createGuideBase();
  const guide = await createGuide(base.id);
  const revision = await createGuideRevision(guide.id, { title });
  const reviewCase = await createReviewCase(authorId, {
    case_type: "guide_publish",
    status: "pending",
  });
  await createGuideReviewCase(reviewCase.id, revision.id);
  return { reviewCase, base, guide, revision };
}

// An in-review case with an N-seat panel of fresh panelists, linked to the given
// revision. Returns the panelists, so a test can cast their votes.
export async function seedSeatedReviewCase(opts: {
  caseType: Insert<"review_cases">["case_type"];
  seats: number;
  revisionId: string;
}) {
  const author = await makeUser();
  const reviewCase = await createReviewCase(author.userId, {
    case_type: opts.caseType,
    status: "in_review",
  });
  const panel = await createReviewPanel(reviewCase.id, {
    target_seat_count: opts.seats,
  });
  const panelists = [];
  for (let i = 0; i < opts.seats; i++) {
    const u = await makeUser();
    await createPanelMember(panel.id, u.userId);
    panelists.push(u);
  }
  await createGuideReviewCase(reviewCase.id, opts.revisionId);
  return { reviewCase, panel, panelists };
}
