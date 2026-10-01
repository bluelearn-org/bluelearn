// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnyRoute } from "@tanstack/react-router";
import { buildPageMeta } from "@/lib/seo";
import { Route as ObjectivesRoute } from "@/routes/objectives.index";
import { Route as ObjectiveRoute } from "@/routes/objectives/$slug/index";
import { Route as SubjectsRoute } from "@/routes/subjects.index";
import { Route as SubjectRoute } from "@/routes/subjects.$slug";
import { Route as BrowseRoute } from "@/routes/browse";
import { Route as LoginRoute } from "@/routes/login";
import { Route as RegisterRoute } from "@/routes/register";
import { Route as TodosRoute } from "@/routes/todos";
import { Route as ContributeRoute } from "@/routes/contribute";

// These tests exercise route metadata without starting auth or the editor.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/components/contribute/ContributionFlow", () => ({
  default: () => null,
}));
vi.mock("@/routes/guides/$slug/index", () => ({
  Route: { to: "/guides/$slug" },
}));

function getHead(route: AnyRoute, loaderData?: unknown) {
  const head = route.options.head!;
  // These callbacks only read loaderData; the router supplies the other fields.
  return head({ loaderData } as Parameters<typeof head>[0]);
}

describe("buildPageMeta", () => {
  it("uses the same title and description for search and sharing", () => {
    expect(buildPageMeta("Subjects", "Find something to learn.")).toEqual([
      { title: "Subjects | Bluelearn" },
      { name: "description", content: "Find something to learn." },
      { property: "og:title", content: "Subjects | Bluelearn" },
      { property: "og:description", content: "Find something to learn." },
    ]);
  });

  it("keeps special characters as text for the renderer to escape", () => {
    expect(buildPageMeta('Logic & "Proofs"', "Compare x < y.")).toContainEqual({
      name: "description",
      content: "Compare x < y.",
    });
    expect(buildPageMeta('Logic & "Proofs"', "Compare x < y.")).toContainEqual({
      title: 'Logic & "Proofs" | Bluelearn',
    });
  });
});

describe("page metadata", () => {
  beforeEach(() => vi.stubEnv("SSR", false));
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["Learning Objectives", ObjectivesRoute],
    ["Subjects", SubjectsRoute],
    ["Browse", BrowseRoute],
    ["Log In", LoginRoute],
    ["Register", RegisterRoute],
    ["Guides Waiting to Be Written", TodosRoute],
    ["Contribute", ContributeRoute],
  ] as const)("sets metadata for %s", async (title, route) => {
    const result = await getHead(route);
    expect(result.meta).toContainEqual({ title: `${title} | Bluelearn` });
    expect(result.meta).toContainEqual({
      property: "og:title",
      content: `${title} | Bluelearn`,
    });
    const description = result.meta?.find(
      (tag) => tag && "name" in tag && tag.name === "description"
    );
    expect(description).toMatchObject({ content: expect.any(String) });
    expect(
      description && "content" in description && description.content
    ).toBeTruthy();
    expect(result.meta).toContainEqual({
      property: "og:description",
      content: description && "content" in description && description.content,
    });
  });

  function objectiveMeta(title: string | null, summary: string | null) {
    return getHead(ObjectiveRoute, { objective: { title, summary } });
  }

  it("uses the loaded objective's title and summary", async () => {
    expect(
      (await objectiveMeta("Learn Rust", "Start with the basics.")).meta
    ).toEqual(buildPageMeta("Learn Rust", "Start with the basics."));
  });

  it.each([null, "", "   "])(
    "provides a description when the objective summary is %j",
    async (summary) => {
      expect((await objectiveMeta("Learn Rust", summary)).meta).toContainEqual({
        name: "description",
        content:
          "Follow the Learn Rust learning objective on Bluelearn with step-by-step guides and prerequisites.",
      });
    }
  );

  it("handles an untitled objective", async () => {
    expect((await objectiveMeta(null, null)).meta).toContainEqual({
      title: "Untitled objective | Bluelearn",
    });
  });

  it("uses the loaded subject's name", async () => {
    const result = await getHead(SubjectRoute, {
      subject: { name: "Computer Science" },
    });
    expect(result.meta).toEqual(
      buildPageMeta(
        "Computer Science",
        "Explore free guides and learning objectives about Computer Science on Bluelearn."
      )
    );
  });

  it.each([ObjectiveRoute, SubjectRoute])(
    "doesn't invent metadata when a detail page hasn't loaded",
    async (route) => {
      expect(await getHead(route)).toEqual({ meta: [] });
    }
  );

  it("keeps contributions behind the existing client-side auth check", () => {
    expect(ContributeRoute.options.ssr).toBe(false);
    expect(ContributeRoute.options.beforeLoad).toBeTypeOf("function");
  });

  it("doesn't leave contribution tags in the HTML before a login redirect", async () => {
    vi.stubEnv("SSR", true);
    expect(await getHead(ContributeRoute)).toEqual({ meta: [] });
  });
});
