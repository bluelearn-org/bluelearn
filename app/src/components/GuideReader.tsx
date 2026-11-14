

import { Calendar, Clock, ShieldCheck, User } from "lucide-react";
import type { Guide } from "@bluelearn/schemas";
import type { GuideType } from "@/types/guides";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { GuideToc } from "@/components/GuideToc";
import { BlueMarkdown } from "@/components/blue_markdown/BlueMarkdown";

import { formatDate, formatDuration } from "@/lib/guideUtils";



type ReaderTag = { id?: string; slug?: string; name: string };

export type ReaderGuide = Omit<
  Guide,
  "tags" | "variant_id" | "is_official" | "knowledge_type"
> & {
  tags: Array<ReaderTag>;
};

type PropTypes = {
  guide: ReaderGuide;
  guideType?: GuideType;
  showToc?: boolean;
  isOfficial?: boolean;
};

export const GuideReader = ({
  guide,
  guideType,
  showToc = false,
  isOfficial = false,
}: PropTypes) => {
  const created = new Date(guide.created_at);
  const createdLabel = Number.isNaN(created.getTime())
    ? guide.created_at
    : formatDate(created);
 

  return (
    <>
      <header className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            {showToc && <GuideToc body={guide.body ?? ""} />}
            <h1 className="text-3xl font-bold">{guide.title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isOfficial && (
              <Badge
                variant="outline"
                className="mono-micro h-6 shrink-0 gap-0.5 rounded-full border border-badge-border bg-transparent tracking-[0.08em] text-primary [&>svg]:size-[18px]!"
              >
                <ShieldCheck
                  className="fill-primary text-background"
                  strokeWidth={2.5}
                />
                <span className="translate-y-[0.25px]">Official</span>
              </Badge>
            )}
            {guideType && (
              <Badge
                key={guideType}
                variant="outline"
                className="mono-micro shrink-0 rounded-full border bg-badge tracking-[0.08em] text-badge-foreground"
              >
                {guideType}
              </Badge>
            )}
          </div>
        </div>

        <div className="mono-micro my-2 flex flex-wrap items-center gap-2.5 text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3 text-muted-foreground/75" />@
            {guide.author ?? "deleted_user"}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-muted-foreground/75" />
            {createdLabel}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground/75" />
            {formatDuration(guide.duration_minutes)}
          </span>
        </div>

        {guide.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {guide.tags.map((tag: ReaderTag) => (
              <Badge
                key={tag.id ?? tag.slug ?? tag.name}
                variant="outline"
                className="mono-micro rounded-full border bg-badge tracking-[0.08em] text-badge-foreground"
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}

        {guide.summary && (
          <p className="mt-3 text-sm whitespace-pre-line text-muted-foreground">
            {guide.summary}
          </p>
        )}
      </header>

      <Separator className="mb-8" />

      <article className="markdown">
        <BlueMarkdown body={guide.body ?? ""} />
      </article>
    </>
  );
};
