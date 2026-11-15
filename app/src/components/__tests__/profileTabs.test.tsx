// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ProfileTabs } from "@/components/ProfileTabs";

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));

vi.mock("@/lib/authContext", () => ({ useAuth }));

// Keep link destinations visible without mounting the application router.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode;
    to: string;
    params?: { username: string };
  }) => (
    <a href={params ? to.replace("$username", params.username) : to}>
      {children}
    </a>
  ),
  useMatchRoute: () => () => false,
}));

describe("ProfileTabs", () => {
  afterEach(() => {
    cleanup();
  });

  it("links the owner's profile and notifications", () => {
    useAuth.mockReturnValue({ currentProfile: { username: "seeduser" } });

    render(<ProfileTabs username="seeduser" />);

    expect(
      screen.getByRole("link", { name: "Profile" }).getAttribute("href")
    ).toBe("/profile/seeduser");
    expect(
      screen.getByRole("link", { name: "Notifications" }).getAttribute("href")
    ).toBe("/notifications");
  });

  it.each([
    { viewer: "another user", currentProfile: { username: "mira" } },
    { viewer: "a signed-out visitor", currentProfile: null },
  ])("shows no tabs to $viewer", ({ currentProfile }) => {
    useAuth.mockReturnValue({ currentProfile });

    render(<ProfileTabs username="seeduser" />);

    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
