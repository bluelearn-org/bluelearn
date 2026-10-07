import { beforeAll, describe, expect, it } from "vitest";
import app from "../src/index";
import { admin, env, jsonAuth, makeUser } from "./helpers";
import { createPublishedGuide } from "./factories/guides";
import { createPrerequisite } from "./factories/graph";
import { grantRole } from "./factories/identity";
import { createSubject, tagGuideRevision } from "./factories/subjects";
import { expectToMatchSpec } from "./openapi";

type Node = { id: string; is_floor?: boolean };
type FloorGuide = { id: string; slug: string | null; title: string | null };

let adminToken: string;

beforeAll(async () => {
  const { token, userId } = await makeUser();
  await grantRole(userId, "admin");
  adminToken = token;
});

// arithmetic -> algebra -> mechanics: each is a prerequisite of the next.
async function chain() {
  const arithmetic = await createPublishedGuide({ title: "Arithmetic" });
  const algebra = await createPublishedGuide({ title: "Algebra" });
  const mechanics = await createPublishedGuide({ title: "Mechanics" });
  await createPrerequisite(arithmetic.base.id, algebra.base.id);
  await createPrerequisite(algebra.base.id, mechanics.base.id);
  return { arithmetic, algebra, mechanics };
}

async function addToFloor(subjectId: string, guideBaseId: string) {
  await admin
    .from("subject_prerequisite_floors")
    .insert({ subject_id: subjectId, guide_base_id: guideBaseId })
    .throwOnError();
}

// Bases are typed with a nullable slug (it is minted at first publish); the
// factory always sets one.
async function walkthrough(baseSlug: string | null, query = "") {
  const res = await app.request(
    `/guides/${baseSlug}/walkthrough${query}`,
    {},
    env
  );
  expect(res.status).toBe(200);
  await expectToMatchSpec(res, "GET", "/guides/{slug}/walkthrough");
  const { nodes } = (await res.json()) as { nodes: Node[] };
  return new Map(nodes.map((node) => [node.id, node]));
}

function putFloor(token: string, subjectSlug: string, body: unknown) {
  return app.request(
    `/subjects/${subjectSlug}/floor`,
    jsonAuth(token, "PUT", body),
    env
  );
}

async function getFloor(subjectSlug: string) {
  const res = await app.request(`/subjects/${subjectSlug}/floor`, {}, env);
  expect(res.status).toBe(200);
  await expectToMatchSpec(res, "GET", "/subjects/{slug}/floor");
  return ((await res.json()) as { floor: FloorGuide[] }).floor;
}

describe("GET /guides/{slug}/walkthrough?subject=", () => {
  it("stops the climb at the subject's floor and flags the floor guide", async () => {
    const { arithmetic, algebra, mechanics } = await chain();
    const physics = await createSubject();
    await tagGuideRevision(mechanics.revision.id, physics.id);
    await addToFloor(physics.id, algebra.base.id);

    const nodes = await walkthrough(
      mechanics.base.slug,
      `?subject=${physics.slug}`
    );

    expect([...nodes.keys()].sort()).toEqual(
      [algebra.base.id, mechanics.base.id].sort()
    );
    expect(nodes.get(algebra.base.id)?.is_floor).toBe(true);
    expect(nodes.get(mechanics.base.id)?.is_floor).toBe(false);
    expect(nodes.has(arithmetic.base.id)).toBe(false);
  });

  it("climbs past the floor when unscoped or scoped to a subject without one", async () => {
    const { arithmetic, algebra, mechanics } = await chain();
    const physics = await createSubject();
    const chemistry = await createSubject();
    await addToFloor(physics.id, algebra.base.id);
    const all = [arithmetic.base.id, algebra.base.id, mechanics.base.id].sort();

    const unscoped = await walkthrough(mechanics.base.slug);
    const otherSubject = await walkthrough(
      mechanics.base.slug,
      `?subject=${chemistry.slug}`
    );

    expect([...unscoped.keys()].sort()).toEqual(all);
    expect(
      [...unscoped.values()].every((node) => node.is_floor === false)
    ).toBe(true);
    expect([...otherSubject.keys()].sort()).toEqual(all);
  });

  it("keeps follow-ups when scoped", async () => {
    const { algebra, mechanics } = await chain();
    const thermodynamics = await createPublishedGuide();
    await createPrerequisite(mechanics.base.id, thermodynamics.base.id);
    const physics = await createSubject();
    await addToFloor(physics.id, algebra.base.id);

    const nodes = await walkthrough(
      mechanics.base.slug,
      `?subject=${physics.slug}`
    );

    expect([...nodes.keys()].sort()).toEqual(
      [algebra.base.id, mechanics.base.id, thermodynamics.base.id].sort()
    );
  });

  it("shows only the target when the target itself is in the floor", async () => {
    const { algebra } = await chain();
    const physics = await createSubject();
    await addToFloor(physics.id, algebra.base.id);

    const nodes = await walkthrough(
      algebra.base.slug,
      `?subject=${physics.slug}&followUpDepth=0`
    );

    expect([...nodes.keys()]).toEqual([algebra.base.id]);
    expect(nodes.get(algebra.base.id)?.is_floor).toBe(true);
  });

  it("404s an unknown subject", async () => {
    const { mechanics } = await chain();

    const res = await app.request(
      `/guides/${mechanics.base.slug}/walkthrough?subject=no-such-subject`,
      {},
      env
    );

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "GET", "/guides/{slug}/walkthrough");
  });
});

describe("GET /subjects/{slug}/floor", () => {
  it("lists the floor guides with their live titles, by title", async () => {
    const physics = await createSubject();
    const later = await createPublishedGuide({ title: "Vectors" });
    const earlier = await createPublishedGuide({ title: "Algebra" });
    await addToFloor(physics.id, later.base.id);
    await addToFloor(physics.id, earlier.base.id);

    const floor = await getFloor(physics.slug!);

    expect(floor).toEqual([
      { id: earlier.base.id, slug: earlier.base.slug, title: "Algebra" },
      { id: later.base.id, slug: later.base.slug, title: "Vectors" },
    ]);
  });

  it("is empty for a subject without a floor", async () => {
    const physics = await createSubject();

    expect(await getFloor(physics.slug!)).toEqual([]);
  });

  it("404s an unknown subject", async () => {
    const res = await app.request("/subjects/no-such-subject/floor", {}, env);

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "GET", "/subjects/{slug}/floor");
  });
});

describe("PUT /subjects/{slug}/floor", () => {
  it("401s without a token", async () => {
    const physics = await createSubject();

    const res = await app.request(
      `/subjects/${physics.slug}/floor`,
      { method: "PUT" },
      env
    );

    expect(res.status).toBe(401);
    await expectToMatchSpec(res, "PUT", "/subjects/{slug}/floor");
  });

  it("403s a member who is not an admin", async () => {
    const physics = await createSubject();
    const guide = await createPublishedGuide();
    const member = await makeUser();

    const res = await putFloor(member.token, physics.slug!, {
      guide_base_ids: [guide.base.id],
    });

    expect(res.status).toBe(403);
    await expectToMatchSpec(res, "PUT", "/subjects/{slug}/floor");
    expect(await getFloor(physics.slug!)).toEqual([]);
  });

  it("replaces the floor as a whole for an admin", async () => {
    const physics = await createSubject();
    const a = await createPublishedGuide({ title: "A" });
    const b = await createPublishedGuide({ title: "B" });
    const c = await createPublishedGuide({ title: "C" });
    const ids = (floor: FloorGuide[]) => floor.map((guide) => guide.id).sort();

    const first = await putFloor(adminToken, physics.slug!, {
      guide_base_ids: [a.base.id, b.base.id],
    });
    expect(first.status).toBe(200);
    await expectToMatchSpec(first, "PUT", "/subjects/{slug}/floor");
    expect(
      ids(((await first.json()) as { floor: FloorGuide[] }).floor)
    ).toEqual([a.base.id, b.base.id].sort());

    const second = await putFloor(adminToken, physics.slug!, {
      guide_base_ids: [b.base.id, c.base.id, c.base.id],
    });
    expect(second.status).toBe(200);
    expect(ids(await getFloor(physics.slug!))).toEqual(
      [b.base.id, c.base.id].sort()
    );

    const cleared = await putFloor(adminToken, physics.slug!, {
      guide_base_ids: [],
    });
    expect(cleared.status).toBe(200);
    expect(await getFloor(physics.slug!)).toEqual([]);
  });

  it("404s a guide that does not exist", async () => {
    const physics = await createSubject();

    const res = await putFloor(adminToken, physics.slug!, {
      guide_base_ids: [crypto.randomUUID()],
    });

    expect(res.status).toBe(404);
    await expectToMatchSpec(res, "PUT", "/subjects/{slug}/floor");
  });

  it("404s an unknown subject", async () => {
    const res = await putFloor(adminToken, "no-such-subject", {
      guide_base_ids: [],
    });

    expect(res.status).toBe(404);
  });

  it("400s ids that are not uuids", async () => {
    const physics = await createSubject();

    const res = await putFloor(adminToken, physics.slug!, {
      guide_base_ids: ["algebra"],
    });

    expect(res.status).toBe(400);
    await expectToMatchSpec(res, "PUT", "/subjects/{slug}/floor");
  });
});
