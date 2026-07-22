import { insert, type Insert } from "../helpers";

export function createSubject(overrides: Partial<Insert<"subjects">> = {}) {
  const unique = crypto.randomUUID().slice(0, 13);
  return insert("subjects", {
    slug: `subject-${unique}`,
    name: `Subject ${unique}`,
    status: "published",
    ...overrides,
  });
}

export function tagGuideRevision(guideRevisionId: string, subjectId: string) {
  return insert("guide_revision_subjects", {
    guide_revision_id: guideRevisionId,
    subject_id: subjectId,
  });
}

export function tagObjectiveRevision(
  objectiveRevisionId: string,
  subjectId: string
) {
  return insert("objective_revision_subjects", {
    objective_revision_id: objectiveRevisionId,
    subject_id: subjectId,
  });
}
