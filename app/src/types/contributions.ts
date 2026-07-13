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
