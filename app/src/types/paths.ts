import type { Guide } from "@/types/guides";

export type PathLevel = {
  level: number;
  guide: string;
};

export type Path = {
  slug: string;
  title: string;
  summary: string;
  curator: string;
  created_at: string;
  duration: number;

  levels: Array<PathLevel>;
};

export type Level = {
  level: number;
  guide: Guide;
};

export type HydratedPath = Omit<Path, "levels"> & {
  levels: Array<Level>;
};
