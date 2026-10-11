import React, { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { GuideListItem } from "@bluelearn/schemas";
import type { ObjectiveContribution } from "@/types/contributions";
import { Separator } from "@/components/ui/separator";
import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import { Combobox } from "@/components/ui/combobox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/cards/Footer";
import { nodeCard } from "@/lib/objectiveGraphEdits";
import {
  buildDraftObjectiveSnapshot,
  buildSubObjectives,
} from "@/lib/objectiveSnapshot";
import { ObjectiveGraph } from "@/components/objective/ObjectiveGraph";
import { Button } from "@/components/ui/button";

type PropTypes = {
  Stepper: any;
  objectiveContData: ObjectiveContribution;
  setObjectiveContData: Dispatch<SetStateAction<ObjectiveContribution>>;
  onSaveDraft?: () => void;
  onPublish: () => void;
  submitting: boolean;
  isDirty?: boolean;
  isSynced?: boolean;
  guideOptions: Array<GuideListItem>;
  subjectOptions: Array<any>;
};

type FeaturedNode = {
  position: number;
  slug: string | null;
  title: string | null;
};

function FeaturedSubObjective({ nodes }: { nodes: Array<FeaturedNode> }) {
  const shown = nodes.slice(-3);
  const hidden = nodes.length - shown.length;

  return (
    <CardContent className="border-t p-4">
      <div className="flex items-center justify-center gap-4 sm:gap-8 md:gap-12">
        {hidden > 0 && (
          <React.Fragment>
            <div className="flex w-full flex-col items-center justify-center text-center sm:w-18 md:w-22">
              <span className="flex h-8 shrink-0 items-center justify-center text-sm font-medium">
                {hidden}
              </span>
              <span className="line-clamp-3 text-sm leading-snug text-muted-foreground">
                guides
              </span>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="mt-1.5 h-4 w-4 shrink-0 rotate-90 text-muted-foreground sm:rotate-0" />
            </div>
          </React.Fragment>
        )}
        {shown.map((step, index) => (
          <React.Fragment key={step.position}>
            <div className="flex w-full flex-col items-center justify-center text-center sm:w-24 md:w-28">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-badge text-sm font-medium">
                {step.position}
              </span>
              <span className="line-clamp-3 text-sm leading-snug text-muted-foreground">
                {step.title}
              </span>
            </div>
            {index < shown.length - 1 && (
              <div className="flex items-center justify-center">
                <ArrowRight className="h-5 w-5 shrink-0 rotate-90 text-muted-foreground sm:rotate-0" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </CardContent>
  );
}

function PreviewObjectiveCard({ objective }: { objective: any }) {
  return (
    <Card className="group flex flex-col justify-between rounded-md bg-background shadow-none transition-colors hover:bg-muted">
      <CardHeader className="relative p-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            Objective
          </p>
        </div>

        <h3 className="line-clamp-2 text-xl font-semibold tracking-tight">
          {objective.title}
        </h3>

        <p className="max-w-2xl text-sm text-muted-foreground">
          {objective.summary}
        </p>

        <div className="flex items-center justify-between">
          <p className="mono-micro text-muted-foreground">
            @{objective.curator} | {objective.created_at}
          </p>
        </div>

        {objective.tags && objective.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-4">
            {objective.tags.map((tag: any) => {
              const slug = typeof tag === "string" ? tag : tag.slug;
              const name = typeof tag === "string" ? tag : tag.name;
              return (
                <Badge
                  key={slug}
                  variant="outline"
                  className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                >
                  {name}
                </Badge>
              );
            })}
          </div>
        )}
      </CardHeader>

      {objective.featuredSubObjective &&
        objective.featuredSubObjective.length > 0 && (
          <FeaturedSubObjective nodes={objective.featuredSubObjective} />
        )}

      {(objective.stats || objective.actionBtns) && (
        <Footer
          data={{ stats: objective.stats, actionBtns: objective.actionBtns }}
        />
      )}
    </Card>
  );
}

export const PreviewObjective = ({
  Stepper,
  objectiveContData,
  setObjectiveContData,
  onSaveDraft,
  onPublish,
  submitting,
  isDirty,
  isSynced,
  guideOptions,
  subjectOptions,
}: PropTypes) => {
  const [view, setView] = useState<"graph" | "linear">("graph");

  const snapshot = useMemo(
    () => buildDraftObjectiveSnapshot(objectiveContData),
    [objectiveContData]
  );
  const subObjectives = buildSubObjectives(snapshot);

  const guidesBySlug = new Map<string, GuideListItem>();
  for (const guide of guideOptions) {
    if (guide.slug) guidesBySlug.set(guide.slug, guide);
  }

  const cardOf = (nodeId: string) =>
    nodeCard(objectiveContData.graph, guidesBySlug, nodeId);

  const getGuideTitle = (nodeId: string) => cardOf(nodeId)?.title ?? nodeId;

  const getSubjectName = (id: string) => {
    const subject = subjectOptions.find((s) => s.id === id);
    return subject ? subject.name : id;
  };

  const getGuideDuration = (nodeId: string) => {
    const guide = cardOf(nodeId);

    return guide && "duration_minutes" in guide ? guide.duration_minutes : 0;
  };

  const getGuideSummary = (nodeId: string) => cardOf(nodeId)?.summary || null;

  const getGuideTags = (nodeId: string): Array<any> =>
    cardOf(nodeId)?.tags || [];

  const getTargetDuration = (targetNodeId: string) => {
    const sub = subObjectives.find((s) => s.target.id === targetNodeId);

    return (
      sub?.steps.reduce(
        (total, node) => total + getGuideDuration(node.id),
        0
      ) ?? 0
    );
  };

  const includedNodes = snapshot.nodes.filter((node) => node.is_included);
  const totalDuration = includedNodes.reduce(
    (total, node) => total + getGuideDuration(node.id),
    0
  );
  const totalGuides = includedNodes.length;

  const featuredTargetSlug =
    objectiveContData.featuredSubObjective || objectiveContData.targets[0];

  const targetItems = objectiveContData.targets.map((slug) => ({
    value: slug,
    label: getGuideTitle(slug),
    description: getGuideSummary(slug) ?? undefined,
  }));

  const featuredSub = subObjectives.find(
    (sub) => sub.target.id === featuredTargetSlug
  );
  const featuredSubObjectiveNodes = featuredSub?.steps.map((node, index) => ({
    position: index + 1,
    slug: node.slug,
    title: getGuideTitle(node.id),
  }));

  const previewData = {
    slug: "",
    title: objectiveContData.title || "Untitled Objective",
    summary: objectiveContData.summary || "No summary provided.",
    curator: "preview",
    created_at: "Today",

    featuredSubObjective: featuredSubObjectiveNodes,
    stats: [
      {
        label: "Duration",
        data: `${totalDuration} min`,
      },
      {
        label: "Sub-objectives",
        data: objectiveContData.targets.length,
      },
      {
        label: "Guides",
        data: totalGuides,
      },
    ],

    tags: [
      ...objectiveContData.subjects.map((id) => ({
        slug: id,
        name: getSubjectName(id),
      })),
      ...objectiveContData.newSubjects.map((subject) => ({
        slug: subject.id ?? subject.name,
        name: subject.name,
      })),
    ],
  };

  return (
    <Stepper.Content step="preview-objective">
      <StepperActionHeader
        title={"Preview"}
        Stepper={Stepper}
        type="objective"
        onSaveDraft={onSaveDraft}
        onPublish={onPublish}
        publishLabel="Publish"
        submitting={submitting}
        isDirty={isDirty}
        isSynced={isSynced}
      />

      <Separator className="mb-8 bg-border" />

      <div className="mt-8 flex w-full flex-col gap-12">
        <Field className="space-y-2">
          <div className="space-y-1">
            <FieldLabel className="mono-micro">
              Featured Sub-Objective
            </FieldLabel>
            <FieldDescription className="text-xs">
              {targetItems.length === 0
                ? "Add a target guide on the design canvas first."
                : "The primary target guide to showcase on the objective card."}
            </FieldDescription>
          </div>

          <Combobox
            disabled={targetItems.length === 0}
            items={targetItems}
            value={featuredTargetSlug}
            onValueChange={(featuredSubObjective) =>
              setObjectiveContData((prev) => ({
                ...prev,
                featuredSubObjective,
              }))
            }
          />
        </Field>

        <PreviewObjectiveCard objective={previewData} />

        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase">
              Sub-Objectives
            </h3>

            <Button
              variant="outline"
              onClick={() => setView(view === "graph" ? "linear" : "graph")}
            >
              {view === "graph" ? "View Linear" : "View Graph"}
            </Button>
          </div>

          <Separator className="mb-4 bg-border" />

          {objectiveContData.targets.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">
              No sub-objectives configured.
            </p>
          ) : view === "graph" ? (
            <ObjectiveGraph
              objective={{ slug: "", title: objectiveContData.title }}
              snapshot={snapshot}
              guides={guideOptions}
              preview
            />
          ) : (
            <ol className="m-0 flex w-full list-none flex-col gap-10 px-0 pb-8">
              {objectiveContData.targets.map((targetNodeId, idx) => {
                const sub = subObjectives.find(
                  (s) => s.target.id === targetNodeId
                );

                return (
                  <li
                    key={idx}
                    className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-badge-border bg-badge font-mono text-base font-semibold text-badge-foreground sm:m-8 md:m-16 lg:m-28">
                      {idx + 1}
                    </div>

                    <Card className="flex-1 rounded-md bg-background shadow-none transition-colors hover:bg-muted">
                      <CardHeader className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <CardTitle className="text-base font-medium">
                            {getGuideTitle(targetNodeId)}
                          </CardTitle>
                          {getTargetDuration(targetNodeId) > 0 && (
                            <span className="shrink-0 font-mono text-[10px] text-muted-foreground uppercase">
                              {getTargetDuration(targetNodeId)} min
                            </span>
                          )}
                        </div>
                        {getGuideSummary(targetNodeId) && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {getGuideSummary(targetNodeId)}
                          </p>
                        )}
                        {getGuideTags(targetNodeId).length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {getGuideTags(targetNodeId).map((tag: any) => {
                              const tagSlug =
                                typeof tag === "string" ? tag : tag.slug;
                              const tagName =
                                typeof tag === "string"
                                  ? getSubjectName(tagSlug)
                                  : tag.name;
                              return (
                                <Badge
                                  key={tagSlug}
                                  variant="outline"
                                  className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                                >
                                  {tagName}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="border-t p-4">
                        {sub && (
                          <ol className="relative ml-3 space-y-6 border-l border-muted-foreground/20">
                            {sub.steps.map((node, stepIdx) => (
                              <li
                                key={node.id}
                                className="ml-6 flex flex-col gap-1"
                              >
                                <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full border border-muted-foreground/30 bg-background font-mono text-xs text-muted-foreground ring-4 ring-background">
                                  {stepIdx + 1}
                                </span>
                                <div className="mt-1 flex items-center justify-between gap-4">
                                  <span className="text-sm leading-none font-medium">
                                    {getGuideTitle(node.id)}
                                  </span>
                                  {getGuideDuration(node.id) > 0 && (
                                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground uppercase">
                                      {getGuideDuration(node.id)} min
                                    </span>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ol>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </Stepper.Content>
  );
};
