import type { Guide } from "@/types/guides";

export type ObjectiveLevel = {
  level: number;
  guide: string;
};

export type Objective = {
  slug: string;
  title: string;
  summary: string;
  status?: string;
  curator: string;
  created_at: string;
  duration: number;

  levels: Array<ObjectiveLevel>;
};

export type Level = {
  level: number;
  guide: Guide;
};

export type HydratedObjective = Omit<Objective, "levels"> & {
  levels: Array<Level>;
};
