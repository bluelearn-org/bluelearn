// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { DateOfBirthForm } from "../DateOfBirthForm";

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/lib/api/identity", () => ({ updateMyDateOfBirth: save }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("date of birth form", () => {
  it("allows skipping onboarding without storing a birth date", () => {
    const complete = vi.fn();
    render(<DateOfBirthForm initialValue={null} onComplete={complete} />);
    expect(screen.getByLabelText(/Date of birth/)).toHaveProperty(
      "required",
      false
    );
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(complete).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
  });
  it("accepts an empty optional field on Continue", async () => {
    save.mockResolvedValue({ date_of_birth: null });
    const complete = vi.fn();
    render(<DateOfBirthForm initialValue={null} onComplete={complete} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(complete).toHaveBeenCalledOnce());
    expect(save).toHaveBeenCalledWith(null);
  });
  it("saves and disables editing while the request is pending", async () => {
    let finish!: () => void;
    save.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    render(<DateOfBirthForm initialValue={null} />);
    const input = screen.getByLabelText("Date of birth");
    fireEvent.change(input, { target: { value: "1990-06-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(input).toHaveProperty("disabled", true);
    expect(save).toHaveBeenCalledWith("1990-06-15");
    finish();
    await waitFor(() => expect(input).toHaveProperty("disabled", false));
    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty(
      "disabled",
      true
    );
  });
  it("rejects future dates even if native validation is bypassed", async () => {
    render(<DateOfBirthForm initialValue={null} />);
    const input = screen.getByLabelText("Date of birth");
    fireEvent.change(input, { target: { value: "9999-01-01" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Enter a valid date of birth that is not in the future."
    );
    expect(save).not.toHaveBeenCalled();
  });
  it("keeps the input and permits retry after a failed save", async () => {
    save
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce({ date_of_birth: "1990-01-01" });
    render(<DateOfBirthForm initialValue={null} />);
    const input = screen.getByLabelText("Date of birth");
    fireEvent.change(input, { target: { value: "1990-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("alert");
    expect(input).toHaveProperty("value", "1990-01-01");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(save).toHaveBeenCalledTimes(2);
  });
  it("allows clearing a saved date", async () => {
    save.mockResolvedValue({ date_of_birth: null });
    render(<DateOfBirthForm initialValue="1990-01-01" />);
    fireEvent.change(screen.getByLabelText("Date of birth"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(null));
  });
});
