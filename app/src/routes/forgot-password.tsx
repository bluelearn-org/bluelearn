import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordForm } from "@/components/forms/ForgotPasswordForm";
import { useRedirectIfAuthed } from "@/lib/authContext";

export const Route = createFileRoute("/forgot-password")({
  component: RouteComponent,
});

function RouteComponent() {
  useRedirectIfAuthed();

  return (
    <div className="flex min-h-[calc(100svh_-_70px)] flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="flex w-full max-w-[1280px] flex-col gap-6">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
