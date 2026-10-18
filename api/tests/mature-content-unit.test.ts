import { describe, expect, it, vi } from "vitest";
import { dateOfBirthSchema, isAdult } from "@bluelearn/schemas";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/database.types";
import {
  getContentAccess,
  getDateOfBirth,
} from "../src/services/mature-content.service";
import {
  getGuideBySlug,
  getVariantBySlug,
} from "../src/services/guide.service";

const today = new Date("2026-09-17T00:00:00Z");
describe("age validation", () => {
  it.each([
    ["2008-09-17", true],
    ["2008-09-18", false],
    ["2008-09-16", true],
    ["2009-01-01", false],
    ["2000-01-01", true],
    ["2027-01-01", false],
    ["2000-02-30", false],
    ["bad-date", false],
  ])("checks %s at the birthday boundary", (birthDate, expected) => {
    expect(isAdult(birthDate, today)).toBe(expected);
  });
  it("handles leap-day birthdays without rolling February 29 into February 28", () => {
    expect(isAdult("2008-02-29", new Date("2026-02-28T23:59:59Z"))).toBe(false);
    expect(isAdult("2008-02-29", new Date("2026-03-01T00:00:00Z"))).toBe(true);
  });
  it("rejects invalid and future dates", () => {
    for (const date of ["9999-01-01", "2001-02-29", "", "2000-13-01"]) {
      expect(dateOfBirthSchema.safeParse(date).success).toBe(false);
    }
  });
});

const body = "Restricted body must never be serialized";
function database({
  signedIn = true,
  birthDate = "1990-01-01",
  mature = true,
  profileError = false,
  hiddenRevision = false,
}: {
  signedIn?: boolean;
  birthDate?: string | null;
  mature?: boolean;
  profileError?: boolean;
  hiddenRevision?: boolean;
} = {}) {
  const revision = {
    id: "revision",
    title: "Guide title",
    summary: "Summary",
    body,
    word_count: 40,
    created_at: "2026-09-17T00:00:00Z",
  };
  const variant = {
    id: "variant",
    slug: "main",
    guide_base_id: "base",
    author_id: null,
    status: "published",
    current: hiddenRevision ? null : revision,
    base: { is_official: false, knowledge_type: "theoretical" },
  };
  const tables: Record<string, unknown> = {
    account_details: { date_of_birth: birthDate },
    guide_bases: {
      id: "base",
      slug: "guide",
      canonical: variant,
      created_at: revision.created_at,
      is_official: false,
      knowledge_type: "theoretical",
    },
    guides: variant,
    guide_disclaimers: mature ? [{ disclaimers: { slug: "mature" } }] : [],
    guide_vote_tallies: { upvotes: 0, downvotes: 0 },
  };
  const getUser = vi
    .fn()
    .mockResolvedValue({ data: { user: signedIn ? { id: "user" } : null } });
  const from = vi.fn((table: string) => {
    const result = {
      data: tables[table] ?? [],
      error:
        table === "account_details" && profileError
          ? new Error("DB unavailable")
          : null,
    };
    const chain: Record<string, unknown> = {};
    for (const name of [
      "select",
      "eq",
      "in",
      "neq",
      "order",
      "maybeSingle",
      "single",
    ])
      chain[name] = () => chain;
    chain.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result).then(resolve);
    return chain;
  });
  const db = {
    from,
    auth: { getUser },
    rpc: vi.fn().mockResolvedValue({
      data: [{ ...revision, body: undefined }],
      error: null,
    }),
  };
  return { db: db as unknown as SupabaseClient<Database>, getUser, from };
}

describe("mature content access", () => {
  it.each([
    [{ signedIn: false }, "sign_in_required"],
    [{ birthDate: null }, "date_of_birth_required"],
    [{ birthDate: new Date().toISOString().slice(0, 10) }, "underage"],
    [{}, "confirmation_required"],
  ])(
    "withholds canonical and variant bodies for %j",
    async (options, expected) => {
      const { db } = database(options);
      const guide = await getGuideBySlug(db, "guide");
      const { variant } = await getVariantBySlug(db, "guide", "main");
      expect(guide.content_access).toBe(expected);
      expect(variant.content_access).toBe(expected);
      expect(JSON.stringify({ guide, variant })).not.toContain(body);
      expect(guide.title).toBe("Guide title");
    }
  );
  it.each([
    { signedIn: false },
    { birthDate: null },
    { birthDate: "2020-01-01" },
  ])("a forged confirmation cannot bypass eligibility: %j", async (options) => {
    const { db } = database(options);
    expect((await getGuideBySlug(db, "guide", true)).body).toBeNull();
    expect(
      (await getVariantBySlug(db, "guide", "main", true)).variant.current?.body
    ).toBeNull();
  });
  it("returns bodies only after an adult confirms", async () => {
    const { db } = database();
    expect((await getGuideBySlug(db, "guide", true)).body).toBe(body);
    expect(
      (await getVariantBySlug(db, "guide", "main", true)).variant.current?.body
    ).toBe(body);
  });
  it("does not gate ordinary guides or require an auth lookup", async () => {
    const { db, getUser } = database({ mature: false, signedIn: false });
    expect((await getGuideBySlug(db, "guide")).body).toBe(body);
    expect(
      (await getVariantBySlug(db, "guide", "main")).variant.current?.body
    ).toBe(body);
    expect(getUser).not.toHaveBeenCalled();
  });
  it("fails closed if account data cannot be loaded", async () => {
    const { db } = database({ profileError: true });
    await expect(getContentAccess(db, ["mature"], true)).rejects.toThrow(
      "Failed to load account details"
    );
    await expect(getDateOfBirth(db, "user")).rejects.toThrow();
  });
  it("keeps the published header when database RLS withholds the revision", async () => {
    const { db } = database({ hiddenRevision: true, signedIn: false });
    const guide = await getGuideBySlug(db, "guide");
    const { variant } = await getVariantBySlug(db, "guide", "main");
    expect(guide.title).toBe("Guide title");
    expect(variant.current?.title).toBe("Guide title");
    expect(guide.body).toBeNull();
    expect(variant.current?.body).toBeNull();
  });
});
