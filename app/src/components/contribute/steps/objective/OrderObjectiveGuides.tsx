import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Clock,
  Info,
  ListOrdered,
  Loader2,
  Maximize,
  Minimize,
  Replace,
  User,
  Workflow,
} from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { ObjectiveContribution } from "@/types/contributions";
import type { Walkthrough } from "@bluelearn/schemas";
import { CurationGraph } from "@/components/graph/CurationGraph";
import { getGuideWalkthrough } from "@/lib/api/guides";
import { DraggableGuideCard } from "@/components/contribute/DraggableGuideCard";
import { Badge } from "@/components/ui/badge";
import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import { formatDuration } from "@/lib/guideUtils";
import { getTargetPrerequisiteWalkthrough } from "@/lib/useGraphLayout";
import { nodeCard, prerequisiteWalkthrough } from "@/lib/objectiveGraphEdits";
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

type PropTypes = {
  Stepper: any;
  objectiveContData: ObjectiveContribution;
  setObjectiveContData: Dispatch<SetStateAction<ObjectiveContribution>>;
  onSaveDraft?: () => void;
  submitting?: boolean;
  isDirty?: boolean;
  isSynced?: boolean;
  guides: Array<any>;
};

export const OrderObjectiveGuides = ({
  Stepper,
  objectiveContData,
  setObjectiveContData,
  onSaveDraft,
  submitting,
  isDirty,
  isSynced,
  guides,
}: PropTypes) => {
  const guidesMap = useMemo(
    () => new Map(guides.map((g) => [g.slug, g])),
    [guides]
  );
  const graph = objectiveContData.graph;
  const cardOf = (nodeId: string) => nodeCard(graph, guidesMap, nodeId);

  // Everything below is keyed by node id: a target may be a request.
  const [targetNodeId, setTargetNodeId] = useState<string>(
    objectiveContData.targets[0] || ""
  );
  const [curatedSequence, setCuratedSequence] = useState<Array<string>>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredGuide, setHoveredGuide] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"sequence" | "graph">("sequence");

  const targetNode = graph.nodes.find((n) => n.id === targetNodeId);
  const targetGuide = targetNodeId ? cardOf(targetNodeId) : undefined;

  const totalDuration = useMemo(() => {
    let mins = targetGuide?.duration_minutes || 0;
    curatedSequence.forEach((nodeId) => {
      const guide = nodeCard(graph, guidesMap, nodeId);
      if (guide && guide.duration_minutes) {
        mins += guide.duration_minutes;
      }
    });
    return mins;
  }, [curatedSequence, targetGuide, graph, guidesMap]);

  const formattedDuration = useMemo(() => {
    return formatDuration(totalDuration);
  }, [totalDuration]);

  const targetGuideSlug =
    targetNode?.type === "guide" ? targetNode.guideSlug : "";
  const [fetched, setFetched] = useState<{
    slug: string;
    walkthrough: Walkthrough;
  } | null>(null);

  useEffect(() => {
    setFetched(null);
    if (!targetGuideSlug) return;

    const controller = new AbortController();
    getGuideWalkthrough(targetGuideSlug, { signal: controller.signal })
      .then((data) => {
        setFetched({
          slug: targetGuideSlug,
          walkthrough: getTargetPrerequisiteWalkthrough(data, targetGuideSlug),
        });
      })
      .catch((err) => {
        if (!controller.signal.aborted) console.error(err);
      });

    return () => controller.abort();
  }, [targetGuideSlug]);

  const walkthroughData = useMemo(() => {
    if (!targetNode) return null;
    if (targetNode.type === "guide_request")
      return prerequisiteWalkthrough(graph, targetNode.id);
    if (fetched?.slug !== targetNode.guideSlug) return null;
    return prerequisiteWalkthrough(graph, targetNode.id, fetched.walkthrough);
  }, [targetNode, graph, fetched]);

  const { directPrereqs, directDependents } = useMemo(() => {
    const prereqs = new Map<string, Set<string>>();
    const dependents = new Map<string, Set<string>>();
    if (!walkthroughData)
      return { directPrereqs: prereqs, directDependents: dependents };

    walkthroughData.edges.forEach(({ from_id: from, to_id: to }) => {
      if (!prereqs.has(to)) prereqs.set(to, new Set());
      prereqs.get(to)!.add(from);
      if (!dependents.has(from)) dependents.set(from, new Set());
      dependents.get(from)!.add(to);
    });

    return { directPrereqs: prereqs, directDependents: dependents };
  }, [walkthroughData]);

  const canPlaceAt = (seq: Array<string>, slug: string, index: number) => {
    const prereqs = directPrereqs.get(slug);
    const dependents = directDependents.get(slug);

    // Dependents can't sit above the dragged guide and prereqs can't sit below.
    return seq.every((other, i) => {
      if (i === index) return true;
      return i < index ? !dependents?.has(other) : !prereqs?.has(other);
    });
  };

  const updateSubObjective = (nodeId: string, newSeq: Array<string>) => {
    setObjectiveContData((prev) => {
      const exists = prev.subObjectives.some((s) => s.targetNodeId === nodeId);
      const updatedSubs = exists
        ? prev.subObjectives.map((s) =>
            s.targetNodeId === nodeId
              ? { ...s, curatedSequence: newSeq, selectedNodeIds: newSeq }
              : s
          )
        : [
            ...prev.subObjectives,
            {
              targetNodeId: nodeId,
              selectedNodeIds: newSeq,
              curatedSequence: newSeq,
            },
          ];
      return {
        ...prev,
        subObjectives: updatedSubs,
      };
    });
  };

  useEffect(() => {
    if (objectiveContData.targets.length > 0) {
      if (!objectiveContData.targets.includes(targetNodeId)) {
        setTargetNodeId(objectiveContData.targets[0] || "");
      }
    } else {
      setTargetNodeId("");
    }
  }, [objectiveContData.targets, targetNodeId]);

  // Reordering targets in the previous step needs new load on order guides page.
  const firstTarget = objectiveContData.targets[0] || "";
  useEffect(() => {
    setTargetNodeId(firstTarget);
  }, [firstTarget]);

  // The seed this session wrote per target. A sequence still equal to it is
  // untouched and follows the canvas: a target's prerequisites usually land on
  // the canvas after it became a target.
  const seededRef = useRef(new Map<string, string>());

  useEffect(() => {
    if (!targetNodeId) return;

    const existingSub = objectiveContData.subObjectives.find(
      (s) => s.targetNodeId === targetNodeId
    );
    const previousSeed = seededRef.current.get(targetNodeId);
    const untouched =
      existingSub &&
      JSON.stringify(existingSub.curatedSequence) === previousSeed;

    if (existingSub && (!untouched || !walkthroughData)) {
      setCuratedSequence(existingSub.curatedSequence);
      return;
    }

    if (!walkthroughData) {
      setCuratedSequence([]);
      return;
    }

    const initialPrereqs = walkthroughData.nodes
      .filter((n) => n.id !== targetNodeId)
      .sort((a, b) => a.level - b.level)
      .map((n) => n.id);
    const seed = JSON.stringify(initialPrereqs);
    seededRef.current.set(targetNodeId, seed);

    setCuratedSequence(initialPrereqs);

    setObjectiveContData((prev) => {
      const sub = prev.subObjectives.find(
        (s) => s.targetNodeId === targetNodeId
      );
      const current = sub && JSON.stringify(sub.curatedSequence);
      if (sub && (current === seed || current !== previousSeed)) return prev;

      const seeded = {
        targetNodeId,
        selectedNodeIds: initialPrereqs,
        curatedSequence: initialPrereqs,
      };
      return {
        ...prev,
        subObjectives: sub
          ? prev.subObjectives.map((s) =>
              s.targetNodeId === targetNodeId ? seeded : s
            )
          : [...prev.subObjectives, seeded],
      };
    });
  }, [targetNodeId, walkthroughData]);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const draggedIndexRef = useRef<number | null>(null);

  const blockingSlugs = useMemo(() => {
    const dragged =
      draggedIndex === null ? undefined : curatedSequence[draggedIndex];
    if (!dragged) return new Set<string>();

    return new Set([
      ...(directPrereqs.get(dragged) ?? []),
      ...(directDependents.get(dragged) ?? []),
    ]);
  }, [draggedIndex, curatedSequence, directPrereqs, directDependents]);

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
    if (!canPlaceAt(newSeq, draggedItem, index)) return;

    setCuratedSequence(newSeq);
    updateSubObjective(targetNodeId, newSeq);

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
      const dependents = directDependents.get(slug);
      const firstDependent = curatedSequence.findIndex((s) =>
        dependents?.has(s)
      );
      newSeq = [...curatedSequence];
      newSeq.splice(
        firstDependent === -1 ? newSeq.length : firstDependent,
        0,
        slug
      );
    } else {
      newSeq = curatedSequence.filter((s) => s !== slug);
    }
    setCuratedSequence(newSeq);
    updateSubObjective(targetNodeId, newSeq);
  };

  return (
    <Stepper.Content
      step="objective-ordering"
      className="flex min-h-0 w-full flex-1 flex-col"
    >
      <StepperActionHeader
        title={"Order Guides"}
        Stepper={Stepper}
        type="objective"
        onSaveDraft={onSaveDraft}
        submitting={submitting}
        isDirty={isDirty}
        isSynced={isSynced}
      />

      <FieldGroup className="mt-0 flex min-h-0 flex-1 flex-col">
        {/* Target Guide Sequence */}
        <Field className="mb-0 min-w-0 shrink-0 space-y-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
            <FieldLabel className="mono-micro">
              Target Guide Sequence
            </FieldLabel>
            <FieldDescription className="m-0 text-[11px] text-muted-foreground/75">
              Select a target guide from your sequence to curate its
              prerequisites.
            </FieldDescription>
          </div>
          <div className="flex scrollbar-thin [scrollbar-color:var(--border)_transparent] items-center gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
            {objectiveContData.targets.map((nodeId, index) => {
              const guide = cardOf(nodeId);
              if (!guide) return null;

              const isActive = nodeId === targetNodeId;

              return (
                <div key={nodeId} className="flex shrink-0 items-center gap-2">
                  {index > 0 && <div className="h-px w-4 bg-border/60" />}
                  <button
                    type="button"
                    onClick={() => setTargetNodeId(nodeId)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-muted"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                        isActive
                          ? "bg-primary text-primary-foreground"
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
          <div
            className={`relative min-h-0 w-full ${
              mobileTab === "sequence" ? "block" : "hidden lg:block"
            } ${isFullscreen ? "lg:col-span-4" : "lg:col-span-5"}`}
          >
            <Card className="flex min-h-0 w-full flex-col overflow-hidden rounded-lg border border-border bg-card/35 shadow-none backdrop-blur-sm lg:absolute lg:inset-0">
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
                  Build the sequential learning plan by ordering selected
                  guides.
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-128 min-h-0 flex-1 scrollbar-thin [scrollbar-color:var(--border)_transparent] overflow-y-auto p-4 lg:max-h-none [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
                {curatedSequence.length === 0 &&
                  walkthroughData &&
                  walkthroughData.nodes.length > 1 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                      <Info className="mb-2 h-8 w-8 text-muted-foreground opacity-50" />
                      <p className="text-sm font-medium">
                        No prerequisite guides selected.
                      </p>
                      <p className="mt-1 max-w-62.5 text-xs text-muted-foreground">
                        Select prerequisite guides from the prerequisites on the
                        right to add them to your curated sequence.
                      </p>
                    </div>
                  )}

                <div className="space-y-3">
                  {curatedSequence.map((slug, index) => {
                    const guide = cardOf(slug);
                    if (!guide) return null;

                    const isDragging = index === draggedIndex;

                    return (
                      <DraggableGuideCard
                        key={slug}
                        guide={guide}
                        index={index}
                        isDragging={isDragging}
                        isBlocking={blockingSlugs.has(slug)}
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
                        hoveredGuide === targetNodeId
                          ? "shadow-md ring-2 ring-primary/40"
                          : "hover:shadow-md hover:ring-2 hover:ring-primary/40"
                      }`}
                      onMouseEnter={() => {
                        if (draggedIndex === null)
                          setHoveredGuide(targetNodeId);
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
                          targetGuide.duration_minutes) && (
                          <div className="mt-1 ml-7 flex flex-wrap items-center gap-2.5 text-[10px] text-muted-foreground">
                            {targetGuide.author && (
                              <span className="flex items-center gap-1 font-mono uppercase">
                                <User className="h-3 w-3 text-primary/70" />@
                                {targetGuide.author}
                              </span>
                            )}
                            {targetGuide.created_at && (
                              <span className="flex items-center gap-1 font-mono uppercase">
                                <Calendar className="h-3 w-3 text-primary/70" />
                                {new Date(
                                  targetGuide.created_at
                                ).toLocaleDateString()}
                              </span>
                            )}
                            {targetGuide.duration_minutes && (
                              <span className="flex items-center gap-1 font-mono font-medium uppercase">
                                <Clock className="h-3 w-3 text-primary/70" />
                                {targetGuide.duration_minutes}min
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
                            {targetGuide.tags.map((tag: any) => (
                              <Badge
                                key={tag.slug || tag}
                                variant="outline"
                                className="mono-micro rounded-full border border-primary/20 bg-primary/5 tracking-[0.08em] text-primary"
                              >
                                {tag.name || tag}
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
          </div>

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
            <CardContent className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-0">
              {walkthroughData ? (
                <CurationGraph
                  walkthroughData={walkthroughData}
                  curatedSequence={curatedSequence}
                  targetSlug={targetNodeId}
                  onToggleGuide={handleToggleGuide}
                  hoveredGuide={hoveredGuide}
                  onHoverGuide={setHoveredGuide}
                  isFullscreen={isFullscreen}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="text-sm">Computing graph...</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </FieldGroup>
    </Stepper.Content>
  );
};
