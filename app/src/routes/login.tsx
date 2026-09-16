import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@/components/forms/LoginForm";
import { useRedirectIfAuthed } from "@/lib/authContext";
import { buildPageMeta } from "@/lib/seo";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: buildPageMeta(
      "Log In",
      "Log in to Bluelearn to continue learning and contribute to free, community-written guides."
    ),
  }),
  component: RouteComponent,
});

function RouteComponent() {
  useRedirectIfAuthed();

  return (
    <div className="flex min-h-[calc(100svh_-_70px)] flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="flex w-full max-w-[1280px] flex-col gap-6">
        <LoginForm />
      </div>
    </div>
  );
}
