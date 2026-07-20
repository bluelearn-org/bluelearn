export type ContributionType = "guide" | "variant" | "objective";

export type GuideContribution = {
  type: string;
  title: string;
  summary: string;
  subjects: Array<string>;
  newSubjects: Array<{
    name: string;
    summary: string;
  }>;
  prereqs: Array<string>;
  todoPrereqs: Array<string>;
};

export type VariantContribution = {
  type: string;
  title: string;
  summary: string;
  baseGuide: string;
  subjects: Array<string>;
};

export type SubObjective = {
  targetSlug: string;
  selectedSlugs: Array<string>;
  curatedSequence: Array<string>;
};

export type ObjectiveContribution = {
  title: string;
  summary: string;
  targets: Array<string>;
  featured: string;
  subObjectives: Array<SubObjective>;
};
