// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  getNearestEditorFromDOMNode,
} from "lexical";

import type { ReaderGuide } from "@/components/GuideReader";
import { GuideReader } from "@/components/GuideReader";
import { AnnotatedBlock } from "@/components/review/AnnotatedBlock";
import { AnnotatedGuide } from "@/components/review/AnnotatedGuide";
import { PublicationGateNotice } from "@/components/review/PublicationGateNotice";
import { ReviewAnnotationsProvider } from "@/components/review/ReviewAnnotations";

const REVISION = "rev-1";
const NOW = "2026-10-18T10:00:00Z";
const RIGID = "The cell wall is rigid.";
const STIFF = "The cell wall is stiff.";
const BODY = [
  "Cells make **energy** in mitochondria.",
  "",
  RIGID,
  "",
  RIGID,
].join("\n");

const VERIFIER = {
  id: "u-verifier",
  username: "verifier1",
  display_name: "Vera Verifier",
  role: "panelist",
};
const AUTHOR = {
  id: "u-author",
  username: "seed",
  display_name: null,
  role: "author",
};

type ReviewServer = {
  threads: Array<Record<string, any>>;
  suggestions: Array<Record<string, any>>;
  viewer: "author" | "panelist" | "public";
  permissions: {
    can_comment: boolean;
    can_reply: boolean;
    can_suggest: boolean;
    can_decide_suggestions: boolean;
  };
  failedLoads: number;
  writeErrors: Array<string>;
  suspension: string;
  ids: number;
  received: Array<Record<string, any>>;
};

// An in-memory stand-in for the reviews API: stored rows come back on the
// next load, and writes can fail. It keeps any anchor as sent and does not
// run the backend's anchor and source checks.
const server = vi.hoisted(
  (): ReviewServer => ({
    threads: [],
    suggestions: [],
    viewer: "panelist",
    permissions: {
      can_comment: true,
      can_reply: true,
      can_suggest: true,
      can_decide_suggestions: false,
    },
    failedLoads: 0,
    writeErrors: [],
    suspension: "active",
    ids: 0,
    received: [],
  })
);

type Row = Record<string, any>;

const api = {
  load(): Promise<Row> {
    if (server.failedLoads > 0) {
      server.failedLoads--;
      return Promise.reject(new Error("The review service is unreachable"));
    }
    const pending = server.suggestions.filter((s) => s.status === "pending");
    return Promise.resolve(
      structuredClone({
        case_id: "case-1",
        case_status: "in_review",
        revision_id: REVISION,
        viewer_role: server.viewer,
        permissions: server.permissions,
        publication: {
          pending_suggestions: pending.length,
          accepted_suggestions: server.suggestions.length - pending.length,
          awaiting_author: pending.length > 0,
          published_revision_id: null,
        },
        threads: server.threads,
        suggestions: server.suggestions,
      })
    );
  },
  stored(anchor: Record<string, any>) {
    const { revision_id, ...rest } = anchor;
    const sourceText =
      rest.source_start === null
        ? null
        : BODY.slice(rest.source_start, rest.source_end);
    return {
      revision_id,
      anchor: { ...rest, source_text: sourceText },
      anchor_status: revision_id === REVISION ? "current" : "outdated",
    };
  },
  createThread({ anchor, body }: Row): Promise<Row> {
    const error = server.writeErrors.shift();
    if (error) return Promise.reject(new Error(error));

    const thread = {
      id: `thread-${++server.ids}`,
      ...api.stored(anchor),
      author: VERIFIER,
      body: body.trim(),
      created_at: NOW,
      edited_at: null,
      deleted_at: null,
      can_edit: true,
      can_delete: true,
      replies: [],
    };
    server.threads.push(thread);
    return Promise.resolve(thread);
  },
  createSuggestion({ anchor, proposed, note }: Row): Promise<Row> {
    const stored = api.stored(anchor);
    const suggestion = suggestionRow({
      id: `edit-${++server.ids}`,
      ...stored,
      note: note ?? null,
      original: stored.anchor.source_text,
      proposed,
    });
    server.suggestions.push(suggestion);
    return Promise.resolve(suggestion);
  },
  decide(id: string, decision: string): Promise<Row> {
    const suggestion = server.suggestions.find((s) => s.id === id)!;
    Object.assign(suggestion, {
      status: decision,
      decided_by: AUTHOR,
      decided_at: NOW,
    });
    return Promise.resolve({
      suggestion,
      case_status: "in_review",
      publication: null,
    });
  },
};

vi.mock("mathlive", () => ({}));
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate: async () => {} }),
}));
vi.mock("@/lib/authContext", () => ({
  useSuspensionStatus: () => server.suspension,
}));
vi.mock("@/lib/api/reviewAnnotations", () => ({
  getReviewAnnotations: () => api.load(),
  createReviewThread: (_caseId: string, input: Record<string, any>) => {
    server.received.push(input);
    return api.createThread(input);
  },
  replyToReviewThread: vi.fn(),
  createReviewSuggestion: (_caseId: string, input: Record<string, any>) => {
    server.received.push(input);
    return api.createSuggestion(input);
  },
  decideReviewSuggestion: (_caseId: string, id: string, decision: string) =>
    api.decide(id, decision),
}));

function passage(block: number, start: number, quote: string) {
  return {
    kind: "passage",
    start_block: block,
    start_offset: start,
    end_block: block,
    end_offset: start + quote.length,
    quote,
    source_start: null,
    source_end: null,
    source_text: null,
  };
}

function threadRow(id: string, overrides: Record<string, unknown>) {
  return {
    id,
    revision_id: REVISION,
    anchor_status: "current",
    author: VERIFIER,
    body: `Body of ${id}`,
    created_at: NOW,
    edited_at: null,
    deleted_at: null,
    can_edit: false,
    can_delete: false,
    replies: [],
    ...overrides,
  };
}

function suggestionRow(overrides: Record<string, any>) {
  const original = overrides.original ?? RIGID;
  const proposed = overrides.proposed ?? STIFF;
  return {
    id: "edit-1",
    revision_id: REVISION,
    anchor: {
      kind: "block",
      start_block: 1,
      start_offset: 0,
      end_block: 1,
      end_offset: RIGID.length,
      quote: RIGID,
      source_start: BODY.indexOf(RIGID),
      source_end: BODY.indexOf(RIGID) + RIGID.length,
      source_text: RIGID,
    },
    anchor_status: "current",
    author: VERIFIER,
    note: null,
    diff: {
      changed: true,
      lines: [
        { type: "removed", text: original },
        { type: "added", text: proposed },
      ],
    },
    status: "pending",
    decided_by: null,
    decided_at: null,
    applied_revision_id: null,
    created_at: NOW,
    ...overrides,
    original,
    proposed,
  };
}

const guide: ReaderGuide = {
  slug: "",
  variant_slug: null,
  title: "Cells",
  author: "seed",
  summary: null,
  body: BODY,
  duration_minutes: 3,
  created_at: "2026-10-01T00:00:00Z",
  tags: [],
  prerequisites: [],
  disclaimers: [],
  requests: [],
};

function renderCase({ expiresAt = "2099-01-01T00:00:00Z", body = BODY } = {}) {
  return render(
    <ReviewAnnotationsProvider
      caseId="case-1"
      revisionId={REVISION}
      revisionBody={body}
      viewerExpiresAt={expiresAt}
    >
      <aside>
        <p>Sidebar notes</p>
        <PublicationGateNotice viewerRole={server.viewer} />
      </aside>
      <AnnotatedGuide>
        <GuideReader guide={{ ...guide, body }} BlockWrapper={AnnotatedBlock} />
      </AnnotatedGuide>
    </ReviewAnnotationsProvider>
  );
}

const blockContent = (index: number) =>
  document.querySelector(`[data-review-block-content="${index}"]`)!;

const blockOf = (element: Element) =>
  element
    .closest("[data-review-ui]")!
    .previousElementSibling!.querySelector("[data-review-block-content]")!
    .getAttribute("data-review-block-content");

function selectText(node: Node, from: number, to: number) {
  const range = document.createRange();
  range.setStart(node, from);
  range.setEnd(node, to);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  act(() => {
    document.dispatchEvent(new Event("selectionchange"));
  });
}

// Writes through the real MDXEditor, so its markdown export reaches the form.
function typeInto(region: HTMLElement, text: string) {
  const editable = region.querySelector<HTMLElement>(
    '[contenteditable="true"]'
  )!;
  act(() => {
    getNearestEditorFromDOMNode(editable)!.update(
      () => {
        $getRoot()
          .clear()
          .append($createParagraphNode().append($createTextNode(text)));
      },
      { discrete: true }
    );
  });
  return editable;
}

function press(button: HTMLElement) {
  fireEvent.pointerDown(button);
  fireEvent.mouseDown(button);
  fireEvent.click(button);
}

const resizeObservers = new Set<TestResizeObserver>();

class TestResizeObserver implements ResizeObserver {
  readonly callback: ResizeObserverCallback;
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = () => resizeObservers.delete(this);

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    resizeObservers.add(this);
  }
}

const rangeRectDescriptor = Object.getOwnPropertyDescriptor(
  Range.prototype,
  "getBoundingClientRect"
);

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => new DOMRect(20, 100, 200, 20),
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
  if (rangeRectDescriptor)
    Object.defineProperty(
      Range.prototype,
      "getBoundingClientRect",
      rangeRectDescriptor
    );
  else Reflect.deleteProperty(Range.prototype, "getBoundingClientRect");
});

beforeEach(() => {
  Object.assign(server, {
    threads: [],
    suggestions: [],
    viewer: "panelist",
    permissions: {
      can_comment: true,
      can_reply: true,
      can_suggest: true,
      can_decide_suggestions: false,
    },
    failedLoads: 0,
    writeErrors: [],
    suspension: "active",
    received: [],
  });
});

afterEach(() => {
  document.getSelection()?.removeAllRanges();
  cleanup();
});

describe("stored review comments", () => {
  it("hides empty deleted threads from passages and the detached list", async () => {
    server.threads = [
      threadRow("deleted-placed", {
        anchor: passage(0, 11, "energy"),
        body: "",
        deleted_at: NOW,
      }),
      threadRow("deleted-detached", {
        anchor: passage(1, 17, "missing"),
        body: "",
        deleted_at: NOW,
        replies: [threadRow("deleted-reply", { body: "", deleted_at: NOW })],
      }),
    ];

    renderCase();

    await screen.findByText(/No comments yet/);
    expect(
      document.querySelectorAll("[data-review-annotation-badges]")
    ).toHaveLength(0);
    expect(document.querySelectorAll('[id^="review-badge-"]')).toHaveLength(0);
    expect(
      screen.queryByRole("heading", { name: "Comments on changed text" })
    ).toBeNull();
    expect(screen.queryByText("Original comment deleted")).toBeNull();
  });

  it("keeps live replies under a compact deleted-root notice and counts only those replies", async () => {
    server.threads = [
      threadRow("root-with-replies", {
        anchor: passage(0, 11, "energy"),
        body: "",
        deleted_at: NOW,
        replies: [
          threadRow("live-reply", { body: "The surviving answer" }),
          threadRow("removed-reply", { body: "", deleted_at: NOW }),
        ],
      }),
    ];

    renderCase();

    const badge = await screen.findByRole("button", {
      name: /Vera Verifier.*1\s*comment$/,
    });
    fireEvent.click(badge);

    await screen.findByText("Original comment deleted");
    expect(screen.getByText("The surviving answer")).toBeTruthy();
    expect(
      document.querySelectorAll("#review-card-root-with-replies article")
    ).toHaveLength(1);
    expect(screen.queryByText("Comment deleted")).toBeNull();
  });

  it("keeps a live root and an overlapping suggestion when deleted replies and threads disappear", async () => {
    server.threads = [
      threadRow("live-root", {
        anchor: passage(1, 17, "rigid"),
        body: "Keep this comment",
        replies: [threadRow("removed-reply", { body: "", deleted_at: NOW })],
      }),
      threadRow("removed-root", {
        anchor: passage(1, 17, "rigid"),
        body: "",
        deleted_at: NOW,
      }),
    ];
    server.suggestions = [suggestionRow({})];

    renderCase();

    const badge = await screen.findByRole("button", {
      name: /Vera Verifier.*1\s*comment$/,
    });
    expect(
      await screen.findByRole("button", { name: /Edit · Pending/ })
    ).toBeTruthy();
    expect(document.getElementById("review-badge-removed-root")).toBeNull();
    fireEvent.click(badge);
    expect(await screen.findByText("Keep this comment")).toBeTruthy();
    expect(
      document.querySelectorAll("#review-card-live-root article")
    ).toHaveLength(1);
  });

  it("hangs a comment under its passage and keeps changed text apart", async () => {
    server.permissions = {
      can_comment: false,
      can_reply: false,
      can_suggest: false,
      can_decide_suggestions: false,
    };
    server.threads = [
      threadRow("placed", { anchor: passage(0, 11, "energy") }),
      threadRow("changed", { anchor: passage(1, 17, "soft") }),
      threadRow("outdated", {
        anchor: passage(1, 17, "rigid"),
        anchor_status: "outdated",
      }),
    ];

    renderCase();

    const badge = await screen.findByRole("button", { name: /Vera Verifier/ });
    expect(
      screen.getAllByRole("button", { name: /Vera Verifier/ })
    ).toHaveLength(1);
    expect(blockOf(badge)).toBe("0");
    expect(badge.textContent).toContain("Verifier");

    const apart = screen.getByRole("region", {
      name: "Comments on changed text",
    });
    expect(apart.textContent).toContain("Body of changed");
    expect(apart.textContent).toContain("Body of outdated");
    expect(apart.textContent).not.toContain("Body of placed");
    expect(within(apart).getByText("soft")).toBeTruthy();
    expect(within(apart).getByText("rigid")).toBeTruthy();

    fireEvent.click(badge);

    const card = document.getElementById("review-card-placed")!;
    const movedBadge = within(card).getByRole("button", {
      name: /Vera Verifier/,
    });
    expect(movedBadge.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getAllByRole("button", { name: /Vera Verifier/ })
    ).toHaveLength(1);
    expect(document.activeElement).toBe(movedBadge);
    expect(card.textContent).toContain("Body of placed");
    expect(screen.getAllByText("energy")).toHaveLength(1);
    expect(within(card).queryByText("energy")).toBeNull();
    // In normal flow: after its own block, before the next one.
    expect(
      blockContent(0).compareDocumentPosition(card) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      card.compareDocumentPosition(blockContent(1)) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    fireEvent.click(movedBadge);
    expect(document.getElementById("review-card-placed")).toBeNull();
    const restoredBadge = screen.getByRole("button", { name: /Vera Verifier/ });
    expect(restoredBadge.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(restoredBadge);
  });

  it("keeps a separately commented block distinct inside an overlapping passage", async () => {
    server.threads = [
      threadRow("spanning", {
        anchor: {
          ...passage(0, 0, ""),
          end_block: 1,
          end_offset: RIGID.length,
          quote: `Cells make energy in mitochondria.\n${RIGID}`,
        },
      }),
      threadRow("inside", { anchor: passage(0, 11, "energy") }),
      threadRow("adjacent", { anchor: passage(2, 17, "rigid") }),
    ];
    renderCase();
    await screen.findAllByRole("button", { name: /Vera Verifier/ });
    const first = blockContent(0);
    const second = blockContent(1);
    expect(blockOf(document.getElementById("review-badge-spanning")!)).toBe(
      "1"
    );
    expect(blockOf(document.getElementById("review-badge-inside")!)).toBe("0");
    expect(blockOf(document.getElementById("review-badge-adjacent")!)).toBe(
      "2"
    );

    fireEvent.click(document.getElementById("review-badge-inside")!);
    const card = document.getElementById("review-card-inside")!;
    expect(blockOf(card)).toBe("0");
    expect(blockContent(0)).toBe(first);
    expect(blockContent(1)).toBe(second);
    expect(first.textContent).toBe("Cells make energy in mitochondria.");
    expect(second.textContent).toBe(RIGID);

    const actions = first.closest("[data-review-block]")!;
    fireEvent.click(
      within(actions as HTMLElement).getByRole("button", {
        name: "Comment on block",
      })
    );
    const draft = screen.getByRole("region", { name: "New comment" });
    expect(blockOf(draft)).toBe("0");
    expect(draft.querySelector("figure p")?.textContent).toBe(
      "Cells make energy in mitochondria."
    );
    expect(draft.querySelector("figure")?.textContent).not.toContain(RIGID);
    fireEvent.click(within(draft).getByRole("button", { name: "Cancel" }));
    expect(document.activeElement?.closest("[data-review-block]")).toBe(
      actions
    );
  });

  it("keeps a composer after the whole passage when its paragraphs share the same comments", async () => {
    server.threads = [
      threadRow("spanning", {
        anchor: {
          ...passage(0, 0, ""),
          end_block: 1,
          end_offset: RIGID.length,
          quote: `Cells make energy in mitochondria.\n${RIGID}`,
        },
      }),
    ];
    renderCase();
    await screen.findByRole("button", { name: /Vera Verifier/ });
    const actions = blockContent(0).closest("[data-review-block]")!;
    fireEvent.click(
      within(actions as HTMLElement).getByRole("button", {
        name: "Comment on block",
      })
    );
    const draft = screen.getByRole("region", { name: "New comment" });
    expect(blockOf(draft)).toBe("1");
    expect(draft.querySelector("figure p")?.textContent).toBe(
      "Cells make energy in mitochondria."
    );
    expect(draft.querySelector("figure")?.textContent).not.toContain(RIGID);
    fireEvent.click(within(draft).getByRole("button", { name: "Cancel" }));
    expect(document.activeElement?.closest("[data-review-block]")).toBe(
      actions
    );
  });

  it("opens replies on demand and retains a draft through cancel and thread collapse", async () => {
    server.threads = [
      threadRow("placed", { anchor: passage(0, 11, "energy") }),
    ];
    renderCase();
    const badge = await screen.findByRole("button", { name: /Vera Verifier/ });
    fireEvent.click(badge);
    let card = document.getElementById("review-card-placed")!;
    expect(within(card).queryByRole("group", { name: "Reply" })).toBeNull();

    fireEvent.click(within(card).getByRole("button", { name: "Reply" }));
    const composer = within(card).getByRole("group", { name: "Reply" });
    typeInto(composer, "Keep the energy explanation beside this sentence.");
    fireEvent.click(within(composer).getByRole("button", { name: "Cancel" }));
    expect(within(card).queryByRole("group", { name: "Reply" })).toBeNull();
    expect(document.activeElement).toBe(
      within(card).getByRole("button", { name: "Reply" })
    );

    fireEvent.click(within(card).getByRole("button", { name: "Collapse" }));
    fireEvent.click(screen.getByRole("button", { name: /Vera Verifier/ }));
    card = document.getElementById("review-card-placed")!;
    expect(within(card).queryByRole("group", { name: "Reply" })).toBeNull();
    fireEvent.click(within(card).getByRole("button", { name: "Reply" }));
    expect(
      within(card).getByRole("group", { name: "Reply" }).textContent
    ).toContain("Keep the energy explanation beside this sentence.");
  });

  it("shows a load failure and recovers on retry", async () => {
    server.failedLoads = 1;
    renderCase();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The review service is unreachable");

    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(/No comments yet/)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("commenting on a selection", () => {
  it("encloses the gap between selected blocks and follows resized content", async () => {
    renderCase();
    await screen.findByText(/No comments yet/);

    vi.spyOn(blockContent(0), "getBoundingClientRect").mockReturnValue(
      new DOMRect(20, 100, 240, 40)
    );
    const lastBounds = vi.spyOn(blockContent(1), "getBoundingClientRect");
    lastBounds.mockReturnValue(new DOMRect(20, 240, 240, 60));
    fireEvent.click(blockContent(0).querySelector("p")!);
    fireEvent.keyDown(
      screen.getByRole("button", { name: "Adjust selection end (right)" }),
      { key: "ArrowDown" }
    );

    const outline = document.querySelector(
      "[data-review-selection-outline] rect"
    )!;
    expect(Number(outline.getAttribute("y"))).toBe(96);
    expect(Number(outline.getAttribute("height"))).toBe(208);

    lastBounds.mockReturnValue(new DOMRect(20, 300, 240, 60));
    act(() => {
      for (const observer of Array.from(resizeObservers))
        observer.callback([], observer);
    });
    expect(Number(outline.getAttribute("height"))).toBe(268);
  });

  it("commits a quick grip release and ignores movement after cancellation", async () => {
    renderCase();
    await screen.findByText(/No comments yet/);

    for (const index of [0, 1, 2]) {
      vi.spyOn(blockContent(index), "getBoundingClientRect").mockReturnValue(
        new DOMRect(20, index * 100, 240, 40)
      );
    }
    fireEvent.click(blockContent(1).querySelector("p")!);

    const root = document.querySelector(
      "[data-review-selection-outline]"
    )!.parentElement!;
    Object.assign(root, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: () => true,
      releasePointerCapture: vi.fn(),
    });
    const pointer = (target: EventTarget, type: string, y: number) => {
      const event = new MouseEvent(type, {
        bubbles: true,
        button: 0,
        clientY: y,
      });
      Object.defineProperty(event, "pointerId", { value: 7 });
      act(() => target.dispatchEvent(event));
    };

    pointer(
      screen.getByRole("button", { name: "Adjust selection end (right)" }),
      "pointerdown",
      185
    );
    pointer(window, "pointerup", 185);
    expect(blockContent(1).hasAttribute("data-review-selected")).toBe(true);
    expect(blockContent(2).hasAttribute("data-review-selected")).toBe(false);

    pointer(
      screen.getByRole("button", { name: "Adjust selection end (right)" }),
      "pointerdown",
      185
    );
    pointer(window, "pointerup", 285);
    expect(blockContent(1).hasAttribute("data-review-selected")).toBe(true);
    expect(blockContent(2).hasAttribute("data-review-selected")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    fireEvent.click(blockContent(1).querySelector("p")!);
    pointer(
      screen.getByRole("button", { name: "Adjust selection end (right)" }),
      "pointerdown",
      130
    );
    pointer(window, "pointercancel", 130);
    pointer(window, "pointermove", 220);
    pointer(window, "pointerup", 220);
    expect(blockContent(1).hasAttribute("data-review-selected")).toBe(true);
    expect(blockContent(2).hasAttribute("data-review-selected")).toBe(false);
  });

  it("snaps a tapped block across paragraphs with keyboard grips", async () => {
    renderCase();
    await screen.findByText(/No comments yet/);

    fireEvent.click(blockContent(1).querySelector("p")!);
    expect(blockContent(0).hasAttribute("data-review-selected")).toBe(false);
    expect(blockContent(1).hasAttribute("data-review-selected")).toBe(true);
    expect(blockContent(2).hasAttribute("data-review-selected")).toBe(false);

    const end = screen.getByRole("button", {
      name: "Adjust selection end (right)",
    });
    fireEvent.keyDown(end, { key: "ArrowDown" });
    expect(blockContent(2).hasAttribute("data-review-selected")).toBe(true);

    const start = screen.getByRole("button", {
      name: "Adjust selection start (left)",
    });
    fireEvent.keyDown(start, { key: "ArrowDown" });
    expect(blockContent(1).hasAttribute("data-review-selected")).toBe(false);
    fireEvent.keyDown(
      screen.getByRole("button", { name: "Adjust selection start (left)" }),
      { key: "End" }
    );
    expect(blockContent(2).hasAttribute("data-review-selected")).toBe(true);

    press(screen.getByRole("button", { name: "Comment on selection" }));
    const draft = screen.getByRole("region", { name: "New comment" });
    expect(blockOf(draft)).toBe("2");
    expect(draft.textContent).toContain(RIGID);
    expect(
      screen.queryByRole("button", { name: "Adjust selection end (right)" })
    ).toBeNull();
  });

  it("preserves snapped blocks during page touches and clears them explicitly", async () => {
    renderCase();
    await screen.findByText(/No comments yet/);

    fireEvent.click(blockContent(1).querySelector("p")!);
    fireEvent.pointerDown(document.body, { pointerType: "touch" });
    act(() => document.dispatchEvent(new Event("selectionchange")));
    expect(blockContent(1).hasAttribute("data-review-selected")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(blockContent(1).hasAttribute("data-review-selected")).toBe(false);
    expect(
      screen.queryByRole("button", { name: "Adjust selection end (right)" })
    ).toBeNull();
  });

  it("keeps every selected block marked when the action takes focus", async () => {
    renderCase();
    await screen.findByText(/No comments yet/);

    const first = blockContent(0).querySelector("p")!.firstChild!;
    const last = blockContent(1).querySelector("p")!.firstChild!;
    const range = document.createRange();
    range.setStart(first, 0);
    range.setEnd(last, 13);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    act(() => document.dispatchEvent(new Event("selectionchange")));

    expect(blockContent(0).hasAttribute("data-review-selected")).toBe(true);
    expect(blockContent(1).hasAttribute("data-review-selected")).toBe(true);
    expect(blockContent(2).hasAttribute("data-review-selected")).toBe(false);

    const action = screen.getByRole("button", { name: "Comment on selection" });
    fireEvent.pointerDown(action);
    selection.removeAllRanges();
    act(() => document.dispatchEvent(new Event("selectionchange")));
    fireEvent.click(action);

    const draft = screen.getByRole("region", { name: "New comment" });
    expect(draft.textContent).toContain("Cells make energy in mitochondria.");
    expect(draft.querySelector("figure")!.textContent).toContain(RIGID);
    expect(draft.querySelector("figure strong")?.textContent).toBe("energy");
    expect(blockContent(0).hasAttribute("data-review-selected")).toBe(true);
    expect(blockContent(1).hasAttribute("data-review-selected")).toBe(true);
    expect(blockContent(2).hasAttribute("data-review-selected")).toBe(false);

    fireEvent.click(within(draft).getByRole("button", { name: "Cancel" }));
    expect(blockContent(0).hasAttribute("data-review-selected")).toBe(false);
  });

  it("anchors the selected repeat, and keeps the draft through a failed save", async () => {
    renderCase();
    await screen.findByText(/No comments yet/);

    const sidebar = screen.getByText("Sidebar notes").firstChild!;
    selectText(sidebar, 0, 7);
    expect(
      screen.queryByRole("button", { name: "Comment on selection" })
    ).toBeNull();

    // The second of two identical paragraphs.
    selectText(blockContent(2).querySelector("p")!.firstChild!, 4, 13);
    press(screen.getByRole("button", { name: "Comment on selection" }));

    const draft = screen.getByRole("region", { name: "New comment" });
    expect(draft.querySelector("figure p")?.textContent).toBe(RIGID);
    expect(blockOf(draft)).toBe("2");

    await waitFor(() =>
      expect(draft.querySelector('[contenteditable="true"]')).not.toBeNull()
    );
    const editable = typeInto(draft, "Plant cells only?");
    server.writeErrors = ["Too many comments. Try again later."];
    fireEvent.click(
      within(draft).getByRole("button", { name: "Post comment" })
    );

    expect((await within(draft).findByRole("alert")).textContent).toBe(
      "Too many comments. Try again later."
    );
    expect(editable.textContent).toContain("Plant cells only?");

    fireEvent.click(
      within(draft).getByRole("button", { name: "Post comment" })
    );

    const badge = await screen.findByRole("button", { name: /Vera Verifier/ });
    expect(blockOf(badge)).toBe("2");
    expect(screen.queryByRole("region", { name: "New comment" })).toBeNull();
    const card = document.getElementById(badge.getAttribute("aria-controls")!)!;
    expect(card.textContent).toContain("Plant cells only?");

    const anchor = {
      kind: "block",
      start_block: 2,
      start_offset: 0,
      end_block: 2,
      end_offset: RIGID.length,
      quote: RIGID,
      source_start: BODY.lastIndexOf(RIGID),
      source_end: BODY.lastIndexOf(RIGID) + RIGID.length,
      revision_id: REVISION,
    };
    const body = expect.stringMatching(/^Plant cells only\?\n*$/);
    expect(server.received).toEqual([
      { anchor, body },
      { anchor, body },
    ]);
  });

  it("mirrors a complete formatted block and resolves references outside it", async () => {
    renderCase({
      body: [
        "Outside the quote.",
        "",
        "Keep **bold**, *emphasis*, `code`, $x^2$, and [the reference][source].",
        "",
        "[source]: https://example.com/source",
      ].join("\n"),
    });
    await screen.findByText(/No comments yet/);

    selectText(blockContent(1).querySelector("strong")!.firstChild!, 1, 3);
    press(screen.getByRole("button", { name: "Comment on selection" }));

    const quote = screen
      .getByRole("region", { name: "New comment" })
      .querySelector("figure")!;
    expect(quote.textContent).toContain("Keep bold, emphasis, code,");
    expect(quote.textContent).not.toContain("Outside the quote.");
    expect(quote.querySelector("strong")?.textContent).toBe("bold");
    expect(quote.querySelector("em")?.textContent).toBe("emphasis");
    expect(quote.querySelector("code")?.textContent).toBe("code");
    expect(quote.querySelector(".katex")).not.toBeNull();
    expect(
      within(quote)
        .getByRole("link", { name: "the reference" })
        .getAttribute("href")
    ).toBe("https://example.com/source");
  });

  it("keeps the complete list when only one list item is highlighted", async () => {
    renderCase({
      body: "- First **item**\n- Second item\n\nOutside the list.",
    });
    await screen.findByText(/No comments yet/);

    selectText(blockContent(0).querySelector("strong")!.firstChild!, 0, 4);
    press(screen.getByRole("button", { name: "Comment on selection" }));

    const quote = screen
      .getByRole("region", { name: "New comment" })
      .querySelector("figure")!;
    expect(
      Array.from(quote.querySelectorAll("ul > li"), (item) => item.textContent)
    ).toEqual(["First item", "Second item"]);
    expect(quote.querySelector("strong")?.textContent).toBe("item");
    expect(quote.textContent).not.toContain("Outside the list.");
  });

  it("refuses an empty selection", async () => {
    renderCase();
    await screen.findByText(/No comments yet/);
    const text = blockContent(1).querySelector("p")!.firstChild!;

    selectText(text, 3, 3);
    expect(
      screen.queryByRole("button", { name: "Comment on selection" })
    ).toBeNull();

    selectText(text, 3, 4);
    expect(
      screen.queryByRole("button", { name: "Comment on selection" })
    ).toBeNull();
  });

  it.each([
    ["a suspended reviewer", { suspension: "suspended" }, undefined],
    ["a lapsed seat", {}, "2020-01-01T00:00:00Z"],
  ])("offers no comment action to %s", async (_label, state, expiresAt) => {
    Object.assign(server, state);
    renderCase({ expiresAt });
    await screen.findByText(/No reviewer comments/);

    selectText(blockContent(1).querySelector("p")!.firstChild!, 4, 13);
    expect(
      screen.queryByRole("button", { name: "Comment on selection" })
    ).toBeNull();
    expect(
      screen.queryAllByRole("button", { name: "Comment on block" })
    ).toEqual([]);
  });

  it("offers a whole-block comment to keyboard users", async () => {
    renderCase();
    await screen.findByText(/No comments yet/);

    const blockButtons = screen.getAllByRole("button", {
      name: "Comment on block",
    });
    expect(blockButtons).toHaveLength(3);

    fireEvent.click(blockButtons[1]);
    const draft = screen.getByRole("region", { name: "New comment" });
    expect(draft.textContent).toContain(RIGID);
    expect(blockOf(draft)).toBe("1");
  });
});

describe("suggested edits", () => {
  it("needs a confirmed author decision before an edit counts", async () => {
    server.viewer = "author";
    server.permissions = {
      can_comment: false,
      can_reply: true,
      can_suggest: false,
      can_decide_suggestions: true,
    };
    server.suggestions = [suggestionRow({ note: "Plant walls bend." })];
    renderCase();

    expect(
      (await screen.findByText(/1 suggested edit waits for your decision/))
        .textContent
    ).toContain("does not publish");

    fireEvent.click(screen.getByRole("button", { name: /Edit · Pending/ }));
    const card = document.getElementById("review-card-edit-1")!;
    expect(card.textContent).toContain(STIFF);
    expect(card.textContent).toContain("Vera Verifier");

    fireEvent.click(within(card).getByRole("button", { name: /Accept edit/ }));
    // One press only asks; the edit stays pending until the author confirms.
    expect(
      within(card).getByRole("group", { name: "Confirm your decision" })
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Edit · Pending/ })).toBeTruthy();

    fireEvent.click(
      within(card).getByRole("button", { name: "Confirm accept" })
    );

    expect(
      await screen.findByRole("button", { name: /Edit · Accepted/ })
    ).toBeTruthy();
    expect(
      document.getElementById("review-card-edit-1")!.textContent
    ).toContain("Accepted by @seed");
    expect(screen.queryByText(/waits for your decision/)).toBeNull();
  });

  it("gives a verifier no way to accept an edit", async () => {
    server.suggestions = [suggestionRow({})];
    renderCase();

    expect(
      await screen.findByText(/1 suggested edit waits for the author/)
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Edit · Pending/ }));

    const card = document.getElementById("review-card-edit-1")!;
    expect(
      within(card).queryByRole("button", { name: /Accept edit/ })
    ).toBeNull();
    expect(card.textContent).toContain("Waiting for the author");
  });

  it("refuses an unchanged edit and saves a changed one", async () => {
    renderCase();
    await screen.findByText(/No comments yet/);

    fireEvent.click(screen.getAllByRole("button", { name: "Suggest edit" })[1]);
    const draft = screen.getByRole("region", { name: "Suggest an edit" });
    await waitFor(() =>
      expect(draft.querySelector('[contenteditable="true"]')).not.toBeNull()
    );

    fireEvent.click(within(draft).getByRole("button", { name: "Submit edit" }));
    expect(within(draft).getByRole("alert").textContent).toBe(
      "Change the text before you submit the edit."
    );
    expect(screen.queryByRole("button", { name: /Edit · Pending/ })).toBeNull();

    typeInto(draft, STIFF);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    fireEvent.click(within(draft).getByRole("button", { name: "Submit edit" }));

    const badge = await screen.findByRole("button", { name: /Edit · Pending/ });
    expect(blockOf(badge)).toBe("1");
    const card = document.getElementById(badge.getAttribute("aria-controls")!)!;
    expect(card.textContent).toContain(STIFF);
    expect(server.received).toEqual([
      {
        anchor: {
          kind: "block",
          start_block: 1,
          start_offset: 0,
          end_block: 1,
          end_offset: RIGID.length,
          quote: RIGID,
          source_start: BODY.indexOf(RIGID),
          source_end: BODY.indexOf(RIGID) + RIGID.length,
          revision_id: REVISION,
        },
        proposed: STIFF,
      },
    ]);
  });
});

describe("keyboard focus", () => {
  it("moves into a suggested edit as the draft opens", async () => {
    renderCase();
    await screen.findByText(/No comments yet/);

    const suggest = screen.getAllByRole("button", { name: "Suggest edit" })[1];
    suggest.focus();
    fireEvent.click(suggest);

    const draft = screen.getByRole("region", { name: "Suggest an edit" });
    expect(document.activeElement).toBe(draft);
    await waitFor(() =>
      expect(draft.querySelector('[contenteditable="true"]')).not.toBeNull()
    );
    expect(draft.contains(document.activeElement)).toBe(true);
  });

  it("hands focus to the badge of a posted comment", async () => {
    renderCase();
    await screen.findByText(/No comments yet/);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Comment on block" })[1]
    );
    const draft = screen.getByRole("region", { name: "New comment" });
    await waitFor(() =>
      expect(draft.querySelector('[contenteditable="true"]')).not.toBeNull()
    );
    typeInto(draft, "Plant cells only?");
    const post = within(draft).getByRole("button", { name: "Post comment" });
    post.focus();
    fireEvent.click(post);

    const badge = await screen.findByRole("button", { name: /Vera Verifier/ });
    expect(badge.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(badge);
  });

  it("returns focus to the block when Escape clears a block selection", async () => {
    renderCase();
    await screen.findByText(/No comments yet/);

    fireEvent.click(blockContent(1).querySelector("p")!);
    const grip = screen.getByRole("button", {
      name: "Adjust selection end (right)",
    });
    grip.focus();
    fireEvent.keyDown(grip, { key: "Escape" });

    expect(blockContent(1).hasAttribute("data-review-selected")).toBe(false);
    expect(
      screen.queryByRole("button", { name: "Adjust selection end (right)" })
    ).toBeNull();
    const block = blockContent(1).closest<HTMLElement>("[data-review-block]")!;
    expect(document.activeElement).toBe(
      within(block).getByRole("button", { name: "Select block" })
    );
  });

  it("keeps focus on each step of an author decision", async () => {
    server.viewer = "author";
    server.permissions = {
      can_comment: false,
      can_reply: true,
      can_suggest: false,
      can_decide_suggestions: true,
    };
    server.suggestions = [suggestionRow({})];
    renderCase();

    fireEvent.click(
      await screen.findByRole("button", { name: /Edit · Pending/ })
    );
    const card = document.getElementById("review-card-edit-1")!;

    const reject = within(card).getByRole("button", { name: /Reject edit/ });
    reject.focus();
    fireEvent.click(reject);
    expect(document.activeElement).toBe(
      within(card).getByRole("group", { name: "Confirm your decision" })
    );

    fireEvent.click(within(card).getByRole("button", { name: "Cancel" }));
    expect(document.activeElement).toBe(
      within(card).getByRole("button", { name: /Reject edit/ })
    );

    fireEvent.click(within(card).getByRole("button", { name: /Accept edit/ }));
    fireEvent.click(
      within(card).getByRole("button", { name: "Confirm accept" })
    );
    await screen.findByRole("button", { name: /Edit · Accepted/ });
    expect(document.activeElement).toBe(card);
  });

  it("returns focus to the badge when a card collapses", async () => {
    server.threads = [
      threadRow("placed", { anchor: passage(0, 11, "energy") }),
    ];
    renderCase();
    fireEvent.click(
      await screen.findByRole("button", { name: /Vera Verifier/ })
    );

    const card = document.getElementById("review-card-placed")!;
    const collapse = within(card).getByRole("button", { name: "Collapse" });
    collapse.focus();
    fireEvent.click(collapse);

    expect(document.getElementById("review-card-placed")).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /Vera Verifier/ })
    );
  });
});
