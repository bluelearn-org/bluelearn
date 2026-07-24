import type { Subject, SubjectReference } from "@/types/subjects";
import type {
  Guide,
  GuideReference,
  HydratedGuide,
  HydratedReviewGuide,
} from "@/types/guides";
import type { HydratedObjective, Objective } from "@/types/objectives";

// TODO: update to fetch from api
export const getPathBySlug = (paths: Array<Objective>, slug: string) => {
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
export const hydrateObjectives = (
  guides: Array<Guide>,
  paths: Array<Objective>
): Array<HydratedObjective> => {
  const guideMap = createGuideMap(guides);

  const hydratedObjectives = paths.map((path) => {
    // Traverse targets to find all unique prerequisites
    const includedGuides = new Set<string>();
    const queue = path.targets.map((t) => t.guide);

    while (queue.length > 0) {
      const currentSlug = queue.shift()!;
      if (includedGuides.has(currentSlug)) continue;
      includedGuides.add(currentSlug);

      const guide = guideMap[currentSlug];
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (guide && guide.prerequisites) {
        queue.push(...guide.prerequisites);
      }
    }

    let totalDuration = 0;
    for (const slug of includedGuides) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (guideMap[slug]) {
        totalDuration += guideMap[slug].duration || 0;
      }
    }

    let featuredSubObjective;
    if (path.targets.length > 0) {
      const primaryTarget = path.targets[0];
      featuredSubObjective = primaryTarget.curatedPreqs.map((sub) => {
        const subGuide = guideMap[sub.guide];
        return {
          position: sub.level,
          slug: sub.guide,
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          title: subGuide ? subGuide.title : null,
        };
      });
    }

    return {
      ...path,
      duration: totalDuration,
      targets: path.targets.map((target) => ({
        ...guideMap[target.guide],
        curatedPreqs: target.curatedPreqs,
      })),
      featuredSubObjective,
    };
  });

  return hydratedObjectives;
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

export const hydrateReviewGuide = (
  guide: Guide,
  guides: Array<Guide>,
  subjects: Array<Subject>
): HydratedReviewGuide => {
  const guideMap = createGuideMap(guides);
  const subjectMap = createSubjectMap(subjects);

  return {
    ...guide,
    type: "practical",

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
