// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { GuideReference } from "@bluelearn/schemas";
import { FollowUpsModal } from "@/components/modals/FollowUpsModal";

// Keep link destinations visible without mounting the application router.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    onClick,
  }: {
    children: ReactNode;
    to: string;
    params?: { slug: string };
    onClick?: () => void;
  }) => (
    <a
      href={params ? `/guides/${params.slug}` : "#"}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
      }}
    >
      {children}
    </a>
  ),
}));

const followUp: GuideReference = {
  slug: "binary-search",
  title: "Binary Search",
};

afterEach(cleanup);

describe("FollowUpsModal", () => {
  it("shows the empty state when no follow-ups are declared", () => {
    render(
      <FollowUpsModal
        open
        onOpenChange={() => {}}
        followUps={[]}
        guideTitle="Arrays"
        slug="arrays"
      />
    );

    expect(screen.getByText("None declared")).toBeDefined();
    expect(
      screen.getByText("This guide does not list any follow-ups.")
    ).toBeDefined();
  });

  it("shows follow-up guides as links", () => {
    render(
      <FollowUpsModal
        open
        onOpenChange={() => {}}
        followUps={[followUp]}
        guideTitle="Arrays"
        slug="arrays"
      />
    );

    expect(screen.getByRole("link", { name: "Binary Search" })).toBeDefined();

    expect(
      screen.getByRole("link", { name: "Binary Search" }).getAttribute("href")
    ).toBe("/guides/binary-search");
  });

  it("closes the modal when a follow-up is selected", () => {
    const onOpenChange = vi.fn();

    render(
      <FollowUpsModal
        open
        onOpenChange={onOpenChange}
        followUps={[followUp]}
        guideTitle="Arrays"
        slug="arrays"
      />
    );

    fireEvent.click(screen.getByRole("link", { name: "Binary Search" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
