import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type {
  CreateReviewReplyInput,
  CreateReviewSuggestionInput,
  CreateReviewThreadInput,
  DecideReviewSuggestionInput,
  ReviewParticipant,
} from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { diffField } from "../lib/diff";
import { ServiceError } from "../lib/service-error";

type DB = SupabaseClient<Database>;
type Tables = Database["public"]["Tables"];
type ReplyRow = Tables["review_thread_replies"]["Row"];
type ThreadRow = Tables["review_threads"]["Row"] & {
  review_thread_replies: ReplyRow[];
};
type SuggestionRow = Tables["review_suggestions"]["Row"];
type CaseStatus = Database["public"]["Enums"]["case_status"];
type SeatStatus = Database["public"]["Enums"]["seat_status"];
type People = Map<string, ReviewParticipant>;

type Seat = {
  panel_id: string;
  member_id: string | null;
  status: SeatStatus;
  expires_at: string | null;
};

// The case as feedback sees it: who may read or write, and the exact revision
// text every anchor is checked against.
type CaseContext = {
  id: string;
  status: CaseStatus;
  revisionId: string | null;
  authorId: string | null;
  body: string | null;
  openPanelId: string | null;
  seats: Seat[];
};

type CaseContextRow = {
  id: string;
  status: CaseStatus;
  review_panels: Array<{
    id: string;
    closed_at: string | null;
    panel_members: Array<Omit<Seat, "panel_id">>;
  }>;
  guide_review_cases: {
    guide_revisions: {
      id: string;
      author_id: string | null;
      body: string | null;
    } | null;
  } | null;
};

const THREAD_COLUMNS = "*, review_thread_replies(*)";

// Errors the review feedback functions raise on purpose; their messages are
// written for the caller.
const RAISED_STATUS: Record<string, ContentfulStatusCode> = {
  P0002: 404,
  "42501": 403,
  "55000": 409,
  "22000": 422,
};

function rpcFailure(error: PostgrestError, fallback: string) {
  const status = RAISED_STATUS[error.code];
  if (status) return new ServiceError(error.message, status);
  console.error(error);
  return new ServiceError(fallback, 500);
}

// The feedback tables have no client policies, so reads here use the service
// role. getReviewAnnotations applies the case's visibility rule first.
async function loadCaseContext(
  service: DB,
  caseId: string
): Promise<CaseContext> {
  const { data, error } = await service
    .from("review_cases")
    .select(
      `id, status,
       review_panels(id, closed_at, panel_members(member_id, status, expires_at)),
       guide_review_cases(guide_revisions(id, author_id, body))`
    )
    .eq("id", caseId)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load review case", 500);
  }
  if (!data) throw new ServiceError("Review case not found", 404);

  const row = data as unknown as CaseContextRow;
  const revision = row.guide_review_cases?.guide_revisions ?? null;
  const openPanel = row.review_panels.find((p) => p.closed_at === null);
  return {
    id: row.id,
    status: row.status,
    revisionId: revision?.id ?? null,
    authorId: revision?.author_id ?? null,
    body: revision?.body ?? null,
    openPanelId: openPanel?.id ?? null,
    seats: row.review_panels.flatMap((p) =>
      p.panel_members.map((pm) => ({ ...pm, panel_id: p.id }))
    ),
  };
}

// Mirrors has_live_review_seat, which enforces the same rule on every write.
function isLiveSeat(seat: Seat) {
  if (seat.status === "completed") return true;
  return (
    seat.status === "assigned" &&
    (seat.expires_at === null || Date.now() <= Date.parse(seat.expires_at))
  );
}

function viewerOf(context: CaseContext, viewerId: string | null) {
  const seats =
    viewerId === null
      ? []
      : context.seats.filter((s) => s.member_id === viewerId);
  const isAuthor = viewerId !== null && context.authorId === viewerId;
  const isPanelist = seats.length > 0;
  return {
    role: isPanelist ? "panelist" : isAuthor ? "author" : "public",
    isAuthor,
    hasLiveSeat: seats.some(
      (s) => s.panel_id === context.openPanelId && isLiveSeat(s)
    ),
  } as const;
}

async function isSuspended(service: DB, userId: string) {
  const { data, error } = await service
    .from("profiles")
    .select("is_suspended")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Unable to verify account status", 500);
  }
  return data?.is_suspended ?? true;
}

async function permissionsFor(
  service: DB,
  context: CaseContext,
  viewerId: string | null
) {
  const viewer = viewerOf(context, viewerId);
  const open = context.status === "in_review" && context.openPanelId !== null;
  const active =
    open && viewerId !== null && !(await isSuspended(service, viewerId));

  return {
    can_comment: active && viewer.hasLiveSeat,
    can_reply: active && (viewer.hasLiveSeat || viewer.isAuthor),
    can_suggest: active && viewer.hasLiveSeat,
    can_decide_suggestions: active && viewer.isAuthor,
  };
}

async function loadPeople(
  service: DB,
  context: CaseContext,
  ids: Array<string | null>
): Promise<People> {
  const people: People = new Map();
  const unique = [...new Set(ids.filter((id): id is string => id !== null))];
  if (unique.length === 0) return people;

  const { data, error } = await service
    .from("profiles")
    .select("id, username, display_name")
    .in("id", unique);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load review participants", 500);
  }
  for (const p of data ?? []) {
    people.set(p.id, {
      ...p,
      role: p.id === context.authorId ? "author" : "panelist",
    });
  }
  return people;
}

// Feedback is pinned to one revision. When its stored slice no longer matches
// that text, the reader lists it instead of guessing a new place for it.
function anchorStatus(
  context: CaseContext,
  row: {
    revision_id: string;
    source_start: number | null;
    source_end: number | null;
    source_text: string | null;
  }
) {
  if (row.revision_id !== context.revisionId || context.body === null)
    return "outdated";
  if (row.source_start === null || row.source_end === null) return "current";
  const slice = context.body.slice(row.source_start, row.source_end);
  return slice === row.source_text ? "current" : "outdated";
}

function toReply(row: ReplyRow, people: People) {
  return {
    id: row.id,
    author: row.author_id ? (people.get(row.author_id) ?? null) : null,
    body: row.body,
    created_at: row.created_at,
  };
}

function toThread(row: ThreadRow, context: CaseContext, people: People) {
  return {
    id: row.id,
    revision_id: row.revision_id,
    anchor: {
      kind: row.anchor_kind,
      start_block: row.start_block,
      start_offset: row.start_offset,
      end_block: row.end_block,
      end_offset: row.end_offset,
      quote: row.quote,
      source_start: row.source_start,
      source_end: row.source_end,
      source_text: row.source_text,
    },
    anchor_status: anchorStatus(context, row),
    author: row.author_id ? (people.get(row.author_id) ?? null) : null,
    body: row.body,
    created_at: row.created_at,
    replies: [...row.review_thread_replies]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((reply) => toReply(reply, people)),
  };
}

function toSuggestion(
  row: SuggestionRow,
  context: CaseContext,
  people: People
) {
  return {
    id: row.id,
    revision_id: row.revision_id,
    anchor: {
      kind: "block" as const,
      start_block: row.block_index,
      start_offset: 0,
      end_block: row.block_index,
      end_offset: row.block_length,
      quote: row.quote,
      source_start: row.source_start,
      source_end: row.source_end,
      source_text: row.source_text,
    },
    anchor_status: anchorStatus(context, row),
    author: row.author_id ? (people.get(row.author_id) ?? null) : null,
    note: row.note,
    original: row.source_text,
    proposed: row.proposed,
    diff: diffField(row.source_text, row.proposed),
    status: row.status,
    decided_by: row.decided_by ? (people.get(row.decided_by) ?? null) : null,
    decided_at: row.decided_at,
    applied_revision_id: row.applied_revision_id,
    created_at: row.created_at,
  };
}

function publicationOf(context: CaseContext, suggestions: SuggestionRow[]) {
  const count = (status: SuggestionRow["status"]) =>
    suggestions.filter((s) => s.status === status).length;
  const applied = suggestions.find((s) => s.applied_revision_id !== null);
  return {
    pending_suggestions: count("pending"),
    accepted_suggestions: count("accepted"),
    awaiting_author: context.status === "in_review" && count("pending") > 0,
    published_revision_id: applied?.applied_revision_id ?? null,
  };
}

async function loadSuggestions(service: DB, caseId: string) {
  const { data, error } = await service
    .from("review_suggestions")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at");

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load suggested edits", 500);
  }
  return data ?? [];
}

// Same visibility as getReviewCase: an open case shows only to its author and
// panel, a closed one to everyone.
export async function getReviewAnnotations(
  service: DB,
  caseId: string,
  viewerId: string | null
) {
  const context = await loadCaseContext(service, caseId);
  const viewer = viewerOf(context, viewerId);
  const closed = context.status === "approved" || context.status === "rejected";
  if (viewer.role === "public" && !closed)
    throw new ServiceError("You cannot view this review case", 403);

  const [threadsRes, suggestions, permissions] = await Promise.all([
    service
      .from("review_threads")
      .select(THREAD_COLUMNS)
      .eq("case_id", caseId)
      .order("created_at"),
    loadSuggestions(service, caseId),
    permissionsFor(service, context, viewerId),
  ]);

  if (threadsRes.error) {
    console.error(threadsRes.error);
    throw new ServiceError("Failed to load review comments", 500);
  }
  const threads = (threadsRes.data ?? []) as ThreadRow[];
  const people = await loadPeople(service, context, [
    ...threads.flatMap((t) => [
      t.author_id,
      ...t.review_thread_replies.map((r) => r.author_id),
    ]),
    ...suggestions.flatMap((s) => [s.author_id, s.decided_by]),
  ]);

  return {
    case_id: context.id,
    case_status: context.status,
    revision_id: context.revisionId,
    viewer_role: viewer.role,
    permissions,
    publication: publicationOf(context, suggestions),
    threads: threads.map((t) => toThread(t, context, people)),
    suggestions: suggestions.map((s) => toSuggestion(s, context, people)),
  };
}

// Writes run on the caller's own client: the database functions check the
// seat, the author, the revision, and the anchor under the panel lock.
export async function createReviewThread(
  supabase: DB,
  service: DB,
  caseId: string,
  { anchor, body }: CreateReviewThreadInput
) {
  const { data: id, error } = await supabase.rpc("create_review_thread", {
    p_case_id: caseId,
    p_revision_id: anchor.revision_id,
    p_anchor_kind: anchor.kind,
    p_start_block: anchor.start_block,
    p_start_offset: anchor.start_offset,
    p_end_block: anchor.end_block,
    p_end_offset: anchor.end_offset,
    p_quote: anchor.quote,
    p_body: body,
    p_source_start: anchor.source_start ?? undefined,
    p_source_end: anchor.source_end ?? undefined,
  });
  if (error) throw rpcFailure(error, "Failed to add comment");

  const { data: row, error: rowError } = await service
    .from("review_threads")
    .select(THREAD_COLUMNS)
    .eq("id", id)
    .single();
  if (rowError) {
    console.error(rowError);
    throw new ServiceError("Failed to load comment", 500);
  }

  const context = await loadCaseContext(service, caseId);
  const people = await loadPeople(service, context, [row.author_id]);
  return toThread(row as ThreadRow, context, people);
}

export async function replyToReviewThread(
  supabase: DB,
  service: DB,
  caseId: string,
  threadId: string,
  { body }: CreateReviewReplyInput
) {
  const { data: id, error } = await supabase.rpc("reply_review_thread", {
    p_case_id: caseId,
    p_thread_id: threadId,
    p_body: body,
  });
  if (error) throw rpcFailure(error, "Failed to add reply");

  const { data: row, error: rowError } = await service
    .from("review_thread_replies")
    .select("*")
    .eq("id", id)
    .single();
  if (rowError) {
    console.error(rowError);
    throw new ServiceError("Failed to load reply", 500);
  }

  const context = await loadCaseContext(service, caseId);
  const people = await loadPeople(service, context, [row.author_id]);
  return toReply(row, people);
}

export async function createReviewSuggestion(
  supabase: DB,
  service: DB,
  caseId: string,
  { anchor, proposed, note }: CreateReviewSuggestionInput
) {
  const { data: id, error } = await supabase.rpc("create_review_suggestion", {
    p_case_id: caseId,
    p_revision_id: anchor.revision_id,
    p_block_index: anchor.start_block,
    p_block_length: anchor.end_offset,
    p_quote: anchor.quote,
    p_source_start: anchor.source_start,
    p_source_end: anchor.source_end,
    p_proposed: proposed,
    p_note: note ?? undefined,
  });
  if (error) throw rpcFailure(error, "Failed to suggest edit");

  const context = await loadCaseContext(service, caseId);
  const suggestion = (await loadSuggestions(service, caseId)).find(
    (s) => s.id === id
  );
  if (!suggestion) throw new ServiceError("Failed to load suggested edit", 500);

  const people = await loadPeople(service, context, [suggestion.author_id]);
  return toSuggestion(suggestion, context, people);
}

// The author's answer. Answering the last pending edit may publish the guide
// inside the same database call, so the case status comes back fresh.
export async function decideReviewSuggestion(
  supabase: DB,
  service: DB,
  caseId: string,
  suggestionId: string,
  { decision }: DecideReviewSuggestionInput
) {
  const { error } = await supabase.rpc("decide_review_suggestion", {
    p_case_id: caseId,
    p_suggestion_id: suggestionId,
    p_decision: decision,
  });
  if (error) throw rpcFailure(error, "Failed to record your answer");

  const context = await loadCaseContext(service, caseId);
  const suggestions = await loadSuggestions(service, caseId);
  const suggestion = suggestions.find((s) => s.id === suggestionId);
  if (!suggestion) throw new ServiceError("Failed to load suggested edit", 500);

  const people = await loadPeople(service, context, [
    suggestion.author_id,
    suggestion.decided_by,
  ]);
  return {
    suggestion: toSuggestion(suggestion, context, people),
    case_status: context.status,
    publication: publicationOf(context, suggestions),
  };
}
