import "katex/dist/katex.min.css";

import { useEffect, useState } from "react";

import type {
  ContributionType,
  GuideContribution,
} from "@/types/contributions";
import type { GuideType } from "@/types/guides";
import type { listSubjects } from "@/lib/api/subjects";

import type { ReaderGuide } from "@/components/GuideReader";
import { GuideReader } from "@/components/GuideReader";
import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import { EditorSidebar } from "@/components/sidebar/EditorSidebar";
import { getMyIdentity } from "@/lib/api/identity";

export type GuideWithId = GuideContribution & {
  type: GuideType;
  localDraftId: string;
  revisionId: string | null;
};

type PropTypes = {
  Stepper: any;
  type: ContributionType | null;

  guides: Array<GuideWithId>;
  subjects: Awaited<ReturnType<typeof listSubjects>>;

  activeGuideId: string;

  onSelectGuide: (localDraftId: string) => void;
  onAddGuide: () => void;
  onDeleteGuide: (localDraftId: string) => void;

  onSaveDraft: () => void;
  onPublish: () => void;
  submitting: boolean;
};

export const PreviewGuide = ({
  Stepper,
  type,
  guides,
  subjects,
  activeGuideId,
  onSelectGuide,
  onAddGuide,
  onDeleteGuide,
  onSaveDraft,
  onPublish,
  submitting,
}: PropTypes) => {
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const opts = { signal: controller.signal };

    getMyIdentity(opts)
      .then((data) => setUsername(data.profile.username))
      .catch(() => {});

    return () => controller.abort();
  }, []);

  const activeGuide = guides.find(
    (guide) => guide.localDraftId === activeGuideId
  );

  const readerGuide: ReaderGuide | null = activeGuide
    ? {
        slug: activeGuide.localDraftId,
        variant_slug: null,

        title: activeGuide.title,
        author: username ?? "You",
        summary: activeGuide.summary || null,
        body: activeGuide.body || null,

        duration_minutes: 0,
        created_at: new Date().toISOString(),

        prerequisites: activeGuide.prereqs.map((slug) => ({
          slug,
          title: slug,
        })),

        tags: activeGuide.subjects.map((id) => {
          const subject = subjects.filter((sub) => sub.id === id);

          return {
            slug: subject[0]?.slug,
            name: subject[0]?.name,
          };
        }),
      }
    : null;

  return (
    <Stepper.Content step="preview-guide">
      <StepperActionHeader
        title="Preview"
        Stepper={Stepper}
        type={type}
        onSaveDraft={onSaveDraft}
        onPublish={onPublish}
        submitting={submitting}
      />

      <div className="flex min-h-0 flex-1">
        <EditorSidebar
          guides={guides}
          activeGuideId={activeGuideId}
          onSelectGuide={onSelectGuide}
          onAddGuide={onAddGuide}
          onDeleteGuide={onDeleteGuide}
          hideActionBtns={true}
        />

        <div className="min-h-[calc(100vh-65px)] min-w-0 flex-1 pt-4 pt-8 md:border-l md:pl-8">
          {readerGuide ? (
            <GuideReader guide={readerGuide} guideType={activeGuide?.type} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground">No guide selected.</p>
            </div>
          )}
        </div>
      </div>
    </Stepper.Content>
  );
};
