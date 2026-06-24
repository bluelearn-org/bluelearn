export type ContributionType =
  | "subject"
  | "guide"
  | "variant"
  | "path";

export type ContributionDraft = {
    type?: ContributionType;

    // Subject
    subjectName?: string;
    subjectSummary?: string;
    subjectTags?: Array<string>;

    // Guide
    title?: string;
    summary?: string;
    tags?: Array<string>;
    prerequisites?: Array<string>;
    content?: string;

    // Variant
    baseGuide?: string;

    // Path
    levels?: Array<{
        level: number;
        guide: string;
    }>;
};