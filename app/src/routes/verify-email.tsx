import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { EmailVerification } from "@/components/forms/EmailVerification";
import { useRedirectIfAuthed } from "@/lib/authContext";

const searchSchema = z.object({
  email: z.string().email().optional().catch(undefined),
  sent: z.boolean().optional().catch(undefined),
});

export const Route = createFileRoute("/verify-email")({
  validateSearch: searchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  useRedirectIfAuthed("/welcome");
  const { email, sent } = Route.useSearch();

  return (
    <div className="flex min-h-[calc(100svh_-_70px)] flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="flex w-full max-w-[1280px] flex-col gap-6">
        <EmailVerification email={email} justSent={sent} />
      </div>
    </div>
  );
}
