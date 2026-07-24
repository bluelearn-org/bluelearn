import type { Guide } from "@/types/guides";

export type TargetSequence = {
  guide: string;
  curatedPreqs: Array<{ level: number; guide: string }>;
};

export type Objective = {
  slug: string;
  title: string;
  summary: string;
  status?: string;
  curator: string;
  created_at: string;
  duration: number;

  targets: Array<TargetSequence>;
};

export type HydratedObjective = Omit<Objective, "targets"> & {
  targets: Array<
    Guide & { curatedPreqs: Array<{ level: number; guide: string }> }
  >;
  featuredSubObjective?: Array<{
    position: number;
    slug: string | null;
    title: string | null;
  }>;
};
