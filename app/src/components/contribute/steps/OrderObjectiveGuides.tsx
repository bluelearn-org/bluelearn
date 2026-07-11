import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  Clock,
  GripVertical,
  Info,
  Layers,
  ListOrdered,
  Milestone,
  Replace,
  User,
} from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { ObjectiveContribution } from "@/types/contributions";
import { Badge } from "@/components/ui/badge";
import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import { Combobox } from "@/components/ui/combobox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import guidesData from "@/data/guides.json";

// Map for O(1) guide lookup
const guidesMap = new Map(guidesData.map((g) => [g.slug, g]));

type PropTypes = {
  Stepper: any;
  objectiveContData: ObjectiveContribution;
  setObjectiveContData: Dispatch<SetStateAction<ObjectiveContribution>>;
};

type WalkthroughNode = {
  slug: string;
  title: string;
  summary: string;
  level: number;
};

// Compute transitive prerequisites for a given target guide to generate the Walkthrough DAG
const computeWalkthrough = (targetSlug: string): Array<WalkthroughNode> => {
  // 1. Find all nodes in the transitive prerequisite closure
  const closure = new Set<string>();
  const queue = [targetSlug];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (!closure.has(current)) {
      closure.add(current);
      const guide = guidesMap.get(current);
      if (guide) {
        for (const prereq of guide.prerequisites) {
          queue.push(prereq);
        }
      }
    }
  }

  // 2. Compute levels for each node in the closure based on longest path depth
  const memo: Record<string, number> = {};

  const getLevel = (slug: string, visited = new Set<string>()): number => {
    if (slug in memo) return memo[slug];
    if (visited.has(slug)) {
      return 1;
    }

    const guide = guidesMap.get(slug);
    if (!guide || guide.prerequisites.length === 0) {
      memo[slug] = 1;
      return 1;
    }

    const prereqsInClosure = guide.prerequisites.filter((p) => closure.has(p));
    if (prereqsInClosure.length === 0) {
      memo[slug] = 1;
      return 1;
    }

    visited.add(slug);
    const maxPrereqLevel = Math.max(
      ...prereqsInClosure.map((p) => getLevel(p, new Set(visited)))
    );
    visited.delete(slug);

    memo[slug] = maxPrereqLevel + 1;
    return maxPrereqLevel + 1;
  };

  const result: Array<WalkthroughNode> = [];
  for (const slug of closure) {
    const guide = guidesMap.get(slug);
    if (guide) {
      result.push({
        slug,
        title: guide.title,
        summary: guide.summary,
        level: getLevel(slug),
      });
    }
  }

  return result;
};

// Helper to get transitive prerequisites of a guide
const getTransitivePrereqs = (slug: string): Set<string> => {
  const prereqs = new Set<string>();
  const queue = [slug];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const guide = guidesMap.get(current);
    if (guide) {
      for (const p of guide.prerequisites) {
        if (!prereqs.has(p)) {
          prereqs.add(p);
          queue.push(p);
        }
      }
    }
  }
  return prereqs;
};

export const OrderObjectiveGuides = ({
  Stepper,
  objectiveContData,
  setObjectiveContData,
}: PropTypes) => {
  const [targetSlug, setTargetSlug] = useState<string>(
    objectiveContData.selectedSlugs[0] || ""
  );
  const [curatedSequence, setCuratedSequence] = useState<Array<string>>([]);
  const [isVariantAlertOpen, setIsVariantAlertOpen] = useState(false);

  // Find violations in the current sequence
  const findViolations = (): Record<string, Array<string> | undefined> => {
    const violations: Record<string, Array<string> | undefined> = {};
    const slugToIndex: Record<string, number> = {};
    curatedSequence.forEach((slug, idx) => {
      slugToIndex[slug] = idx;
    });

    curatedSequence.forEach((slug) => {
      const transPrereqs = getTransitivePrereqs(slug);
      const outOfOrderPrereqs: Array<string> = [];
      transPrereqs.forEach((prereq) => {
        if (prereq in slugToIndex && slugToIndex[prereq] > slugToIndex[slug]) {
          const title = guidesMap.get(prereq)?.title || prereq;
          outOfOrderPrereqs.push(title);
        }
      });
      if (outOfOrderPrereqs.length > 0) {
        violations[slug] = outOfOrderPrereqs;
      }
    });

    return violations;
  };

  const violations = findViolations();
  const isCustomSequence = Object.keys(violations).length > 0;

  const selectedGuidesList = guidesData.filter((g) =>
    objectiveContData.selectedSlugs.includes(g.slug)
  );

  const targetGuide = targetSlug ? guidesMap.get(targetSlug) : undefined;

  // Compute walkthrough nodes for the target
  const walkthroughNodes = targetSlug ? computeWalkthrough(targetSlug) : [];

  const updateSubObjective = (slug: string, newSeq: Array<string>) => {
    setObjectiveContData((prev) => {
      const exists = prev.subObjectives.some((s) => s.targetSlug === slug);
      const updatedSubs = exists
        ? prev.subObjectives.map((s) =>
            s.targetSlug === slug
              ? { ...s, curatedSequence: newSeq, selectedSlugs: newSeq }
              : s
          )
        : [
            ...prev.subObjectives,
            {
              targetSlug: slug,
              selectedSlugs: newSeq,
              curatedSequence: newSeq,
            },
          ];
      return {
        ...prev,
        subObjectives: updatedSubs,
      };
    });
  };

  // Sync initial curated sequence when target guide changes
  useEffect(() => {
    if (!targetSlug) return;

    const existingSub = objectiveContData.subObjectives.find(
      (s) => s.targetSlug === targetSlug
    );

    if (existingSub) {
      setCuratedSequence(existingSub.curatedSequence);
    } else {
      const nodes = computeWalkthrough(targetSlug);
      // Seed with all prerequisites (excluding the target guide itself) sorted by levels
      const initialPrereqs = nodes
        .filter((n) => n.slug !== targetSlug)
        .sort((a, b) => a.level - b.level)
        .map((n) => n.slug);

      setCuratedSequence(initialPrereqs);

      setObjectiveContData((prev) => {
        if (prev.subObjectives.some((s) => s.targetSlug === targetSlug)) {
          return prev;
        }
        return {
          ...prev,
          subObjectives: [
            ...prev.subObjectives,
            {
              targetSlug,
              selectedSlugs: initialPrereqs,
              curatedSequence: initialPrereqs,
            },
          ],
        };
      });
    }
  }, [targetSlug]);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const draggedIndexRef = useRef<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    draggedIndexRef.current = index;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const currentDragged = draggedIndexRef.current;
    if (currentDragged === null || currentDragged === index) return;

    const newSeq = [...curatedSequence];
    const draggedItem = newSeq[currentDragged];
    if (!draggedItem) return;
    newSeq.splice(currentDragged, 1);
    newSeq.splice(index, 0, draggedItem);

    setCuratedSequence(newSeq);
    updateSubObjective(targetSlug, newSeq);

    draggedIndexRef.current = index;
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    draggedIndexRef.current = null;
    setDraggedIndex(null);
  };

  // Toggle selection of guide in the walkthrough
  const handleToggleGuide = (slug: string, checked: boolean) => {
    let newSeq: Array<string>;
    if (checked) {
      newSeq = [...curatedSequence, slug];
    } else {
      newSeq = curatedSequence.filter((s) => s !== slug);
    }
    setCuratedSequence(newSeq);
    updateSubObjective(targetSlug, newSeq);
  };

  // Group walkthrough nodes by level for display
  const groupedLevels = walkthroughNodes.reduce(
    (acc, node) => {
      if (!acc[node.level]) {
        acc[node.level] = [];
      }
      acc[node.level]?.push(node);
      return acc;
    },
    {} as Record<number, Array<WalkthroughNode> | undefined>
  );

  const sortedLevels = Object.keys(groupedLevels)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <Stepper.Content step="objective-ordering">
      <StepperActionHeader title={"Order Guides"} Stepper={Stepper} />

      <FieldGroup className="space-y-6">
        {/* Dropdown: Pick Target Guide */}
        <Field className="max-w-3xl space-y-2">
          <FieldLabel className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
            Target Guide
          </FieldLabel>
          <div className="flex items-center gap-4">
            <div className="w-75 shrink-0">
              <Combobox
                items={selectedGuidesList.map((g) => ({
                  value: g.slug,
                  label: g.title,
                  description: g.summary,
                }))}
                value={targetSlug}
                onValueChange={(val) => setTargetSlug(val)}
              />
            </div>
            <div className="self-stretch border-l border-border/80" />
            <FieldDescription className="mt-0 max-w-xs text-[11px] leading-normal text-muted-foreground/75">
              Select which guide represents the final endpoint (target) of this
              sub-objective.
            </FieldDescription>
          </div>
        </Field>

        <div className="grid h-[calc(100vh-450px)] min-h-87.5 w-full grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
          {/* Left Pane: Curated Sequence (7 cols) */}
          <Card className="flex h-full max-h-full flex-col overflow-hidden rounded-lg border border-border bg-card/35 shadow-none backdrop-blur-sm lg:col-span-7">
            <CardHeader className="border-b pb-4">
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <ListOrdered className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-semibold">
                    Create a Curated Sequence
                  </CardTitle>
                </div>
                <div className="flex items-center gap-1.5 pr-1 select-none">
                  <span
                    className={`h-2 w-2 rounded-full transition-all duration-300 ${
                      isCustomSequence
                        ? "animate-pulse bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                        : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    }`}
                  />
                  <span className="font-mono text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    {isCustomSequence ? "Custom" : "Level-Ordered"}
                  </span>
                </div>
              </div>
              <CardDescription>
                Build the sequential learning plan by ordering selected guides.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4">
              {curatedSequence.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                  <Info className="mb-2 h-8 w-8 text-muted-foreground opacity-50" />
                  <p className="text-sm font-medium">
                    No prerequisite guides selected.
                  </p>
                  <p className="mt-1 max-w-62.5 text-xs text-muted-foreground/80">
                    Select prerequisite guides from the prerequisites on the
                    right to add them to your curated sequence.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {curatedSequence.map((slug, index) => {
                  const guide = guidesMap.get(slug);
                  if (!guide) return null;

                  const isDragging = index === draggedIndex;

                  return (
                    <div
                      key={slug}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`relative flex items-center justify-between gap-3 rounded-lg border p-3 pl-12 shadow-sm transition-all select-none ${
                        isDragging
                          ? "cursor-grabbing border-primary/50 bg-primary/5 opacity-40"
                          : "cursor-grab border-border bg-background hover:border-primary/30"
                      }`}
                    >
                      {/* Left controls column positioned absolutely with background and border separation */}
                      <div className="absolute inset-y-0 left-0 z-10 w-9 rounded-l-lg border-r border-border/70 bg-muted/40">
                        {/* Swap Variant Button at the top */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2.5 left-1.5 z-10 h-6 w-6 border-none p-0 text-muted-foreground/60 hover:bg-primary/10 hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsVariantAlertOpen(true);
                          }}
                          onDragStart={(e) => e.stopPropagation()}
                          title="Swap Variant"
                        >
                          <Replace className="h-3.5 w-3.5" />
                        </Button>

                        {/* Drag Icon completely centered vertically */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-grab text-muted-foreground/60 hover:text-foreground">
                          <GripVertical className="h-4 w-4" />
                        </div>
                      </div>

                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-semibold text-primary">
                              {index + 1}
                            </span>
                            <h4 className="truncate text-sm font-medium text-foreground">
                              {guide.title}
                            </h4>
                          </div>
                          {/* Author & Date under title, before description */}
                          {(guide.author || guide.created_at) && (
                            <div className="mt-1 ml-8 flex flex-wrap items-center gap-2.5 text-[10px] text-muted-foreground/80">
                              {guide.author && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3 text-muted-foreground/75" />
                                  @{guide.author}
                                </span>
                              )}
                              {guide.created_at && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3 text-muted-foreground/75" />
                                  {guide.created_at}
                                </span>
                              )}
                            </div>
                          )}
                          <p className="mt-1.5 ml-8 text-xs text-muted-foreground">
                            {guide.summary}
                          </p>
                          {/* Duration & Tags below description */}
                          <div className="mt-2 ml-8 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
                            {guide.duration && (
                              <span className="flex items-center gap-1 font-medium">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground/75" />
                                {guide.duration}m
                              </span>
                            )}
                            {guide.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {guide.tags.map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant="outline"
                                    className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 border-none text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleToggleGuide(slug, false)}
                        title="Remove from Sequence"
                      >
                        <span className="text-lg leading-none">&times;</span>
                      </Button>
                    </div>
                  );
                })}

                {/* Automatically Pinned Target Guide */}
                {targetGuide && (
                  <div className="flex items-start gap-3 rounded-lg border border-primary bg-primary/5 p-3 shadow-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-xs font-semibold text-primary-foreground">
                          {curatedSequence.length + 1}
                        </span>
                        <h4 className="truncate text-sm font-semibold text-foreground">
                          {targetGuide.title}
                        </h4>
                        <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-primary uppercase">
                          Target
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 border-none p-0 text-primary hover:bg-primary/20"
                          onClick={() => {
                            setIsVariantAlertOpen(true);
                          }}
                          title="Swap Target Variant"
                        >
                          <Replace className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {/* Target Guide Author & Date under title, before description */}
                      {(targetGuide.author || targetGuide.created_at) && (
                        <div className="mt-1 ml-7 flex flex-wrap items-center gap-2.5 text-[10px] text-muted-foreground/80">
                          {targetGuide.author && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3 text-primary/70" />@
                              {targetGuide.author}
                            </span>
                          )}
                          {targetGuide.created_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-primary/70" />
                              {targetGuide.created_at}
                            </span>
                          )}
                        </div>
                      )}
                      <p className="mt-1.5 ml-7 text-xs text-muted-foreground">
                        {targetGuide.summary}
                      </p>
                      {/* Pinned target guide duration & tags below description */}
                      <div className="mt-2 ml-7 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
                        {targetGuide.duration && (
                          <span className="flex items-center gap-1 font-medium">
                            <Clock className="h-3.5 w-3.5 text-primary/70" />
                            {targetGuide.duration}m
                          </span>
                        )}
                        {targetGuide.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {targetGuide.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="mono-micro rounded-full border border-primary/20 bg-primary/5 tracking-[0.08em] text-primary"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right Pane: Generated Walkthrough by Level (5 cols) */}
          <Card className="flex h-full max-h-full flex-col overflow-hidden rounded-lg border border-border bg-muted/10 shadow-none lg:col-span-5">
            <CardHeader className="border-b pb-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Layers className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-semibold text-foreground">
                  Prerequisite Guides
                </CardTitle>
              </div>
              <CardDescription>
                Select guides from the target's computed prerequisite DAG to
                include in your curation.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-6 overflow-y-auto p-4">
              {sortedLevels.map((level) => (
                <div key={level} className="space-y-3">
                  <div className="flex items-center gap-2 border-b pb-1">
                    <Milestone className="h-4 w-4 text-primary" />
                    <span className="font-mono text-xs font-bold tracking-wider text-muted-foreground uppercase">
                      Level {level}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {groupedLevels[level]?.map((node) => {
                      const isTarget = node.slug === targetSlug;
                      const isChecked =
                        isTarget || curatedSequence.includes(node.slug);
                      const guideInfo = guidesMap.get(node.slug);

                      return (
                        <div
                          key={node.slug}
                          onClick={() => {
                            if (!isTarget) {
                              handleToggleGuide(node.slug, !isChecked);
                            }
                          }}
                          className={`flex items-start gap-3 rounded-lg border p-3 shadow-sm transition-all select-none ${
                            isTarget
                              ? "cursor-default border-primary/30 bg-primary/5 opacity-90"
                              : isChecked
                                ? "cursor-pointer border-primary/25 bg-primary/5 hover:bg-primary/10"
                                : "cursor-pointer border-border bg-background hover:bg-muted/30"
                          }`}
                        >
                          <div className="pt-0.5">
                            <Checkbox
                              checked={isChecked}
                              disabled={isTarget}
                              className="pointer-events-none"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
                              {node.title}
                              {isTarget && (
                                <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-primary uppercase">
                                  Target
                                </span>
                              )}
                            </h4>
                            {/* Author & Date under title, before description */}
                            {guideInfo &&
                              (guideInfo.author || guideInfo.created_at) && (
                                <div className="mt-1 flex flex-wrap items-center gap-2.5 text-[10px] text-muted-foreground/80">
                                  {guideInfo.author && (
                                    <span className="flex items-center gap-1">
                                      <User className="h-3 w-3 text-muted-foreground/75" />
                                      @{guideInfo.author}
                                    </span>
                                  )}
                                  {guideInfo.created_at && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3 text-muted-foreground/75" />
                                      {guideInfo.created_at}
                                    </span>
                                  )}
                                </div>
                              )}
                            <p className="mt-1.5 text-xs text-muted-foreground">
                              {node.summary}
                            </p>
                            {/* Prerequisite guide duration & tags below description */}
                            {guideInfo && (
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
                                {guideInfo.duration && (
                                  <span className="flex items-center gap-1 font-medium">
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground/75" />
                                    {guideInfo.duration}m
                                  </span>
                                )}
                                {guideInfo.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {guideInfo.tags.map((tag) => (
                                      <Badge
                                        key={tag}
                                        variant="outline"
                                        className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                                      >
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </FieldGroup>

      {/* Swap Variant Dialog Modal */}
      {isVariantAlertOpen && (
        <div className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/80 p-4 backdrop-blur-xs duration-200 fade-in">
          <div className="w-full max-w-sm animate-in rounded-xl border border-border bg-card p-6 text-center shadow-lg duration-200 zoom-in-95">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Replace className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Variant Selection Coming Soon
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Choosing alternative guide variants is currently under
              development. In this version, objectives only support the
              canonical versions of the selected guides.
            </p>
            <div className="mt-6 border-t pt-4">
              <Button
                className="w-full"
                onClick={() => setIsVariantAlertOpen(false)}
              >
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </Stepper.Content>
  );
};
