import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ProfileActivitySearch } from "@bluelearn/schemas";
import type { ProfilePageData } from "@/lib/profile";
import {
  ACTIVITY_STATUS_FILTERS,
  ACTIVITY_TYPE_FILTERS,
  activityStatusLabel,
  activityTypeLabel,
  filterActivity,
  getActivitySubjectOptions,
} from "@/lib/profile";
import { formatDate } from "@/lib/guideUtils";
import { cn } from "@/lib/utils";
import { usePagination } from "@/lib/usePagination";
import { Pagination } from "@/components/Pagination";
import {
  ChoiceColumnFilter,
  DateColumnFilter,
  TextColumnFilter,
} from "@/components/tables/ActivityColumnFilters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteMyDrafts } from "@/lib/api/identity";
import { clearStoredDraftsForRevisions } from "@/lib/contributionStorage";

const PAGE_SIZE = 10;

type ActivityRow = ProfilePageData["activity"][number];

const draftKey = (row: ActivityRow) => `${row.content_kind}:${row.revision_id}`;
const isDraft = (row: ActivityRow) =>
  row.status === "draft" && row.content_kind !== "review" && !!row.revision_id;

function rowTarget(row: ActivityRow) {
  if (row.content_kind === "review")
    return row.base_slug
      ? { to: "/guides/$slug", params: { slug: row.base_slug } }
      : null;
  if (
    row.content_kind === "guide" &&
    row.status === "published" &&
    row.base_slug
  )
    return { to: "/guides/$slug", params: { slug: row.base_slug } };
  // A draft on a guide that is already published is an edit, not a new guide.
  if (
    row.content_kind === "guide" &&
    row.status === "draft" &&
    row.revision_id &&
    row.base_slug &&
    row.target_slug
  )
    return {
      to: "/guides/$slug/$variantSlug/edit",
      params: { slug: row.base_slug, variantSlug: row.target_slug },
      search: { draft: row.revision_id },
    };
  if (row.content_kind === "guide" && row.status === "draft" && row.revision_id)
    return { to: "/contribute", search: { draft: row.revision_id } };
  if (
    row.content_kind === "objective" &&
    row.status === "published" &&
    row.target_slug
  )
    return { to: "/objectives/$slug", params: { slug: row.target_slug } };
  if (
    row.content_kind === "objective" &&
    row.status === "draft" &&
    row.revision_id
  )
    return {
      to: "/contribute",
      search: { draft: row.revision_id, kind: "objective" as const },
    };
  return null;
}

type ActivityTableProps = {
  activity: Array<ActivityRow>;
  search: ProfileActivitySearch;
  setFilters: (next: Partial<ProfileActivitySearch>) => void;
  onPageChange: (page: number) => void;
  canDeleteDrafts?: boolean;
  onDeleted?: () => Promise<void>;
};

export function ActivityTable({
  activity,
  search,
  setFilters,
  onPageChange,
  canDeleteDrafts = false,
  onDeleted,
}: ActivityTableProps) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(new Set());
  }, [search]);

  const filtered = filterActivity(activity, search).filter(
    (row) => !deleted.has(draftKey(row))
  );
  const hasFilters = Boolean(
    search.type?.length ||
    search.status?.length ||
    search.subject?.length ||
    search.title ||
    search.summary ||
    search.from ||
    search.to
  );

  const {
    page,
    totalPages,
    pageRows,
    start,
    goToPage,
    toFirst,
    onPrevious,
    onNext,
    toLast,
  } = usePagination(filtered, PAGE_SIZE, {
    page: search.page ?? 1,
    onPageChange,
  });

  const emptyMessage = hasFilters
    ? "No activity matches these filters."
    : "No activity available yet.";

  // Derive subject options from the full activity (before filtering) so all
  // available subject choices are always visible, even when other filters are active.
  const subjectOptions = getActivitySubjectOptions(activity);

  const selectedDrafts = canDeleteDrafts
    ? pageRows.filter((row) => isDraft(row) && selected.has(draftKey(row)))
    : [];

  function draftCheckbox(row: ActivityRow) {
    if (!canDeleteDrafts || !isDraft(row)) return null;
    const key = draftKey(row);
    return (
      <Checkbox
        aria-label={`Select draft: ${row.title}`}
        checked={selected.has(key)}
        disabled={deleting}
        onClick={(event) => event.stopPropagation()}
        onCheckedChange={(checked) =>
          setSelected((prev) => {
            const next = new Set(prev);
            if (checked === true) next.add(key);
            else next.delete(key);
            return next;
          })
        }
      />
    );
  }

  async function handleDelete() {
    if (deleting || selectedDrafts.length === 0) return;
    const input = {
      guide_revision_ids: selectedDrafts
        .filter((row) => row.content_kind === "guide")
        .map((row) => row.revision_id!),
      objective_revision_ids: selectedDrafts
        .filter((row) => row.content_kind === "objective")
        .map((row) => row.revision_id!),
    };
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteMyDrafts(input);
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Unable to delete drafts. Please try again."
      );
      setDeleting(false);
      return;
    }
    clearStoredDraftsForRevisions(input);
    setDeleted((prev) => new Set([...prev, ...selectedDrafts.map(draftKey)]));
    setSelected(new Set());
    setConfirmOpen(false);
    toast.success(
      selectedDrafts.length === 1
        ? "Draft deleted"
        : `${selectedDrafts.length} drafts deleted`
    );
    try {
      await onDeleted?.();
    } catch {
      toast.error(
        "Drafts were deleted, but your profile couldn't refresh. Please reload the page."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="mx-auto mb-5 flex max-w-5xl items-center justify-between gap-4">
        <h2 className="editorial-heading text-xl">Contributions</h2>
        {canDeleteDrafts && (
          <Button
            variant="destructive"
            disabled={deleting || selectedDrafts.length === 0}
            onClick={() => {
              setDeleteError(null);
              setConfirmOpen(true);
            }}
          >
            <Trash2 aria-hidden="true" />
            Delete drafts
            {selectedDrafts.length > 0 ? ` (${selectedDrafts.length})` : ""}
          </Button>
        )}
      </div>
      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!deleting) setConfirmOpen(open);
        }}
      >
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>
              Delete{" "}
              {selectedDrafts.length === 1
                ? "this draft"
                : `these ${selectedDrafts.length} drafts`}
              ?
            </DialogTitle>
            <DialogDescription>
              This permanently deletes the selected drafts and their saved
              copies in this browser. You can't undo this.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-48 list-disc overflow-y-auto pl-5">
            {selectedDrafts.map((row) => (
              <li key={draftKey(row)} className="break-words">
                {row.title}
              </li>
            ))}
          </ul>
          {deleteError && (
            <p role="alert" className="text-destructive">
              {deleteError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting || selectedDrafts.length === 0}
              onClick={handleDelete}
            >
              {deleting ? "Deleting..." : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="md:hidden">
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 font-mono text-[13px] font-bold tracking-[0.08em] uppercase">
          <ChoiceColumnFilter
            label="Type"
            field="type"
            options={ACTIVITY_TYPE_FILTERS}
            search={search}
            setFilters={setFilters}
          />
          <TextColumnFilter
            label="Title"
            field="title"
            search={search}
            setFilters={setFilters}
          />
          <TextColumnFilter
            label="Summary"
            field="summary"
            search={search}
            setFilters={setFilters}
          />
          <DateColumnFilter search={search} setFilters={setFilters} />
          <ChoiceColumnFilter
            label="Status"
            field="status"
            options={ACTIVITY_STATUS_FILTERS}
            search={search}
            setFilters={setFilters}
          />
          {subjectOptions.length > 0 && (
            <ChoiceColumnFilter
              label="Subject"
              field="subject"
              options={subjectOptions}
              search={search}
              setFilters={setFilters}
            />
          )}
        </div>

        {pageRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pageRows.map((row, index) => {
              const target = rowTarget(row);
              return (
                <li
                  key={`${row.content_kind}-${start + index}`}
                  className={cn(
                    "flex flex-col gap-2 rounded-md border p-4",
                    target && "cursor-pointer"
                  )}
                  onClick={target ? () => navigate(target) : undefined}
                >
                  <div className="flex items-start justify-between gap-3">
                    {draftCheckbox(row)}
                    <span className="data-label">{activityTypeLabel(row)}</span>
                    <Badge
                      variant="outline"
                      className="mono-micro shrink-0 rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                    >
                      {activityStatusLabel(row.status)}
                    </Badge>
                  </div>

                  <p className="text-sm font-bold">{row.title}</p>

                  {row.change_summary && (
                    <p className="text-sm text-muted-foreground">
                      {row.change_summary}
                    </p>
                  )}

                  {row.subjects.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {row.subjects.map((s) => (
                        <Badge
                          key={s.slug}
                          variant="outline"
                          className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                        >
                          {s.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3">
                    <span className="mono-micro text-muted-foreground">
                      {formatDate(new Date(row.created_at))}
                    </span>

                    {row.review_case_id && (
                      <Button
                        className="btn-pri h-8 shrink-0 px-3 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate({
                            to: "/review/$caseId",
                            params: { caseId: row.review_case_id! },
                          });
                        }}
                      >
                        View case
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <Table className="mx-auto w-full max-w-5xl">
          <TableHeader>
            <TableRow>
              {canDeleteDrafts && (
                <TableHead className="w-12 px-4">
                  <span className="sr-only">Select drafts</span>
                </TableHead>
              )}
              <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
                <ChoiceColumnFilter
                  label="Type"
                  field="type"
                  options={ACTIVITY_TYPE_FILTERS}
                  search={search}
                  setFilters={setFilters}
                />
              </TableHead>
              <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
                <TextColumnFilter
                  label="Title"
                  field="title"
                  search={search}
                  setFilters={setFilters}
                />
              </TableHead>
              <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
                <TextColumnFilter
                  label="Change Summary"
                  field="summary"
                  search={search}
                  setFilters={setFilters}
                />
              </TableHead>
              <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
                <DateColumnFilter search={search} setFilters={setFilters} />
              </TableHead>
              <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
                <ChoiceColumnFilter
                  label="Status"
                  field="status"
                  options={ACTIVITY_STATUS_FILTERS}
                  search={search}
                  setFilters={setFilters}
                />
              </TableHead>
              <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
                {subjectOptions.length > 0 ? (
                  <ChoiceColumnFilter
                    label="Subject"
                    field="subject"
                    options={subjectOptions}
                    search={search}
                    setFilters={setFilters}
                  />
                ) : (
                  "Subject"
                )}
              </TableHead>
              <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
                Review Case
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canDeleteDrafts ? 8 : 7}
                  className="px-4 py-6 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row, index) => {
                const target = rowTarget(row);
                return (
                  <TableRow
                    key={`${row.content_kind}-${start + index}`}
                    className={target ? "cursor-pointer" : undefined}
                    onClick={target ? () => navigate(target) : undefined}
                  >
                    {canDeleteDrafts && (
                      <TableCell className="px-4 py-3">
                        {draftCheckbox(row)}
                      </TableCell>
                    )}
                    <TableCell className="px-4 py-3">
                      {activityTypeLabel(row)}
                    </TableCell>

                    <TableCell className="px-4 py-3">{row.title}</TableCell>

                    <TableCell className="max-w-xs px-4 py-3 break-words whitespace-pre-line">
                      {row.change_summary}
                    </TableCell>

                    <TableCell className="mono-micro px-4 py-3">
                      {formatDate(new Date(row.created_at))}
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                      >
                        {activityStatusLabel(row.status)}
                      </Badge>
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      {row.subjects.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.subjects.map((s) => (
                            <Badge
                              key={s.slug}
                              variant="outline"
                              className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                            >
                              {s.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      {row.review_case_id ? (
                        <Button
                          className="btn-pri"
                          size="lg"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate({
                              to: "/review/$caseId",
                              params: { caseId: row.review_case_id! },
                            });
                          }}
                        >
                          View case
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="mt-8">
          <Pagination
            activePageNo={page}
            onPageSelect={goToPage}
            toFirst={toFirst}
            onPrevious={onPrevious}
            onNext={onNext}
            toLast={toLast}
            totalPages={totalPages}
          />
        </div>
      )}
    </>
  );
}
