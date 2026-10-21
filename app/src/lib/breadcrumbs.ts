/**
 * Where the user navigated to a guide from. Passed through router
 * history state so breadcrumbs reflect the actual navigation path
 * (learning path, subject, or another guide) instead of static data.
 */
export type BreadcrumbOrigin = {
  type: "objective" | "subject" | "guide";
  title: string;
  path: string;
  // Where on the origin page to land, e.g. the objective's open step.
  search?: Record<string, string | undefined>;
  hash?: string;
};

export type Breadcrumb = {
  label: string;
  path?: string;
  search?: Record<string, string | undefined>;
  hash?: string;
};

declare module "@tanstack/react-router" {
  interface HistoryState {
    breadcrumbOrigin?: BreadcrumbOrigin;
  }
}

/**
 * Build the breadcrumb trail for a guide page:
 *
 *   Home / <Origin Title> / <Guide Title>   (navigated from a known page)
 *   Home / <Guide Title>                    (direct visit, no origin)
 *
 * The last crumb (the current guide) has no path.
 */
export function buildBreadcrumbs(
  guideTitle: string,
  origin?: BreadcrumbOrigin
): Array<Breadcrumb> {
  const crumbs: Array<Breadcrumb> = [{ label: "Home", path: "/" }];

  if (origin) {
    const { title, path, search, hash } = origin;
    crumbs.push({
      label: title,
      path,
      ...(search && { search }),
      ...(hash && { hash }),
    });
  }

  crumbs.push({ label: guideTitle });

  return crumbs;
}
