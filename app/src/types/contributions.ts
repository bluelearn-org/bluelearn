export type ContributionType = "guide" | "variant" | "objective";

export type GuideContribution = {
  type: string;
  title: string;
  summary: string;
  subjects: Array<string>;
  prereqs: Array<string>;
  todoPrereqs: Array<string>;
};
