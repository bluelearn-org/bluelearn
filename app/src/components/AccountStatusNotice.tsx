import { Link } from "@tanstack/react-router";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/authContext";

type PropTypes = {
  status: "suspended" | "unavailable";
};

export function AccountStatusNotice({ status }: PropTypes) {
  const { refreshIdentity } = useAuth();
  const suspended = status === "suspended";

  return (
    <main className="container mx-auto p-4 pt-16">
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <img
              src="/assets/adam/adam-cube-error.png"
              alt="Adam mascot showing an error"
              className="h-40 w-40 grayscale sm:h-56 sm:w-56"
            />
          </EmptyMedia>
          <EmptyTitle className="data-label">
            {suspended ? "Account suspended" : "Account status unavailable"}
          </EmptyTitle>
          <EmptyDescription className="data-value">
            {suspended
              ? "Suspended accounts cannot create or edit guides. Your existing drafts are kept. For more info contact info@bluelearn.org."
              : "We could not verify your account status. Try again before you edit content."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {suspended ? (
            <Link to="/" className="btn-outline text-xs">
              Back to home
            </Link>
          ) : (
            <Button variant="outline" onClick={refreshIdentity}>
              Try again
            </Button>
          )}
        </EmptyContent>
      </Empty>
    </main>
  );
}
