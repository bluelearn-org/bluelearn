import { createFileRoute } from "@tanstack/react-router";
import { RegisterForm } from "@/components/forms/RegisterForm";
import { useRedirectIfAuthed } from "@/lib/authContext";

export const Route = createFileRoute("/register")({
  component: RouteComponent,
});

function RouteComponent() {
  useRedirectIfAuthed();

  return (
    <div className="flex min-h-[calc(100svh_-_70px)] flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="flex max-w-[1280px] flex-col gap-6">
        <RegisterForm />
      </div>
    </div>
  );
}
