import { GuideCard } from "@/components/cards/GuideCard";

import { Route as GuideRoute } from "@/routes/guides/$slug/index";

type Props = {
  Stepper: any;
  target: any;
  objective: any;
};

export function SubObjectiveStep({ Stepper, target, objective }: Props) {
  return (
    <Stepper.Content step={target.slug}>
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        {/* ordered guides */}
        <ol className="m-0 flex w-full list-none flex-col gap-3 p-0">
          {target.guides.map((guideObj: any, index: number) => {
            const guide = {
              ...guideObj,
              stats: [
                {
                  label: "Duration",
                  data: guideObj.duration,
                },
              ],
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
                  <GuideCard
                    guide={guide}
                    to={GuideRoute.to}
                    origin={{
                      type: "objective",
                      title: objective.title,
                      path: `/objectives/${objective.slug}`,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </Stepper.Content>
  );
}
