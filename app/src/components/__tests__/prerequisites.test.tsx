// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type {
  Guide,
  GuideReference,
  RequestReference,
} from "@bluelearn/schemas";
import { GuideSidebar } from "@/components/sidebar/GuideSidebar";
import { PrerequisitesModal } from "@/components/modals/PrerequisitesModal";

// Keep link destinations visible without mounting the application router.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    search,
    onClick,
  }: {
    children: ReactNode;
    to: string;
    params?: { slug: string };
    search?: Record<string, string>;
    onClick?: () => void;
  }) => (
    <a
      href={
        params
          ? `/guides/${params.slug}`
          : `${to}?${new URLSearchParams(search).toString()}`
      }
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
      }}
    >
      {children}
    </a>
  ),
}));

const prerequisite: GuideReference = { slug: "variables", title: "Variables" };
const todo: RequestReference = {
  id: "20000000-0000-4000-8000-000000000001",
  title: "Loop invariants",
  summary: "How to reason about each iteration of a loop.",
};

function makeGuide(
  prerequisites: Array<GuideReference>,
  todos: Array<RequestReference>
): Guide {
  return {
    slug: "binary-search",
    variant_id: null,
    variant_slug: null,
    title: "Binary search",
    author: null,
    knowledge_type: "theoretical",
    summary: null,
    body: "",
    duration_minutes: 0,
    created_at: "2026-09-10T00:00:00Z",
    tags: [],
    prerequisites,
    requests: todos,
    is_official: false,
    disclaimers: [],
  };
}

afterEach(cleanup);

describe.each(["sidebar", "mobile dialog"] as const)(
  "%s prerequisites",
  (surface) => {
    function show(
      prerequisites: Array<GuideReference>,
      todos: Array<RequestReference>
    ) {
      return render(
        surface === "sidebar" ? (
          <GuideSidebar
            guide={makeGuide(prerequisites, todos)}
            slug="binary-search"
          />
        ) : (
          <PrerequisitesModal
            open
            onOpenChange={() => {}}
            prerequisites={prerequisites}
            requests={todos}
            guideTitle="Binary search"
            slug="binary-search"
          />
        )
      );
    }

    it("shows the empty state when neither kind is present", () => {
      show([], []);
      expect(screen.queryByText("Todo")).toBeNull();
    });

    it("links a todo to the contribution flow seeded with its details", () => {
      show([], [todo]);
      const href = screen
        .getByText(todo.title)
        .closest("a")
        ?.getAttribute("href");
      expect(href).toBe(
        `/contribute?${new URLSearchParams({
          todoTitle: todo.title,
          todoSummary: todo.summary,
          todos: todo.id,
        }).toString()}`
      );
      expect(screen.getByText("Todo")).toBeDefined();
      if (surface === "mobile dialog") {
        expect(screen.getByText(todo.summary)).toBeDefined();
      } else {
        expect(screen.getByText(todo.title).closest("li")?.title).toBe(
          todo.summary
        );
      }
    });

    it("keeps existing prerequisites as links alongside todos", () => {
      show([prerequisite], [todo]);
      expect(
        screen.getByRole("link", { name: "Variables" }).getAttribute("href")
      ).toBe("/guides/variables");
      expect(
        screen.getByText(todo.title).closest("a")?.getAttribute("href")
      ).toContain("/contribute?");
    });
  }
);

it("accepts older guide responses without the todo field", () => {
  const guide = makeGuide([prerequisite], []);
  Reflect.deleteProperty(guide, "requests");
  render(<GuideSidebar guide={guide} slug="binary-search" />);
  expect(screen.getByRole("link", { name: "Variables" })).toBeDefined();
});

it("keeps prerequisites hidden on variant pages", () => {
  render(
    <GuideSidebar
      guide={makeGuide([prerequisite], [todo])}
      slug="binary-search"
      showPrerequisites={false}
    />
  );
  expect(screen.queryByText("Prerequisites")).toBeNull();
  expect(screen.queryByText(todo.title)).toBeNull();
});

it("closes the mobile dialog when an existing prerequisite is selected", () => {
  const onOpenChange = vi.fn();
  render(
    <PrerequisitesModal
      open
      onOpenChange={onOpenChange}
      prerequisites={[prerequisite]}
      requests={[todo]}
      guideTitle="Binary search"
      slug="binary-search"
    />
  );
  fireEvent.click(screen.getByRole("link", { name: "Variables" }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
});
