export type Subject = {
  slug: string;
  name: string;
  summary: string;
  paths_total: number;
  guides_total: number;
  status?: string;
};

export type SubjectReference = {
  slug: string;
  name: string;
};
