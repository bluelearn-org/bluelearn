import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowBigDown, ArrowBigUp, Check, Sparkles } from "lucide-react";
import { BaseGuideModal } from "./BaseGuideModal";
import type { GuideVariantListItem } from "@bluelearn/schemas";
import { Badge } from "@/components/ui/badge";
import { getGuideVariants } from "@/lib/api/guides";
import { formatDate } from "@/lib/guideUtils";
import { useSuspensionStatus } from "@/lib/authContext";

type PropsTypes = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  currentVariantSlug?: string | null;
};
export const VariantsModal = ({
  open,
  onOpenChange,
  slug,
  currentVariantSlug,
}: PropsTypes) => {
  const canAuthor = useSuspensionStatus() === "active";
  const [variants, setVariants] = useState<Array<GuideVariantListItem>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let ignore = false;
    setLoading(true);
    setError(null);

    getGuideVariants(slug)
      .then((res) => {
        if (!ignore) {
          setVariants(res.variants);
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error("Failed to load variants", err);
          setError("Failed to load variants. Please try again.");
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [open, slug]);

  return (
    <BaseGuideModal
      open={open}
      onOpenChange={onOpenChange}
      title="Guide Variants"
      description="Alternative approaches, methods, and explanations for this guide."
      loading={loading}
      loadingText="Loading variants..."
      error={error}
      isEmpty={variants.length === 0}
      emptyIcon={<Sparkles className="h-6 w-6" />}
      emptyTitle="No other variants available"
      emptyDescription="This guide currently only has its canonical version."
      emptyAction={
        canAuthor && (
          <Link
            to="/contribute"
            className="btn-outline text-xs"
            onClick={() => onOpenChange(false)}
          >
            Create a variant
          </Link>
        )
      }
    >
      {variants.map((variant) => {
        const isCurrent =
          Boolean(currentVariantSlug) && variant.slug === currentVariantSlug;

        return (
          <Link
            key={variant.id || variant.slug}
            to="/guides/$slug/$variantSlug"
            params={{ slug, variantSlug: variant.slug }}
            onClick={() => onOpenChange(false)}
            className={`group relative flex w-full flex-col gap-1.5 rounded-lg border p-3.5 transition-colors hover:bg-muted ${
              isCurrent
                ? "border-primary/50 bg-primary/5"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-foreground">
                {variant.title}
              </h4>
              {variant.is_canonical && (
                <Badge
                  variant="outline"
                  className="mono-micro gap-1 rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                >
                  <Check className="h-3 w-3 text-primary" />
                  Canonical
                </Badge>
              )}
            </div>
            {variant.summary && (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {variant.summary}
              </p>
            )}

            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              {variant.author && <span>by @{variant.author}</span>}
              {variant.author && variant.updated_at && <span>·</span>}
              {variant.updated_at && (
                <span>Updated {formatDate(new Date(variant.updated_at))}</span>
              )}
              <span className="ml-auto flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <ArrowBigUp className="h-3.5 w-3.5" />
                  {variant.votes.up}
                </span>
                <span className="flex items-center gap-1">
                  <ArrowBigDown className="h-3.5 w-3.5" />
                  {variant.votes.down}
                </span>
              </span>
            </div>
          </Link>
        );
      })}
    </BaseGuideModal>
  );
};
