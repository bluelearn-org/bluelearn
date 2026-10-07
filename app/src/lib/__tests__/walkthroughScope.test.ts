import { describe, expect, it } from "vitest";
import type { Walkthrough } from "@bluelearn/schemas";
import {
  ALL_PREREQUISITES,
  floorCount,
  parseSubjectSearch,
  scopeOptions,
} from "@/lib/walkthroughScope";

const node = (
  slug: string,
  overrides: Partial<Walkthrough["nodes"][number]> = {}
): Walkthrough["nodes"][number] => ({
  id: crypto.randomUUID(),
  slug,
  title: slug,
  summary: null,
  level: 1,
  duration_minutes: 0,
  tags: [],
  ...overrides,
});

describe("parseSubjectSearch", () => {
  it("keeps a trimmed subject slug and drops everything else", () => {
    expect(parseSubjectSearch({ subject: " physics ", page: "2" })).toEqual({
      subject: "physics",
    });
  });

  it.each([{ subject: "" }, { subject: "   " }, { subject: ["a"] }, {}])(
    "ignores %j",
    (raw) => {
      expect(parseSubjectSearch(raw)).toEqual({});
    }
  );
});

describe("scopeOptions", () => {
  it("offers every prerequisite first, then the target's subjects by name", () => {
    const nodes = [
      node("mechanics", {
        tags: [
          { slug: "physics", name: "Physics" },
          { slug: "engineering", name: "Engineering" },
        ],
      }),
      node("algebra", { tags: [{ slug: "math", name: "Math" }] }),
    ];

    expect(scopeOptions(nodes, "mechanics")).toEqual([
      ALL_PREREQUISITES,
      { slug: "engineering", name: "Engineering" },
      { slug: "physics", name: "Physics" },
    ]);
  });

  it("offers only the unscoped view when the target is missing or untagged", () => {
    expect(scopeOptions([node("algebra")], "mechanics")).toEqual([
      ALL_PREREQUISITES,
    ]);
    expect(scopeOptions([node("mechanics")], "mechanics")).toEqual([
      ALL_PREREQUISITES,
    ]);
  });
});

describe("floorCount", () => {
  it("counts the guides flagged as floor", () => {
    expect(
      floorCount([
        node("algebra", { is_floor: true }),
        node("arithmetic", { is_floor: true }),
        node("mechanics", { is_floor: false }),
        node("untouched"),
      ])
    ).toBe(2);
  });
});
