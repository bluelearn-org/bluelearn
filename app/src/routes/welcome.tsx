import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DateOfBirthForm } from "@/components/forms/DateOfBirthForm";
import { getMyDateOfBirth } from "@/lib/api/identity";
import { requireSession } from "@/lib/auth";

export const Route = createFileRoute("/welcome")({
  ssr: false,
  beforeLoad: requireSession,
  loader: () => getMyDateOfBirth(),
  component: Welcome,
});

function Welcome() {
  const { date_of_birth } = Route.useLoaderData();
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome to Bluelearn
        </h1>
        <p className="text-sm text-muted-foreground">
          You can add your date of birth now or later in account settings.
        </p>
      </header>
      <DateOfBirthForm
        initialValue={date_of_birth}
        onComplete={() => navigate({ to: "/" })}
      />
    </div>
  );
}
