import { AlertTriangle } from "lucide-react";
import type { DisclaimerSlug } from "@bluelearn/schemas";
import { DISCLAIMER_TEXTS } from "@/lib/disclaimers";

type PropTypes = {
  disclaimers: Array<DisclaimerSlug>;
};

export function DisclaimerBanner({ disclaimers }: PropTypes) {
  const texts = disclaimers
    .map((slug) => DISCLAIMER_TEXTS[slug])
    .filter(Boolean);

  if (texts.length === 0) return null;

  return (
    <div
      className="mb-8 space-y-2 px-4 py-3 text-sm"
      style={{ backgroundColor: "#C05000", color: "#FAFAFA" }}
    >
      {texts.map((text, i) => (
        <div key={i} className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong className="font-semibold">Disclaimer:</strong> {text}
          </span>
        </div>
      ))}
    </div>
  );
}
