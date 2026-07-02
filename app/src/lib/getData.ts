import type { Subject, SubjectReference } from "@/types/subjects";
import type { Guide, GuideReference, HydratedGuide } from "@/types/guides";
import type { HydratedPath, Path } from "@/types/paths";

// TODO: update to fetch from api
export const getPathBySlug = (paths: Array<Path>, slug: string) => {
  const foundPath = paths.find((path) => path.slug === slug);
  return foundPath;
};

// TODO: update to fetch from api
export const getGuideBySlug = (guides: Array<Guide>, slug: string) => {
  const foundGuide = guides.find((guide) => guide.slug === slug);
  return foundGuide;
};

// TODO: used for hydration - remove when fetching from api
export const createGuideMap = (guides: Array<Guide>): Record<string, Guide> => {
  const guideMap = guides.reduce<Record<string, Guide>>((acc, guide) => {
    acc[guide.slug] = guide;
    return acc;
  }, {});

  return guideMap;
};

export const createSubjectMap = (
  subjects: Array<Subject>
): Record<string, Subject> => {
  const subjectMap = subjects.reduce<Record<string, Subject>>(
    (acc, subject) => {
      acc[subject.slug] = subject;
      return acc;
    },
    {}
  );

  return subjectMap;
};

// TODO: when integrating api, hydration should be done on the backend - change this to fetch from api
export const hydratePaths = (
  guides: Array<Guide>,
  paths: Array<Path>
): Array<HydratedPath> => {
  const guideMap = createGuideMap(guides);

  const hydratedPaths = paths.map((path) => ({
    ...path,
    levels: path.levels.map((l) => ({
      level: l.level,
      guide: guideMap[l.guide],
    })),
  }));

  return hydratedPaths;
};

export const hydrateGuide = (
  guide: Guide,
  guides: Array<Guide>,
  subjects: Array<Subject>
): HydratedGuide => {
  const guideMap = createGuideMap(guides);
  const subjectMap = createSubjectMap(subjects);

  return {
    ...guide,

    tags: guide.tags
      .map((slug) => subjectMap[slug])
      .map<SubjectReference>((subject) => ({
        slug: subjectMap[subject.slug].slug,
        name: subjectMap[subject.slug].name,
      })),

    prerequisites: guide.prerequisites
      .map((slug) => guideMap[slug])
      .map<GuideReference>((prereq) => ({
        slug: prereq.slug,
        title: prereq.title,
      })),
  };
};
