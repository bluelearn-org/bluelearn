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
    <div className="mx-auto max-w-[1280px] border-x bg-background">
      <section className="border-b px-8 py-8 lg:px-16">
        <ContributionFlow type={type} setType={setType} />
      </section>
    </div>
  );
}
