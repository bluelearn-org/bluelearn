import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Clock,
  Info,
  ListOrdered,
  Maximize,
  Minimize,
  Replace,
  User,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { GuideGraph } from "../graph-view/GuideGraph";
import type { Dispatch, SetStateAction } from "react";
import type { ObjectiveContribution } from "@/types/contributions";
import { DraggableGuideCard } from "@/components/contribute/DraggableGuideCard";
import { Badge } from "@/components/ui/badge";
import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
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

  const getLevel = (slug: string): number => {
    if (slug in memo) return memo[slug];

    const guide = guidesMap.get(slug);
    if (!guide || guide.prerequisites.length === 0) {
      memo[slug] = 1;
      return 1;
    }

    const maxPrereqLevel = Math.max(
      ...guide.prerequisites.map((p: string) => getLevel(p))
    );

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

export const OrderObjectiveGuides = ({
  Stepper,
  objectiveContData,
  setObjectiveContData,
}: PropTypes) => {
  const [showErrors, setShowErrors] = useState(false);
  const [targetSlug, setTargetSlug] = useState<string>(
    objectiveContData.targets[0] || ""
  );
  const [curatedSequence, setCuratedSequence] = useState<Array<string>>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredGuide, setHoveredGuide] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"sequence" | "graph">("sequence");

  const targetGuide = targetSlug ? guidesMap.get(targetSlug) : undefined;

  const totalDuration = useMemo(() => {
    let mins = targetGuide?.duration || 0;
    curatedSequence.forEach((slug) => {
      const guide = guidesMap.get(slug);
      if (guide && guide.duration) {
        mins += guide.duration;
      }
    });
    return mins;
  }, [curatedSequence, targetGuide]);

  const formattedDuration = useMemo(() => {
    if (totalDuration === 0) return "0m";
    const h = Math.floor(totalDuration / 60);
    const m = totalDuration % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }, [totalDuration]);

  // Compute walkthrough nodes for the target
  const walkthroughNodes = useMemo(() => {
    return targetSlug ? computeWalkthrough(targetSlug) : [];
  }, [targetSlug]);

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

  // Sync targetSlug if the list of targets changes and targetSlug becomes invalid
  useEffect(() => {
    if (objectiveContData.targets.length > 0) {
      if (!objectiveContData.targets.includes(targetSlug)) {
        setTargetSlug(objectiveContData.targets[0] || "");
      }
    } else {
      setTargetSlug("");
    }
  }, [objectiveContData.targets, targetSlug]);

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
    setHoveredGuide(null); // Clear hover state to prevent graph re-renders
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
    setHoveredGuide(null);
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

  const isNextDisabled =
    objectiveContData.subObjectives.length < objectiveContData.targets.length;

  const handleNextClick = (e: React.MouseEvent) => {
    if (isNextDisabled) {
      e.preventDefault();
      setShowErrors(true);
      toast.error(
        "Please visit and order every target guide before proceeding."
      );
    }
  };

  return (
    <Stepper.Content
      step="objective-ordering"
      className="flex min-h-0 w-full flex-1 flex-col"
    >
      <StepperActionHeader
        title={"Order Guides"}
        Stepper={Stepper}
        onNextClick={handleNextClick}
      />

      <FieldGroup className="mt-0 flex min-h-0 flex-1 flex-col">
        {/* Target Guide Sequence */}
        <Field className="mb-0 min-w-0 shrink-0 space-y-2">
          <div className="flex items-baseline gap-4">
            <FieldLabel className="mono-micro">
              Target Guide Sequence
            </FieldLabel>
            <FieldDescription className="m-0 text-[11px] text-muted-foreground/75">
              Select a target guide from your sequence to curate its
              prerequisites.
            </FieldDescription>
          </div>
          <div className="flex scrollbar-thin [scrollbar-color:var(--border)_transparent] items-center gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
            {objectiveContData.targets.map((slug, index) => {
              const guide = guidesMap.get(slug);
              if (!guide) return null;

              const isActive = slug === targetSlug;
              const hasVisited = objectiveContData.subObjectives.some(
                (s) => s.targetSlug === slug
              );

              return (
                <div key={slug} className="flex shrink-0 items-center gap-2">
                  {index > 0 && <div className="h-px w-4 bg-border/60" />}
                  <button
                    type="button"
                    onClick={() => setTargetSlug(slug)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                        : showErrors && !hasVisited
                          ? "border-destructive bg-destructive/5 text-destructive hover:bg-destructive/10"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-muted"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : showErrors && !hasVisited
                            ? "bg-destructive/20 text-destructive"
                            : "bg-muted-foreground/20 text-muted-foreground"
                      }`}
                    >
                      {index + 1}
                    </span>
                    {guide.title}
                  </button>
                </div>
              );
            })}
          </div>
        </Field>

        {/* Mobile Tab Switcher */}
        <div className="mb-4 flex w-full shrink-0 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground lg:hidden">
          <button
            type="button"
            onClick={() => setMobileTab("sequence")}
            className={`inline-flex flex-1 items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all ${
              mobileTab === "sequence"
                ? "bg-background text-foreground shadow-sm"
                : "hover:bg-muted-foreground/10 hover:text-foreground"
            }`}
          >
            Sequence
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("graph")}
            className={`inline-flex flex-1 items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all ${
              mobileTab === "graph"
                ? "bg-background text-foreground shadow-sm"
                : "hover:bg-muted-foreground/10 hover:text-foreground"
            }`}
          >
            Graph
          </button>
        </div>

        <div
          className={
            isFullscreen
              ? "fixed inset-0 z-50 grid animate-in grid-cols-1 items-stretch gap-6 bg-background/95 p-6 backdrop-blur-md fade-in lg:grid-cols-12 lg:grid-rows-1"
              : "grid min-h-0 w-full flex-1 grid-cols-1 items-stretch gap-6 lg:grid-cols-12 lg:grid-rows-1"
          }
        >
          {/* Left Pane: Curated Sequence */}
          <Card
            className={`min-h-0 w-full flex-col self-start overflow-hidden rounded-lg border border-border bg-card/35 shadow-none backdrop-blur-sm ${
              mobileTab === "sequence" ? "flex" : "hidden lg:flex"
            } ${isFullscreen ? "lg:col-span-4" : "lg:col-span-5"}`}
          >
            <CardHeader className="border-b pb-4">
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <ListOrdered className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-semibold">
                    Curate Guide Sequence
                  </CardTitle>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 pr-3 select-none">
                  <Clock className="h-3 w-3 text-primary" />
                  <span className="font-mono text-[10px] font-bold tracking-wider text-primary uppercase">
                    Total Time: {formattedDuration}
                  </span>
                </div>
              </div>
              <CardDescription>
                Build the sequential learning plan by ordering selected guides.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-128 min-h-0 flex-1 scrollbar-thin [scrollbar-color:var(--border)_transparent] overflow-y-auto p-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
              {curatedSequence.length === 0 && walkthroughNodes.length > 1 && (
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
                    <DraggableGuideCard
                      key={slug}
                      guide={guide}
                      index={index}
                      isDragging={isDragging}
                      isHovered={hoveredGuide === slug}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragEnd={handleDragEnd}
                      onMouseEnter={() => {
                        if (draggedIndex === null) setHoveredGuide(slug);
                      }}
                      onMouseLeave={() => {
                        if (draggedIndex === null) setHoveredGuide(null);
                      }}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 border-none text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleToggleGuide(slug, false)}
                        title="Remove from Sequence"
                      >
                        <span className="text-lg leading-none">&times;</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        disabled
                        className="h-8 w-8 cursor-not-allowed border-none p-0 text-muted-foreground/40 hover:bg-transparent"
                        title="Variants Coming Soon"
                      >
                        <Replace className="h-5 w-5" />
                      </Button>
                    </DraggableGuideCard>
                  );
                })}

                {/* Automatically Pinned Target Guide */}
                {targetGuide && (
                  <div
                    className={`flex items-start gap-3 rounded-lg border border-primary bg-primary/5 p-3 shadow-sm transition-all duration-150 ${
                      hoveredGuide === targetGuide.slug
                        ? "shadow-md ring-2 ring-primary/40"
                        : "hover:shadow-md hover:ring-2 hover:ring-primary/40"
                    }`}
                    onMouseEnter={() => {
                      if (draggedIndex === null)
                        setHoveredGuide(targetGuide.slug);
                    }}
                    onMouseLeave={() => {
                      if (draggedIndex === null) setHoveredGuide(null);
                    }}
                  >
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
                      </div>
                      {/* Target Guide Author, Date, & Duration under title, before description */}
                      {(targetGuide.author ||
                        targetGuide.created_at ||
                        targetGuide.duration) && (
                        <div className="mt-1 ml-7 flex flex-wrap items-center gap-2.5 text-[10px] text-muted-foreground/80">
                          {targetGuide.author && (
                            <span className="flex items-center gap-1 font-mono uppercase">
                              <User className="h-3 w-3 text-primary/70" />@
                              {targetGuide.author}
                            </span>
                          )}
                          {targetGuide.created_at && (
                            <span className="flex items-center gap-1 font-mono uppercase">
                              <Calendar className="h-3 w-3 text-primary/70" />
                              {targetGuide.created_at}
                            </span>
                          )}
                          {targetGuide.duration && (
                            <span className="flex items-center gap-1 font-mono font-medium uppercase">
                              <Clock className="h-3 w-3 text-primary/70" />
                              {targetGuide.duration}m
                            </span>
                          )}
                        </div>
                      )}
                      <p className="mt-1.5 ml-7 text-xs text-muted-foreground">
                        {targetGuide.summary}
                      </p>
                      {/* Tags below description */}
                      {targetGuide.tags.length > 0 && (
                        <div className="mt-2 ml-7 flex flex-wrap gap-1">
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

                    {/* Right controls column: Swap Variant (bottom-right) */}
                    <div className="flex shrink-0 flex-col items-center justify-end self-stretch">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled
                        className="h-8 w-8 cursor-not-allowed border-none p-0 text-muted-foreground/40 hover:bg-transparent"
                        title="Variants Coming Soon"
                      >
                        <Replace className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right Pane: Generated Walkthrough by Level */}
          <Card
            className={`h-full max-h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-muted/10 shadow-none ${
              mobileTab === "graph" ? "flex" : "hidden lg:flex"
            } ${isFullscreen ? "lg:col-span-8" : "lg:col-span-7"}`}
          >
            <CardHeader className="border-b pb-4">
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Workflow className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-semibold text-foreground">
                    Prerequisite Guides
                  </CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-mr-2 flex items-center gap-2"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                >
                  {isFullscreen ? (
                    <Minimize className="h-4 w-4" />
                  ) : (
                    <Maximize className="h-4 w-4" />
                  )}
                  {isFullscreen ? "Exit" : "Expand"}
                </Button>
              </div>
              <CardDescription>
                Select guides from the target's computed prerequisite DAG to
                include in your curation.
              </CardDescription>
            </CardHeader>
            <CardContent className="relative min-h-0 flex-1 overflow-hidden p-0">
              <GuideGraph
                walkthroughNodes={walkthroughNodes}
                curatedSequence={curatedSequence}
                targetSlug={targetSlug}
                onToggleGuide={handleToggleGuide}
                guidesMap={guidesMap}
                hoveredGuide={hoveredGuide}
                onHoverGuide={setHoveredGuide}
              />
            </CardContent>
          </Card>
        </div>
      </FieldGroup>
    </Stepper.Content>
  );
};
