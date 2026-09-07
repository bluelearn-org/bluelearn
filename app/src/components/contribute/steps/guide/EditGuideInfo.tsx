import type {
  ContributionType,
  GuideContribution,
} from "@/types/contributions";

import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import { Content } from "@/components/contribute/steps/Content";
import { CustomTabs } from "@/components/Tabs";
import { GuideDetails } from "@/components/contribute/steps/guide/GuideDetails";

type SubjectOption = {
  id: string;
  name: string;
};

type GuideOption = {
  slug: string | null;
  title: string | null;
  summary: string | null;
};

type PropTypes = {
  Stepper: any;
  type: ContributionType | null;

  guideContData: GuideContribution;
  onGuideChange: (update: Partial<GuideContribution>) => void;

  subjects: Array<SubjectOption>;
  guides: Array<GuideOption>;

  body: string;
  onBodyChange: (body: string) => void;

  onUploadImage?: (file: File) => Promise<string>;

  onSaveDraft: () => void;
  submitting?: boolean;

  hideBackBtn?: boolean;

  changeSummary: string;
  onChangeSummaryChange: (value: string) => void;

  title?: string;
};

export const EditGuideInfo = ({
  Stepper,
  type,
  guideContData,
  onGuideChange,
  subjects,
  guides,
  body,
  onBodyChange,
  onUploadImage,
  onSaveDraft,
  submitting,
  hideBackBtn,
  changeSummary,
  onChangeSummaryChange,
  title = "Edit Guide",
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
          guides={guides}
          hideBackBtn={hideBackBtn}
          onSaveDraft={onSaveDraft}
          showBaseFields={false}
          changeSummary={changeSummary}
          onChangeSummaryChange={onChangeSummaryChange}
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

      <div className="min-w-0 flex-1">
        <CustomTabs tabs={tabs} />
      </div>
    </Stepper.Content>
  );
};
