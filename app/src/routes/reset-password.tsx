import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordForm } from "@/components/forms/ResetPasswordForm";

export const Route = createFileRoute("/reset-password")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex min-h-[calc(100svh_-_70px)] flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="flex w-full max-w-[1280px] flex-col gap-6">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
