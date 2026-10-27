// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentType } from "react";
import { Route } from "@/routes/settings.notifications";

const { getNotificationPreferences, setNotificationPreference } = vi.hoisted(
  () => ({
    getNotificationPreferences: vi.fn(),
    setNotificationPreference: vi.fn(),
  })
);

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));

vi.mock("@/lib/api/notifications", () => ({
  getNotificationPreferences,
  setNotificationPreference,
}));

const SettingsPage = Route.options.component as ComponentType;

const preferences = [
  { type: "guide_review_decision", category: "guide_statuses", enabled: true },
  { type: "variant_created", category: "guide_statuses", enabled: true },
  {
    type: "variant_review_decision",
    category: "variant_statuses",
    enabled: false,
  },
  { type: "variant_edited", category: "variant_statuses", enabled: false },
  { type: "guide_upvotes", category: "community_engagement", enabled: true },
  {
    type: "guide_downvotes",
    category: "community_engagement",
    enabled: false,
  },
  { type: "review_assignment", category: "review_workflows", enabled: false },
  { type: "review_deadline", category: "review_workflows", enabled: true },
];

const toggle = (label: string | RegExp) =>
  screen.getByRole("switch", { name: label });

describe("notification settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getNotificationPreferences.mockResolvedValue(preferences);
    setNotificationPreference.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it("enables only the types that are sent", async () => {
    render(<SettingsPage />);
    await waitFor(() =>
      expect(toggle("Upvotes").hasAttribute("disabled")).toBe(false)
    );

    expect(toggle("Guide review decision").hasAttribute("disabled")).toBe(
      false
    );
    for (const label of [
      "Variant created",
      "Variant review decision",
      "Variant edited",
      "Downvotes",
      "Assignments",
      "Deadlines approaching",
    ]) {
      expect(toggle(new RegExp(label)).hasAttribute("disabled")).toBe(true);
    }
    expect(screen.getAllByText("Coming soon")).toHaveLength(6);
  });

  it("shows each saved choice", async () => {
    render(<SettingsPage />);
    await waitFor(() =>
      expect(toggle("Upvotes").getAttribute("aria-checked")).toBe("true")
    );

    expect(toggle(/Downvotes/).getAttribute("aria-checked")).toBe("false");
    expect(toggle(/Deadlines approaching/).getAttribute("aria-checked")).toBe(
      "true"
    );
  });

  it("keeps a saved change", async () => {
    render(<SettingsPage />);
    await waitFor(() =>
      expect(toggle("Upvotes").hasAttribute("disabled")).toBe(false)
    );

    fireEvent.click(toggle("Upvotes"));

    await waitFor(() =>
      expect(toggle("Upvotes").hasAttribute("disabled")).toBe(false)
    );
    expect(toggle("Upvotes").getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reverts a change the server refuses", async () => {
    setNotificationPreference.mockRejectedValue(new Error("500"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<SettingsPage />);
    await waitFor(() =>
      expect(toggle("Upvotes").hasAttribute("disabled")).toBe(false)
    );

    fireEvent.click(toggle("Upvotes"));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Could not save"
    );
    expect(toggle("Upvotes").getAttribute("aria-checked")).toBe("true");
  });
});
