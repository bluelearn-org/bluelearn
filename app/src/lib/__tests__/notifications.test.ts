import { describe, expect, it } from "vitest";
import type { Notification } from "@bluelearn/schemas";
import {
  isNotificationTypeLive,
  notificationSections,
  renderNotification,
} from "@/lib/notifications";

const base: Omit<Notification, "type" | "category" | "data"> = {
  id: "00000000-0000-4000-8000-000000000001",
  actor: null,
  count: 1,
  occurred_at: "2026-07-27T10:00:00Z",
  read_at: null,
};

const decision = (data: Record<string, unknown>): Notification => ({
  ...base,
  type: "guide_review_decision",
  category: "guide_statuses",
  data,
});

const upvotes = (count: number, data: Record<string, unknown>) =>
  ({
    ...base,
    type: "guide_upvotes",
    category: "community_engagement",
    actor: { id: "00000000-0000-4000-8000-000000000002", username: "mira" },
    count,
    data,
  }) satisfies Notification;

describe("guide_review_decision", () => {
  it("links an approval to its review case", () => {
    const view = renderNotification(
      decision({ outcome: "approved", title: "How to speed", case_id: "c1" })
    );

    expect(view).toMatchObject({
      title: "Guide approved",
      body: 'Your guide "How to speed" has been approved',
      target: { to: "/review/$caseId", params: { caseId: "c1" } },
    });
  });

  it("says a rejection is a rejection", () => {
    const view = renderNotification(
      decision({ outcome: "rejected", title: "Topology", case_id: "c1" })
    );

    expect(view?.title).toBe("Guide rejected");
    expect(view?.body).toBe('Your guide "Topology" was not approved');
  });

  it("has no link when the case id is missing", () => {
    const view = renderNotification(decision({ outcome: "approved" }));

    expect(view?.target).toBeNull();
    expect(view?.body).toBe('Your guide "Untitled" has been approved');
  });
});

describe("guide_upvotes", () => {
  const data = { title: "Sorting", base_slug: "sorting", variant_slug: "main" };

  it("names the one voter", () => {
    const view = renderNotification(upvotes(1, data));

    expect(view).toMatchObject({
      title: "New upvote",
      body: '@mira upvoted "Sorting"',
      target: {
        to: "/guides/$slug/$variantSlug",
        params: { slug: "sorting", variantSlug: "main" },
      },
    });
  });

  it("counts the other voters, singular and plural", () => {
    expect(renderNotification(upvotes(2, data))?.body).toBe(
      '@mira and 1 other upvoted "Sorting"'
    );
    expect(renderNotification(upvotes(5, data))).toMatchObject({
      title: "5 new upvotes",
      body: '@mira and 4 others upvoted "Sorting"',
    });
  });

  it("has no link without both slugs", () => {
    const view = renderNotification(upvotes(1, { title: "Sorting" }));

    expect(view?.target).toBeNull();
  });
});

describe("registry", () => {
  it("renders nothing for a type that is not sent yet", () => {
    const view = renderNotification({
      ...base,
      type: "guide_downvotes",
      category: "community_engagement",
      data: {},
    });

    expect(view).toBeNull();
    expect(isNotificationTypeLive("guide_downvotes")).toBe(false);
    expect(isNotificationTypeLive("guide_upvotes")).toBe(true);
  });

  it("lists every type in exactly one settings section", () => {
    const types = notificationSections.flatMap((s) =>
      s.types.map((t) => t.type)
    );

    expect(new Set(types).size).toBe(types.length);
    expect(types).toHaveLength(8);
  });
});
