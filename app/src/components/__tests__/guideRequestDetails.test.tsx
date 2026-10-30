// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GuideRequestDetails } from "@/components/contribute/steps/GuideRequestDetails";

const { createTodo } = vi.hoisted(() => ({
  createTodo: vi.fn(),
}));

vi.mock("@/lib/api/todos", () => ({ createTodo }));
vi.mock("@/components/contribute/StepperActionHeader", () => ({
  StepperActionHeader: ({
    onPublish,
    publishLabel,
    submitting,
    title,
  }: {
    onPublish: () => void;
    publishLabel: string;
    submitting: boolean;
    title: string;
  }) => (
    <div>
      <h1>{title}</h1>
      <button disabled={submitting} onClick={onPublish}>
        {publishLabel}
      </button>
    </div>
  ),
}));

const Stepper = {
  Content: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
};

describe("GuideRequestDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createTodo.mockResolvedValue({ id: "request-id" });
  });

  afterEach(cleanup);

  it("renders the request details fields and submits trimmed values", async () => {
    render(<GuideRequestDetails Stepper={Stepper} />);

    expect(
      screen.getByRole("heading", { name: "Guide Request Details" })
    ).toBeTruthy();
    expect(screen.getByLabelText(/Title/)).toBeTruthy();
    expect(screen.getByLabelText(/Summary/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: "  Distributed systems  " },
    });
    fireEvent.change(screen.getByLabelText(/Summary/), {
      target: { value: "  Explain the tradeoffs.  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit Request" }));

    await waitFor(() =>
      expect(createTodo).toHaveBeenCalledWith({
        title: "Distributed systems",
        summary: "Explain the tradeoffs.",
      })
    );
  });

  it("rejects a blank title without submitting", () => {
    render(<GuideRequestDetails Stepper={Stepper} />);

    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit Request" }));

    expect(screen.getByRole("alert").textContent).toBe(
      "Add a title for the guide you want to see."
    );
    expect(createTodo).not.toHaveBeenCalled();
  });

  it("prevents another submission while pending and after success", async () => {
    let finishRequest!: (value: { id: string }) => void;
    createTodo.mockReturnValueOnce(
      new Promise((resolve) => {
        finishRequest = resolve;
      })
    );
    render(<GuideRequestDetails Stepper={Stepper} />);

    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: "Distributed systems" },
    });
    const submit = screen.getByRole("button", { name: "Submit Request" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(createTodo).toHaveBeenCalledTimes(1);
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    finishRequest({ id: "request-id" });
    await screen.findByText("Your guide request was submitted.");
    fireEvent.click(submit);
    expect(createTodo).toHaveBeenCalledTimes(1);
  });

  it("shows an error and allows retry after a failed request", async () => {
    createTodo
      .mockRejectedValueOnce(new Error("Request failed"))
      .mockResolvedValueOnce({ id: "request-id" });

    const onSubmitted = vi.fn();
    render(<GuideRequestDetails Stepper={Stepper} onSubmitted={onSubmitted} />);

    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: "Distributed systems" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit Request" }));

    expect(await screen.findByText("Request failed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Submit Request" }));

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(createTodo).toHaveBeenCalledTimes(2);
  });
});
