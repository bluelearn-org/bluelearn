import { useState } from "react";
import {
  Link,
  createFileRoute,
  notFound,
  useLocation,
} from "@tanstack/react-router";
import {
  ArrowBigDown,
  ArrowBigUp,
  Ellipsis,
  History,
  House,
  Pencil,
  Plus,
  Replace,
  Target,
  Users,
} from "lucide-react";

import type { Action } from "@/components/sidebar/GuideSidebar";
import type { ComboboxItem } from "@/components/ui/combobox";

import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

import { buildBreadcrumbs } from "@/lib/breadcrumbs";
import { getGuide, getVariantId } from "@/lib/api/guides";

import "katex/dist/katex.min.css";
import { GuideSidebar } from "@/components/sidebar/GuideSidebar";
import { GuideReader } from "@/components/GuideReader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Route as GuideWalkthroughRoute } from "@/routes/guides/$slug/walkthrough";
import { getAuthToken } from "@/lib/auth";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Combobox } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";

import { VariantsModal } from "@/components/guides/modals/VariantsModal";
import { ObjectivesModal } from "@/components/guides/modals/ObjectivesModal";
import { ContributorsModal } from "@/components/guides/modals/ContributorsModal";
import { RevisionsModal } from "@/components/guides/modals/RevisionsModal";

type ModalType =
  | "variants"
  | "objectives"
  | "contributors"
  | "revisions"
  | null;

type SidebarActionItem = {
  icon: typeof Replace;
  label: string;
  type: NonNullable<ModalType>;
};

const SIDEBAR_ACTIONS: Array<SidebarActionItem> = [
  { icon: Replace, label: "View Variants", type: "variants" },
  { icon: Target, label: "View Objectives", type: "objectives" },
  { icon: Users, label: "View Contributors", type: "contributors" },
  { icon: History, label: "View Revisions", type: "revisions" },
];

function useVote(slug: string) {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const thisSlug = slug;

  const toggleVote = (type: "up" | "down") => {
    const next = vote === type ? null : type;
    setVote(next);
    return next;
  };

  const submitVote = async (
    type: "up" | "down" | null,
    reason: string | null = null,
    note: string | null = null
  ) => {
    const prev = vote;

    const token = await getAuthToken();
    if (!token) {
      console.error("Unauthorized");
      setVote(prev); // revert on auth failure
      return;
    }

    const variantId = await getVariantId(thisSlug);
    const api = import.meta.env.VITE_API_BASE;
    const votingApi = `${api}/variants/${variantId}/vote`;

    const method = type === null ? "DELETE" : "PUT";
    const direction = type === null ? undefined : type;

    const response = await fetch(votingApi, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        direction,
        reason,
        note,
      }),
    });

    if (!response.ok) {
      console.error("Vote request failed:", response.status);
      setVote(prev); // revert on submission failure
    }
  };

  return {
    vote,
    upvote: async () => {
      const next = toggleVote("up");
      await submitVote(next);
    },
    downvote: () => toggleVote("down"),
    submitDownvote: async (reason: string, note: string) => {
      await submitVote("down", reason, note);
    },
    nullVote: async () => {
      setVote(null);
      await submitVote(null);
    },
    setVote,
  };
}

function DownvoteDialog({ isOpen, setIsOpen, setVote }) {
  const reasons: Array<ComboboxItem> = [
    {
      value: "unclear",
      label: "Unclear",
      description: "Explanation is confusing or hard to follow",
    },
    {
      value: "factually_wrong",
      label: "Factually Wrong",
      description: "Information contradicts verified information",
    },
    {
      value: "missing_step",
      label: "Missing Step",
      description: "A necessary action or concept is skipped",
    },
    {
      value: "outdated",
      label: "Outdated",
      description: "Information is no longer accurate or current",
    },
    {
      value: "broken_link",
      label: "Broken Link",
      description: "Referenced links are inaccessible",
    },
    {
      value: "prereq_gap",
      label: "Prerequisite Gap",
      description: "Assumes knowledge not covered in listed prerequisites",
    },
    {
      value: "wrong_level",
      label: "Wrong Level",
      description: "Difficulty does not match the stated proficiency level",
    },
    {
      value: "scope_creep",
      label: "Scope Creep",
      description: "Includes unnecessary details beyond the main topic",
    },
  ];

  const [selectedReason, setSelectedReason] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const { slug } = Route.useParams();
  const { vote, submitDownvote } = useVote(slug);

  const handleVoteSubmit = async (reason: string, note: string) => {
    await submitDownvote(reason, note);
  };

  const handleDialogClose = () => {
    setIsOpen(false);

    // Do not erase downvote if user has already downvoted
    setVote(null);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleDialogClose();
        } else setIsOpen(open);
      }}
    >
      <DialogContent>
        <DialogTitle>Downvote</DialogTitle>
        <DialogDescription className="sr-only">
          Dialog to submit reasoning for downvote
        </DialogDescription>

        <DialogHeader>Reason</DialogHeader>
        <Combobox
          items={reasons}
          value={selectedReason}
          onValueChange={(selectedReason) => setSelectedReason(selectedReason)}
        />

        <DialogHeader>Note</DialogHeader>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="State your reason here."
        />

        <Button
          variant="default"
          size="lg"
          onClick={async () => {
            await handleVoteSubmit(selectedReason, note);
            setIsOpen(false);
          }}
        >
          Submit
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export const Route = createFileRoute("/guides/$slug/")({
  validateSearch: (search: Record<string, unknown>): { variant?: string } => ({
    variant:
      typeof search.variant === "string" && search.variant.length > 0
        ? search.variant
        : undefined,
  }),
  loaderDeps: ({ search }) => ({ variant: search.variant }),
  loader: async ({ params, deps, abortController }) => {
    try {
      return await getGuide(params.slug, {
        variant: deps.variant,
        signal: abortController.signal,
      });
    } catch {
      throw notFound();
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { slug } = Route.useParams();
  const guide = Route.useLoaderData();

  const { vote, setVote, upvote, downvote } = useVote(slug);
  const [activeModal, setActiveModal] = useState<ModalType>(null);


  const breadcrumbOrigin = useLocation({
    select: (location) => location.state.breadcrumbOrigin,
  });

  const guideMenuItems = [
    {
      label: "Edit Guide",
      to: `/guides/${slug}/${guide.variant_slug}/edit`,
      icon: <Pencil className="h-4 w-4" />,
    },
    {
      label: "Create Variant",
      to: "/contribute",
      icon: <Plus className="h-4 w-4" />,
    },
    // { label: "Report", to: "/report", <Flag className="h-4 w-4" /> },// TODO: Implement post v1
  ];

  const breadcrumbs = buildBreadcrumbs(guide.title, breadcrumbOrigin);

  // Downvote dialog
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <div className="mx-auto h-[calc(100vh-70px)] max-w-7xl border-x bg-background">
      <section className="grid grid-cols-[320px_1fr] border-b">
        <GuideSidebar
          sidebarActions={
            <div className="flex items-center justify-start gap-4">
              {SIDEBAR_ACTIONS.map((action: SidebarActionItem) => (
                <Tooltip key={action.label}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setActiveModal(action.type)}
                      aria-label={action.label}
                    >
                      <action.icon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>

                  <TooltipContent>
                    <p>{action.label}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          }
          guide={guide}
          slug={slug}
        />

        {/* MAIN */}
        <main className="h-[calc(100vh-70px)] min-w-0 overflow-y-auto px-10 py-4 lg:px-16">
          {/* Breadcrumbs */}
          <div className="mb-6 flex items-center justify-between gap-4">
            <ul className="flex min-w-0 flex-nowrap items-center gap-2 text-xs tracking-[0.08em] text-muted-foreground uppercase">
              {breadcrumbs.map((crumb, idx) => (
                <li
                  key={`${crumb.label}-${idx}`}
                  className="mono-micro flex min-w-0 items-center gap-2"
                >
                  {crumb.path ? (
                    <Link
                      to={crumb.path}
                      className="flex min-w-0 items-center hover:text-foreground"
                      aria-label={crumb.label}
                    >
                      {idx === 0 ? (
                        <House className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <span className="max-w-[30ch] truncate">
                          {crumb.label}
                        </span>
                      )}
                    </Link>
                  ) : (
                    <span className="max-w-[30ch] truncate">{crumb.label}</span>
                  )}
                  {idx < breadcrumbs.length - 1 && (
                    <span className="shrink-0">/</span>
                  )}
                </li>
              ))}
            </ul>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-2">
              <Link
                to={GuideWalkthroughRoute.to}
                params={{ slug: slug }}
                state={{ breadcrumbOrigin }}
                className="btn-outline"
              >
                View Walkthrough
              </Link>

              <Button variant="outline" size="lg" onClick={() => upvote()}>
                <ArrowBigUp
                  className="h-4 w-4"
                  color={vote == "up" ? "#3D80DD" : "#000000"}
                  fill={vote == "up" ? "#3D80DD" : "#FFFFFF"}
                />
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  downvote();
                  setIsOpen(true);
                }}
              >
                <ArrowBigDown
                  className="h-4 w-4"
                  color={vote == "down" ? "#3D80DD" : "#000000"}
                  fill={vote == "down" ? "#3D80DD" : "#FFFFFF"}
                />
              </Button>
              <DownvoteDialog
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                setVote={setVote}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-md"
                  >
                    <Ellipsis className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-48 font-mono">
                  {guideMenuItems.map((item) => (
                    <DropdownMenuItem key={item.to} asChild>
                      <Link to={item.to} className="text-xs">
                        {item.icon}
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <Separator className="mb-8" />

          {/* Header */}

          <GuideReader guide={guide} />
        </main>
      </section>

      {/* Action Modals */}
      <VariantsModal
        open={activeModal === "variants"}
        onOpenChange={(open) => !open && setActiveModal(null)}
        slug={slug}
        currentVariantSlug={guide.variant_slug}
      />

      <ObjectivesModal
        open={activeModal === "objectives"}
        onOpenChange={(open) => !open && setActiveModal(null)}
        slug={slug}
      />

      <ContributorsModal
        open={activeModal === "contributors"}
        onOpenChange={(open) => !open && setActiveModal(null)}
        slug={slug}
      />

      <RevisionsModal
        open={activeModal === "revisions"}
        onOpenChange={(open) => !open && setActiveModal(null)}
        slug={slug}
      />
    </div>
  );
}
