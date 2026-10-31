import { describe, it, expect } from "vitest";
import type { DisclaimerSlug } from "@bluelearn/schemas";
import app from "../src/index";
import {
  replaceDisclaimers,
  replaceRevisionDisclaimers,
} from "../src/services/disclaimer.service";
import { admin, auth, env, jsonAuth, makeUser } from "./helpers";
import { createGuideRevision, createPublishedGuide } from "./factories/guides";
import {
  createGuideReviewCase,
  createReviewCase,
  seedSeatedReviewCase,
} from "./factories/reviews";
import { expectToMatchSpec } from "./openapi";

async function baseDisclaimers(baseId: string) {
  const { data } = await admin
    .from("guide_disclaimers")
    .select("disclaimers!inner(slug)")
    .eq("guide_base_id", baseId)
    .throwOnError();
  return (data ?? []).map((r) => r.disclaimers.slug).sort();
}

async function revisionDisclaimers(revisionId: string) {
  const { data } = await admin
    .from("guide_revision_disclaimers")
    .select("disclaimers!inner(slug)")
    .eq("guide_revision_id", revisionId)
    .throwOnError();
  return (data ?? []).map((r) => r.disclaimers.slug).sort();
}

// A published guide whose base carries `disclaimers`, plus a draft revision of
// it by `authorId`.
async function publishedWithDraft(
  authorId: string,
  disclaimers: DisclaimerSlug[]
) {
  const published = await createPublishedGuide({ authorId });
  await replaceDisclaimers(admin, published.base.id, disclaimers);
  const draft = await createGuideRevision(published.guide.id, {
    status: "draft",
    author_id: authorId,
  });
  return { ...published, draft };
}

async function approve(caseType: "guide_edit" | "guide_publish", id: string) {
  const { reviewCase, panelists } = await seedSeatedReviewCase({
    caseType,
    seats: 3,
    revisionId: id,
  });
  for (const p of panelists.slice(0, 2)) {
    await app.request(
      `/reviews/cases/${reviewCase.id}/decisions`,
      jsonAuth(p.token, "POST", { decision: "approved" }),
      env
    );
  }
  return reviewCase;
}

describe("revision disclaimers", () => {
  it("start from the base's disclaimers", async () => {
    const author = await makeUser();
    const { draft } = await publishedWithDraft(author.userId, ["medical"]);

    expect(await revisionDisclaimers(draft.id)).toEqual(["medical"]);
  });

  it("save on a published guide's draft without touching the live guide", async () => {
    const author = await makeUser();
    const { base, draft } = await publishedWithDraft(author.userId, [
      "medical",
    ]);

    const res = await app.request(
      `/guide-revisions/${draft.id}`,
      jsonAuth(author.token, "PATCH", { disclaimers: ["legal", "financial"] }),
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "PATCH", "/guide-revisions/{id}");
    expect(await revisionDisclaimers(draft.id)).toEqual(["financial", "legal"]);
    expect(await baseDisclaimers(base.id)).toEqual(["medical"]);
  });

  it("come back with the revision", async () => {
    const author = await makeUser();
    const { draft } = await publishedWithDraft(author.userId, ["medical"]);
    await replaceRevisionDisclaimers(admin, draft.id, ["legal"]);

    const res = await app.request(
      `/guide-revisions/${draft.id}`,
      auth(author.token),
      env
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { disclaimers: string[] };
    expect(body.disclaimers).toEqual(["legal"]);
  });

  it("can't be set on someone else's draft", async () => {
    const author = await makeUser();
    const stranger = await makeUser();
    const { draft } = await publishedWithDraft(author.userId, ["medical"]);

    const res = await app.request(
      `/guide-revisions/${draft.id}`,
      jsonAuth(stranger.token, "PATCH", { disclaimers: [] }),
      env
    );

    expect(res.status).toBe(404);
    expect(await revisionDisclaimers(draft.id)).toEqual(["medical"]);
  });
});

describe("disclaimers on approval", () => {
  it("replace the base's set when an edit is approved", async () => {
    const author = await makeUser();
    const { base, guide } = await publishedWithDraft(author.userId, [
      "medical",
    ]);
    const edit = await createGuideRevision(guide.id, { title: "Edited" });
    await replaceRevisionDisclaimers(admin, edit.id, ["legal"]);

    await approve("guide_edit", edit.id);

    expect(await baseDisclaimers(base.id)).toEqual(["legal"]);
  });

  it("clear the base's set when the approved edit removed them all", async () => {
    const author = await makeUser();
    const { base, guide } = await publishedWithDraft(author.userId, [
      "medical",
    ]);
    const edit = await createGuideRevision(guide.id, { title: "Edited" });
    await replaceRevisionDisclaimers(admin, edit.id, []);

    await approve("guide_edit", edit.id);

    expect(await baseDisclaimers(base.id)).toEqual([]);
  });

  it("leave the base alone when the edit is rejected", async () => {
    const author = await makeUser();
    const { base, guide } = await publishedWithDraft(author.userId, [
      "medical",
    ]);
    const edit = await createGuideRevision(guide.id, { title: "Edited" });
    await replaceRevisionDisclaimers(admin, edit.id, ["legal"]);
    const { reviewCase, panelists } = await seedSeatedReviewCase({
      caseType: "guide_edit",
      seats: 3,
      revisionId: edit.id,
    });
    for (const p of panelists.slice(0, 2)) {
      await app.request(
        `/reviews/cases/${reviewCase.id}/decisions`,
        jsonAuth(p.token, "POST", {
          decision: "rejected",
          notes: "Not yet",
          reasons: ["factual_error"],
        }),
        env
      );
    }

    const { data: c } = await admin
      .from("review_cases")
      .select("status")
      .eq("id", reviewCase.id)
      .single();
    expect(c?.status).toBe("rejected");
    expect(await baseDisclaimers(base.id)).toEqual(["medical"]);
  });
});

describe("disclaimers on creation", () => {
  it("are proposed on a new guide's draft and land on approval", async () => {
    const author = await makeUser();

    const res = await app.request(
      "/guides",
      jsonAuth(author.token, "POST", {
        title: "Dosage Basics",
        disclaimers: ["medical"],
      }),
      env
    );
    expect(res.status).toBe(201);
    const { revision_id } = (await res.json()) as { revision_id: string };
    expect(await revisionDisclaimers(revision_id)).toEqual(["medical"]);

    const { data: rev } = await admin
      .from("guide_revisions")
      .select("guides!guide_revisions_guide_id_fkey!inner(guide_base_id)")
      .eq("id", revision_id)
      .single();
    const baseId = rev!.guides.guide_base_id;
    expect(await baseDisclaimers(baseId)).toEqual([]);

    await admin
      .from("guide_revisions")
      .update({ status: "submitted" })
      .eq("id", revision_id)
      .throwOnError();
    await approve("guide_publish", revision_id);

    expect(await baseDisclaimers(baseId)).toEqual(["medical"]);
  });

  it("let a new variant change the base guide's set", async () => {
    const author = await makeUser();
    const { base } = await publishedWithDraft(author.userId, ["medical"]);

    const res = await app.request(
      `/guides/${base.slug}/variants`,
      jsonAuth(author.token, "POST", {
        title: "Joins, visually",
        disclaimers: ["legal"],
      }),
      env
    );

    expect(res.status).toBe(201);
    const { revision_id } = (await res.json()) as { revision_id: string };
    expect(await revisionDisclaimers(revision_id)).toEqual(["legal"]);
    expect(await baseDisclaimers(base.id)).toEqual(["medical"]);
  });

  it("keep the base guide's set when a new variant sends none", async () => {
    const author = await makeUser();
    const { base } = await publishedWithDraft(author.userId, ["medical"]);

    const res = await app.request(
      `/guides/${base.slug}/variants`,
      jsonAuth(author.token, "POST", { title: "Joins, visually" }),
      env
    );

    expect(res.status).toBe(201);
    const { revision_id } = (await res.json()) as { revision_id: string };
    expect(await revisionDisclaimers(revision_id)).toEqual(["medical"]);
  });
});

describe("disclaimers on revise", () => {
  it("carry the rejected revision's set into the fork", async () => {
    const author = await makeUser();
    const { guide } = await publishedWithDraft(author.userId, ["medical"]);
    const rejected = await createGuideRevision(guide.id, {
      status: "submitted",
      author_id: author.userId,
    });
    await replaceRevisionDisclaimers(admin, rejected.id, ["legal"]);
    const reviewCase = await createReviewCase(author.userId, {
      case_type: "guide_edit",
      status: "rejected",
    });
    await createGuideReviewCase(reviewCase.id, rejected.id);

    const res = await app.request(
      `/guide-revisions/${rejected.id}/revise`,
      { method: "POST", ...auth(author.token) },
      env
    );
    expect(res.status).toBe(201);
    const { revision_id } = (await res.json()) as { revision_id: string };

    expect(await revisionDisclaimers(revision_id)).toEqual(["legal"]);
  });
});

describe("disclaimers in review", () => {
  it("come back with the case's revision", async () => {
    const author = await makeUser();
    const { guide } = await publishedWithDraft(author.userId, ["medical"]);
    const edit = await createGuideRevision(guide.id, { title: "Edited" });
    await replaceRevisionDisclaimers(admin, edit.id, ["legal"]);
    const { reviewCase, panelists } = await seedSeatedReviewCase({
      caseType: "guide_edit",
      seats: 3,
      revisionId: edit.id,
    });

    const res = await app.request(
      `/reviews/cases/${reviewCase.id}`,
      auth(panelists[0].token),
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/reviews/cases/{id}");
    const body = (await res.json()) as {
      revision: { disclaimers: string[] };
    };
    expect(body.revision.disclaimers).toEqual(["legal"]);
  });

  it("show up in the diff against the previous revision", async () => {
    const author = await makeUser();
    const { guide, revision } = await createPublishedGuide({
      authorId: author.userId,
    });
    await replaceRevisionDisclaimers(admin, revision.id, [
      "financial",
      "medical",
    ]);
    const edit = await createGuideRevision(guide.id, {
      status: "submitted",
      author_id: author.userId,
    });
    await replaceRevisionDisclaimers(admin, edit.id, ["legal", "medical"]);

    const res = await app.request(
      `/guide-revisions/${edit.id}/diff/prev`,
      {},
      env
    );

    expect(res.status).toBe(200);
    await expectToMatchSpec(res, "GET", "/guide-revisions/{id}/diff/prev");
    const body = (await res.json()) as { disclaimers: unknown };
    expect(body.disclaimers).toEqual({
      changed: true,
      added: ["legal"],
      removed: ["financial"],
      unchanged: ["medical"],
    });
  });

  it("diff as unchanged when the set is the same", async () => {
    const author = await makeUser();
    const { guide, revision } = await createPublishedGuide({
      authorId: author.userId,
    });
    await replaceRevisionDisclaimers(admin, revision.id, ["medical"]);
    const edit = await createGuideRevision(guide.id, {
      status: "submitted",
      author_id: author.userId,
    });
    await replaceRevisionDisclaimers(admin, edit.id, ["medical"]);

    const res = await app.request(
      `/guide-revisions/${edit.id}/diff/prev`,
      {},
      env
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      disclaimers: { changed: boolean };
    };
    expect(body.disclaimers.changed).toBe(false);
  });
});
