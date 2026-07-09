import type { SubjectReference } from "@/types/subjects";

export type Guide = {
  slug: string;
  title: string;
  author: string;
  summary: string;
  created_at: string;
  duration: number;
  tags: Array<string>;
  breadcrumbs: Array<string>;
  prerequisites: Array<string>;
  content: string;
  level?: number;
  order?: number;
  status?: string;
};

export type GuideReference = {
  slug: string;
  title: string;
};

export type HydratedGuide = Omit<Guide, "tags" | "prerequisites"> & {
  tags: Array<SubjectReference>;
  prerequisites: Array<GuideReference>;
};
