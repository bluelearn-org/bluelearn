import "katex/dist/katex.min.css";

import { useEffect, useState } from "react";

import type {
  ContributionType,
  VariantContribution,
} from "@/types/contributions";
import type { listSubjects } from "@/lib/api/subjects";
import type { ReaderGuide } from "@/components/GuideReader";

import { getMyIdentity } from "@/lib/api/identity";

import { GuideReader } from "@/components/GuideReader";
import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";

type PropTypes = {
  Stepper: any;
  type: ContributionType | null;

  guide: VariantContribution;
  subjects: Awaited<ReturnType<typeof listSubjects>>;

  onSaveDraft: () => void;
  onPublish: () => void;
  submitting: boolean;
};

export const PreviewVariant = ({
  Stepper,
  type,
  guide,
  subjects,
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

  const readerGuide: ReaderGuide = {
    slug: "preview",

    variant_slug: guide.baseGuide || null,

    title: guide.title,
    author: username ?? "You",
    summary: guide.summary || null,
    body: guide.body || null,

    duration_minutes: 0,
    created_at: new Date().toISOString(),

    // variants don't have prerequisites
    prerequisites: [],

    tags: guide.subjects.map((id: string) => {
      const subject = subjects.filter((sub) => sub.id === id);

      return {
        slug: subject[0]?.slug,
        name: subject[0]?.name,
      };
    }),
  };

  return (
    <Stepper.Content step="preview-variant">
      <StepperActionHeader
        title="Preview"
        Stepper={Stepper}
        type={type}
        onSaveDraft={onSaveDraft}
        onPublish={onPublish}
        submitting={submitting}
      />

      <div className="flex min-h-0 flex-1">
        <div className="min-h-[calc(100vh-65px)] min-w-0 flex-1 pt-8 md:pl-8">
          <GuideReader guide={readerGuide} guideType={guide.type} />
        </div>
      </div>
    </Stepper.Content>
  );
};
