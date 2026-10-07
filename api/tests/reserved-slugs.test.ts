import { describe, expect, it } from "vitest";
import app from "../src/index";
import { admin, env } from "./helpers";
import {
  createGuide,
  createGuideBase,
  createPublishedGuide,
} from "./factories/guides";

// /guides/{base}/walkthrough, /variants and /objectives are routes, so a
// variant can never sit at one of those slugs.
describe("reserved variant slugs", () => {
  it.each(["walkthrough", "variants", "objectives"])(
    "stores a variant slugged %s under %s-guide",
    async (word) => {
      const base = await createGuideBase();

      const guide = await createGuide(base.id, { slug: word });

      expect(guide.slug).toBe(`${word}-guide`);
    }
  );

  it("numbers a second reserved sibling like any other slug clash", async () => {
    const base = await createGuideBase();
    await createGuide(base.id, { slug: "walkthrough" });

    const second = await createGuide(base.id, { slug: "walkthrough" });

    expect(second.slug).toBe("walkthrough-guide-2");
  });

  it("leaves slugs that merely contain a route word alone", async () => {
    const base = await createGuideBase();

    const guide = await createGuide(base.id, { slug: "walkthrough-notes" });

    expect(guide.slug).toBe("walkthrough-notes");
  });

  it("also rewrites a reserved slug set by an update", async () => {
    const { guide } = await createPublishedGuide();

    const { data, error } = await admin
      .from("guides")
      .update({ slug: "objectives" })
      .eq("id", guide.id)
      .select("slug")
      .single();

    expect(error).toBeNull();
    expect(data?.slug).toBe("objectives-guide");
  });

  it("keeps the suffixed variant reachable while the route still answers", async () => {
    const { base } = await createPublishedGuide();
    const variant = await createGuide(base.id, {
      slug: "walkthrough",
      status: "published",
    });

    const asVariant = await app.request(
      `/guides/${base.slug}/${variant.slug}`,
      {},
      env
    );
    const asRoute = await app.request(
      `/guides/${base.slug}/walkthrough`,
      {},
      env
    );

    expect(variant.slug).toBe("walkthrough-guide");
    expect(asVariant.status).toBe(200);
    expect(asRoute.status).toBe(200);
    expect((await asVariant.json()) as object).toHaveProperty("variant");
    expect((await asRoute.json()) as object).not.toHaveProperty("variant");
  });
});
