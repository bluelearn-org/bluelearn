import { createFileRoute, redirect } from "@tanstack/react-router";

import { getMyIdentity } from "@/lib/api/identity";
import { requireSession } from "@/lib/auth";

export const Route = createFileRoute("/profile/")({
  ssr: false,
  beforeLoad: async ({ abortController }) => {
    await requireSession();

    const { profile } = await getMyIdentity({
      signal: abortController.signal,
    });
    throw redirect({
      to: "/profile/$username",
      params: { username: profile.username },
    });
  },
});
