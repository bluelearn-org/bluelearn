import { Button } from "@/components/ui/button";
import { GuideCard } from "@/components/cards/GuideCard";

import { Route as GuideRoute } from "@/routes/guides/$slug/index";
import { Route as GuideWalkthroughRoute } from "@/routes/guides/$slug/walkthrough";

type Props = {
  Stepper: any;
  stepper: any;
  target: any;
};

export function SubObjectiveStep({ Stepper, stepper, target }: Props) {
  return (
    <Stepper.Content step={target.slug}>
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        {/* ordered guides */}
        <ol className="m-0 flex w-full list-none flex-col gap-3 p-0">
          {target.guides.map((subobjective: any, index: number) => {
            const guide = {
              ...subobjective.guide,
              stats: [
                {
                  label: "Duration",
                  data: subobjective.guide.duration,
                },
              ],
              actionBtns: (
                <div className="col-span-2 col-start-3 mt-5 flex items-center justify-around border-t-1 p-4 pt-8 lg:mt-0 lg:border-none lg:pt-4">
                  <a
                    href={GuideWalkthroughRoute.to.replace(
                      "$slug",
                      subobjective.guide.slug
                    )}
                    className="btn-outline"
                  >
                    View Walkthrough
                  </a>

                  <a
                    href={GuideRoute.to.replace(
                      "$slug",
                      subobjective.guide.slug
                    )}
                    className="btn-pri"
                  >
                    Read
                  </a>
                </div>
              ),
            };

            return (
              <li
                key={guide.slug}
                className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-badge-border bg-badge font-mono text-base font-semibold text-badge-foreground sm:m-8 md:m-16 lg:m-28">
                  {index + 1}
                </div>

                <div className="w-full min-w-0 flex-1">
                  <GuideCard guide={guide} />
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </Stepper.Content>
  );
}
