import type {
  ContributionType,
  VariantContribution,
} from "@/types/contributions";

import type { listGuides } from "@/lib/api/guides";
import type { listSubjects } from "@/lib/api/subjects";

import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import { CustomTabs } from "@/components/Tabs";
import { VariantDetails } from "@/components/contribute/steps/variant/VariantDetails";
import { Content } from "@/components/contribute/steps/Content";

type PropTypes = {
  Stepper: any;
  type: ContributionType | null;

  variantContData: VariantContribution;
  onVariantChange: (update: Partial<VariantContribution>) => void;

  subjects: Awaited<ReturnType<typeof listSubjects>>;
  guides: Awaited<ReturnType<typeof listGuides>>;

  body: string;
  onBodyChange: (body: string) => void;

  onUploadImage?: (file: File) => Promise<string>;

  onSaveDraft: () => void;
  submitting?: boolean;
  hideBackBtn?: boolean;

  title?: string;
};

export const VariantInfo = ({
  Stepper,
  type,
  variantContData,
  onVariantChange,
  subjects,
  guides,
  body,
  onBodyChange,
  onUploadImage,
  onSaveDraft,
  submitting,
  hideBackBtn,
  title = "Variant Info",
}: PropTypes) => {
  const tabs = [
    {
      id: "details",
      label: "Details",
      content: (
        <VariantDetails
          variantContData={variantContData}
          onVariantChange={onVariantChange}
          subjects={subjects}
          guides={guides}
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
    <Stepper.Content step="variant-info">
      <StepperActionHeader
        title={title}
        Stepper={Stepper}
        type={type}
        hideBackBtn={hideBackBtn}
        onSaveDraft={onSaveDraft}
        submitting={submitting}
      />

      <div className="min-h-[calc(100vh-65px)] min-w-0 flex-1 pt-4 md:pl-5">
        <CustomTabs tabs={tabs} />
      </div>
    </Stepper.Content>
  );
};
