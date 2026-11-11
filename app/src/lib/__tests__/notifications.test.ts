import { describe, expect, it, vi } from "vitest";
import type { Notification, NotificationType } from "@bluelearn/schemas";
import { notificationSections, renderNotification } from "@/lib/notifications";

// The reason labels come from the vote API module, whose client needs env
// vars on import.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

function notification(
  type: NotificationType,
  data: Record<string, unknown> = {},
  overrides: Partial<Notification> = {}
): Notification {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    type,
    category:
      notificationSections.find((section) =>
        section.types.some((entry) => entry.type === type)
      )?.category ?? "guide_statuses",
    actor: null,
    count: 1,
    occurred_at: "2026-07-27T10:00:00Z",
    read_at: null,
    data,
    ...overrides,
  };
}

const actor = {
  id: "00000000-0000-4000-8000-000000000002",
  username: "mira",
};
const guideData = {
  guide_id: "g1",
  title: "Sorting",
  base_slug: "sorting",
  variant_slug: "alternative",
};
const guideTarget = {
  to: "/guides/$slug/$variantSlug",
  params: { slug: "sorting", variantSlug: "alternative" },
};
const reviewTarget = {
  to: "/review/$caseId",
  params: { caseId: "c1" },
};

describe.each([
  ["guide_review_decision", /\bguide\b/i],
  ["variant_review_decision", /\bvariant\b/i],
] as const)("%s", (type, kind) => {
  it.each(["approved", "rejected"])(
    "shows the %s outcome and links to the review case",
    (outcome) => {
      const view = renderNotification(
        notification(type, { ...guideData, outcome, case_id: "c1" })
      );

      expect(view?.title).toMatch(kind);
      expect(view?.title).toMatch(new RegExp(`\\b${outcome}\\b`, "i"));
      expect(view?.body).toMatch(kind);
      expect(view?.body).toMatch(/sorting/i);
      expect(view?.target).toEqual(reviewTarget);

      const rejection = /not\s+approved|rejected|declined/i;

      if (outcome === "rejected") {
        expect(view?.body).toMatch(rejection);
      } else {
        expect(view?.body).not.toMatch(rejection);
      }
    }
  );
});

describe("guide_upvotes", () => {
  it.each([
    { count: 1, otherVoters: null },
    { count: 2, otherVoters: /\b1\s+other\b/i },
    { count: 5, otherVoters: /\b4\s+others\b/i },
  ])(
    "names the latest voter and counts the others for $count events",
    ({ count, otherVoters }) => {
      const view = renderNotification(
        notification("guide_upvotes", guideData, { actor, count })
      );

      expect(view?.title).toMatch(/upvot/i);
      expect(view?.body).toMatch(/upvot/i);
      expect(view?.body).not.toMatch(/downvot/i);
      expect(view?.body).toMatch(/@mira\b/i);
      expect(view?.body).toMatch(/sorting/i);
      expect(view?.target).toEqual(guideTarget);

      if (otherVoters) {
        expect(view?.title).toMatch(new RegExp(`\\b${count}\\b`));
        expect(view?.body).toMatch(otherVoters);
      } else {
        expect(view?.body).not.toMatch(/\bothers?\b/i);
      }
    }
  );
});

describe("guide_downvotes", () => {
  it("shows the reason and note without naming the voter", () => {
    const view = renderNotification(
      notification(
        "guide_downvotes",
        { ...guideData, reason: "missing_step", note: "Step 3 skips setup." },
        { actor }
      )
    );

    expect(view?.title).toMatch(/downvot/i);
    expect(view?.body).toMatch(/sorting/i);
    expect(view?.body).toContain("Missing Step");
    expect(view?.body).toContain("Step 3 skips setup.");
    expect(view?.body).not.toMatch(/missing_step|@|mira|someone/i);
    expect(view?.target).toEqual(guideTarget);
  });

  it("leaves out an unknown reason and a missing note", () => {
    const view = renderNotification(
      notification("guide_downvotes", {
        ...guideData,
        reason: "not_a_reason",
        note: null,
      })
    );

    expect(view?.body).toMatch(/downvot/i);
    expect(view?.body).toMatch(/sorting/i);
    expect(view?.body).not.toMatch(/not_a_reason|downvoted:|null|""/i);
    expect(view?.target).toEqual(guideTarget);
  });
});

describe.each([
  ["guide_upvotes", /upvot/i],
  ["guide_downvotes", /downvot/i],
] as const)("%s with missing details", (type, direction) => {
  it("keeps the vote direction without a voter, title, or target", () => {
    const view = renderNotification(notification(type));

    expect(view?.body).toMatch(direction);
    expect(view?.body).not.toMatch(/undefined|null/i);
    expect(view?.target).toBeNull();
  });
});

describe.each([
  ["variant_created", /publish/i],
  ["variant_edited", /edit/i],
] as const)("%s", (type, action) => {
  it("shows the actor and variant and opens the guide instead of the review", () => {
    const view = renderNotification(
      notification(type, { ...guideData, case_id: "c1" }, { actor })
    );

    expect(view?.body).toMatch(/@mira\b/i);
    expect(view?.body).toMatch(/sorting/i);
    expect(view?.body).toMatch(action);
    expect(view?.target).toEqual(guideTarget);
  });
});

describe("guide target boundaries", () => {
  it.each([
    {},
    { base_slug: "sorting" },
    { variant_slug: "alternative" },
    { base_slug: "sorting", variant_slug: "" },
    { base_slug: " ", variant_slug: "alternative" },
    { base_slug: 42, variant_slug: "alternative" },
    { base_slug: "sorting", variant_slug: null },
  ])("refuses a partial guide target for %j", (data) => {
    const view = renderNotification(
      notification("variant_created", { ...data, case_id: "c1" })
    );

    expect(view?.target).toBeNull();
  });
});

describe.each(["review_assignment", "review_deadline"] as const)(
  "%s",
  (type) => {
    it("opens the review case instead of the guide or seat", () => {
      const view = renderNotification(
        notification(type, {
          ...guideData,
          case_id: "c1",
          seat_id: "seat1",
          expires_at: "2031-11-02T12:00:00Z",
        })
      );

      expect(view?.body).toMatch(/sorting/i);
      expect(view?.target).toEqual(reviewTarget);
    });
  }
);

describe("review target boundaries", () => {
  it.each([undefined, null, "", " ", 42])(
    "refuses a missing or invalid case id %s instead of using the guide or seat",
    (caseId) => {
      const view = renderNotification(
        notification("review_assignment", {
          ...guideData,
          case_id: caseId,
          seat_id: "seat1",
        })
      );

      expect(view?.target).toBeNull();
    }
  );
});

describe("review_deadline expiry", () => {
  it("shows the actual expiry time instead of a fixed reminder window", () => {
    const early = renderNotification(
      notification("review_deadline", {
        expires_at: "2031-11-02T12:00:00Z",
      })
    );
    const late = renderNotification(
      notification("review_deadline", {
        expires_at: "2031-11-02T18:00:00Z",
      })
    );

    expect(early?.body).toMatch(/\b2031\b/);
    expect(late?.body).toMatch(/\b2031\b/);
    expect(early?.body).not.toBe(late?.body);
    expect(early?.body).not.toMatch(/\b48\s+hours?\b/i);
  });

  it.each([null, "", "not a date", 42])(
    "keeps the review target without inventing an expiry for %s",
    (expiresAt) => {
      const view = renderNotification(
        notification("review_deadline", {
          expires_at: expiresAt,
          case_id: "c1",
        })
      );

      expect(view?.body).toMatch(/deadline|review/i);
      expect(view?.body).not.toMatch(
        /Invalid Date|NaN|undefined|null|48\s+hours/i
      );
      expect(view?.target).toEqual(reviewTarget);
    }
  );
});
