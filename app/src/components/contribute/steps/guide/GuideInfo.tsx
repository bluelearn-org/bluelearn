import type {
  ContributionType,
  GuideContribution,
} from "@/types/contributions";

import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import { Content } from "@/components/contribute/steps/Content";
import { CustomTabs } from "@/components/Tabs";
import { GuideDetails } from "@/components/contribute/steps/guide/GuideDetails";
import { EditorSidebar } from "@/components/sidebar/EditorSidebar";

type SubjectOption = {
  id: string;
  name: string;
};

type GuideOption = {
  slug: string | null;
  title: string | null;
  summary: string | null;
};

/**
 * a guide currently being edited inside the local multi-guide contribution session
 * each guide has its own localDraftId - EACH guide is an independent draft in the db
 */
export type GuideWithId = GuideContribution & {
  localDraftId: string;
  revisionId: string | null;
};

type PropTypes = {
  Stepper: any;
  type: ContributionType | null;

  // Currently active guide.
  guideContData: GuideWithId;

  // Update only the currently active guide.
  onGuideChange: (update: Partial<GuideWithId>) => void;
  guides: Array<GuideWithId>;

  subjects: Array<SubjectOption>;
  guideOptions: Array<GuideOption>;

  activeGuideId: string;

  onSelectGuide: (id: string) => void;
  onAddGuide: () => void;
  onDeleteGuide: (id: string) => void;

  body: string;
  onBodyChange: (body: string) => void;

  onUploadImage?: (file: File) => Promise<string>;

  onSaveDraft: () => void;
  submitting?: boolean;
  hideBackBtn?: boolean;

  title?: string;
};

export const GuideInfo = ({
  Stepper,
  type,
  guideContData,
  onGuideChange,
  guides,
  subjects,
  guideOptions,
  activeGuideId,
  onSelectGuide,
  onAddGuide,
  onDeleteGuide,
  body,
  onBodyChange,
  onUploadImage,
  onSaveDraft,
  submitting,
  hideBackBtn,
  title = "Guide Info",
}: PropTypes) => {
  const tabs = [
    {
      id: "details",
      label: "Details",
      content: (
        <GuideDetails
          type={type}
          guideContData={guideContData}
          onGuideChange={onGuideChange}
          subjects={subjects}
          guides={guideOptions}
          hideBackBtn={hideBackBtn}
          onSaveDraft={onSaveDraft}
        />
      ),
    },
    {
      id: "content",
      label: "Content",
      content: (
        <Content
          body={body}
          onBodyChange={onBodyChange}
          onUploadImage={onUploadImage}
        />
      ),
    },
  ];

  return (
    <Stepper.Content step="guide-info">
      <StepperActionHeader
        title={title}
        Stepper={Stepper}
        type={type}
        hideBackBtn={hideBackBtn}
        onSaveDraft={onSaveDraft}
        submitting={submitting}
      />

      <div className="flex min-h-0 flex-1">
        <EditorSidebar
          guides={guides}
          activeGuideId={activeGuideId}
          onSelectGuide={onSelectGuide}
          onAddGuide={onAddGuide}
          onDeleteGuide={onDeleteGuide}
        />

        <div className="min-h-[calc(100vh-65px)] min-w-0 flex-1 pt-4 md:border-l md:pl-5">
          <CustomTabs tabs={tabs} />
        </div>
      </div>
    </Stepper.Content>
  );
};
