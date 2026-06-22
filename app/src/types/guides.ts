import type { Subject } from "@/types/subjects";

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
};

export type HydratedGuide = Omit<Guide, "tags"> & {
  tags: Array<Subject>;
};