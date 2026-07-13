import { insert, type Insert } from "../helpers";

export function createSubject(overrides: Partial<Insert<"subjects">> = {}) {
  // Short enough for the 35-char name cap, and slug === slugify(name) so a
  // duplicate POST of the same name collides with this row.
  const unique = crypto.randomUUID().slice(0, 13);
  return insert("subjects", {
    slug: `subject-${unique}`,
    name: `Subject ${unique}`,
    ...overrides,
  });
}

export function tagGuide(guideBaseId: string, subjectId: string) {
  return insert("guide_subjects", {
    guide_base_id: guideBaseId,
    subject_id: subjectId,
  });
}

export function tagObjective(objectiveId: string, subjectId: string) {
  return insert("objective_subjects", {
    objective_id: objectiveId,
    subject_id: subjectId,
  });
}
