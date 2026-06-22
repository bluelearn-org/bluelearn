import type { Guide } from "@/types/guides"
import type { HydratedPath, Path } from "@/types/paths"

export const createGuideMap = (guides: Array<Guide>): Record<string, Guide> => {
  const guideMap = guides.reduce<Record<string, Guide>>((acc, guide) => {
    acc[guide.slug] = guide;
    return acc;
  }, {});

  return guideMap;
}

export const hydratePaths = (guides: Array<Guide>, paths: Array<Path>): Array<HydratedPath> => {
  const guideMap = createGuideMap(guides);

  const hydratedPaths = paths.map((path) => ({
    ...path,
    levels: path.levels.map((l) => ({
      level: l.level,
      guide: guideMap[l.guide]
    }))
  }));

  return hydratedPaths
}

export const getPathBySlug = (paths: Array<Path>, slug: string) => {
  const foundPath = paths.find(path => path.slug === slug);
  return foundPath;
}