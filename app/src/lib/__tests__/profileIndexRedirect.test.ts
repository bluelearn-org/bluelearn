// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { getMyIdentity } from "@/lib/api/identity";
import { Route } from "@/routes/profile.index";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("@/lib/api/identity", () => ({ getMyIdentity: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession } } }));

// beforeLoad only reads the abort signal.
const enter = () =>
  (Route.options.beforeLoad as (ctx: unknown) => Promise<unknown>)({
    abortController: new AbortController(),
  });

describe("/profile", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("sends a signed-in user to their own profile", async () => {
    getSession.mockResolvedValue({ data: { session: {} } });
    vi.mocked(getMyIdentity).mockResolvedValue({
      profile: { username: "seeduser" },
    } as never);

    await expect(enter()).rejects.toMatchObject({
      options: { to: "/profile/$username", params: { username: "seeduser" } },
    });
  });

  it("sends a signed-out visitor to sign in without asking who they are", async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    await expect(enter()).rejects.toMatchObject({ options: { to: "/login" } });
    expect(getMyIdentity).not.toHaveBeenCalled();
  });
});
