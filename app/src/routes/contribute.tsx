import { createFileRoute } from "@tanstack/react-router";

import { useState } from "react";
import type { ContributionType } from "@/types/contributions";
import ContributionFlow from "@/components/contribute/ContributionFlow";

export const Route = createFileRoute("/contribute")({
  component: RouteComponent,
});

function RouteComponent() {
  const [type, setType] = useState<ContributionType | null>(null);

  return (
    <div className="mx-auto flex min-h-[max(calc(100vh-65px),750px)] w-full max-w-[1280px] flex-col border-x bg-background">
      <section className="flex min-h-0 flex-1 flex-col border-b px-8 py-8 lg:px-16">
        <ContributionFlow type={type} setType={setType} />
      </section>
    </div>
  );
}
