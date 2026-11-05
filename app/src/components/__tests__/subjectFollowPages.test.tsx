// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { profileActivitySearchSchema } from "@bluelearn/schemas";
import type { ComponentType, ReactNode } from "react";
import type * as RouterModule from "@tanstack/react-router";
import type { ProfilePageData } from "@/lib/profile";
import { Route as SubjectRoute } from "@/routes/subjects.$slug";
import { Route as ProfileRoute } from "@/routes/profile.$username";

const mocks = vi.hoisted(() => {
  const state: { user: { id: string } | null } = { user: { id: "owner" } };
  return state;
});
vi.mock("@/lib/authContext", () => ({
  useAuth: () => ({ user: mocks.user, loading: true }),
}));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/routes/objectives/$slug/index", () => ({
  Route: { to: "/objectives/$slug" },
}));
vi.mock("@/routes/guides/$slug/index", () => ({
  Route: { to: "/guides/$slug" },
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof RouterModule>()),
  useNavigate: () => vi.fn(),
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children: ReactNode;
    to: string;
    params?: { slug: string };
  }) => (
    <a href={params ? to.replace("$slug", params.slug) : to} {...props}>
      {children}
    </a>
  ),
}));

const SubjectPage = SubjectRoute.options.component as ComponentType;
const ProfilePage = ProfileRoute.options.component as ComponentType;
let profile: ProfilePageData;

beforeEach(() => {
  mocks.user = { id: "owner" };
  profile = {
    profile: {
      id: "owner",
      username: "learner",
      display_name: "Learner",
      bio: null,
      created_at: "2026-10-25T00:00:00Z",
    },
    roles: [],
    stats: { upvotes: 0, downvotes: 0, contributions: 0, reviews: 0 },
    activity: [],
    is_owner: true,
    followed_subjects: [{ slug: "physics", name: "Physics" }],
  };
  vi.spyOn(ProfileRoute, "useLoaderData").mockImplementation(() => profile);
  vi.spyOn(ProfileRoute, "useParams").mockReturnValue({ username: "learner" });
  vi.spyOn(ProfileRoute, "useSearch").mockReturnValue(
    profileActivitySearchSchema.parse({})
  );
  vi.spyOn(SubjectRoute, "useLoaderData").mockReturnValue({
    subject: { id: "physics", slug: "physics", name: "Physics" },
    objectives: [],
    guides: [],
  });
  vi.spyOn(SubjectRoute, "useParams").mockReturnValue({ slug: "physics" });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("subject and profile follow layout", () => {
  it("uses the subject as the sole h1 and simplifies the existing section headings", () => {
    render(<SubjectPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Physics" })
    ).toBeDefined();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 2, name: "Learning Objectives (0)" })
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { level: 2, name: "Guides (0)" })
    ).toBeDefined();
    expect(
      screen.getByText("No objectives tagged with this subject yet.")
    ).toBeDefined();
    expect(
      screen.getByText("No guides tagged with this subject yet.")
    ).toBeDefined();
  });

  it("links the owner's followed subject to its existing guides page", () => {
    render(<ProfilePage />);
    expect(
      screen.getByRole("heading", { name: "Followed Subjects" })
    ).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Physics" }).getAttribute("href")
    ).toBe("/subjects/physics");
    expect(screen.getByRole("heading", { name: "Learner" })).toBeDefined();
  });

  it("shows an empty state for an owner with no follows", () => {
    profile.followed_subjects = [];
    render(<ProfilePage />);
    expect(
      screen.getByText("You aren't following any subjects yet.")
    ).toBeDefined();
  });

  it("does not render the section on a public profile", () => {
    profile.is_owner = false;
    delete profile.followed_subjects;
    render(<ProfilePage />);
    expect(
      screen.queryByRole("heading", { name: "Followed Subjects" })
    ).toBeNull();
  });

  it.each([null, { id: "other" }])(
    "hides a cached private list when the session changes to %s",
    (user) => {
      mocks.user = user;
      render(<ProfilePage />);
      expect(screen.queryByRole("link", { name: "Physics" })).toBeNull();
      expect(
        screen.queryByRole("heading", { name: "Followed Subjects" })
      ).toBeNull();
    }
  );
});
