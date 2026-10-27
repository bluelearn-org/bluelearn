import { Hourglass } from "lucide-react";

import { useOptionalReviewAnnotations } from "@/components/review/ReviewAnnotations";

type PropTypes = {
  viewerRole: "author" | "panelist" | "public";
};

// Votes still count while edits wait, but the guide does not publish until
// the author accepts or rejects every suggested edit.
export const PublicationGateNotice = ({ viewerRole }: PropTypes) => {
  const publication = useOptionalReviewAnnotations()?.publication;

  if (!publication?.awaiting_author) return null;

  const count = publication.pending_suggestions;
  const edits =
    count === 1 ? "1 suggested edit waits" : `${count} suggested edits wait`;

  return (
    <div
      role="status"
      className="flex gap-2 rounded-md border border-brand-bright-blue/40 bg-brand-bright-blue/10 p-3 text-xs"
    >
      <Hourglass aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p className="leading-relaxed">
        {viewerRole === "author"
          ? `${edits} for your decision. Accept or reject each edit in the guide. The guide does not publish until you decide.`
          : `${edits} for the author. Votes still count, but the guide does not publish until the author decides.`}
      </p>
    </div>
  );
};
