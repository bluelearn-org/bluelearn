import { describe, expect, it } from "vitest";

import {
  hasMeaningfulText,
  validateReviewDecision,
} from "@/lib/reviewValidation";

const rejection = (notes: string) => ({
  decision: "reject",
  notes,
  reasons: ["inaccurate"],
});

describe("hasMeaningfulText", () => {
  it("accepts letters and numbers in any script", () => {
    expect(hasMeaningfulText("Needs a worked example.")).toBe(true);
    expect(hasMeaningfulText("需要一个例子")).toBe(true);
    expect(hasMeaningfulText("يحتاج إلى مثال")).toBe(true);
    expect(hasMeaningfulText("Нужен пример")).toBe(true);
    expect(hasMeaningfulText("42")).toBe(true);
  });

  it("rejects input with no letters or numbers", () => {
    expect(hasMeaningfulText("")).toBe(false);
    expect(hasMeaningfulText("   ")).toBe(false);
    expect(hasMeaningfulText("\t\n")).toBe(false);
    expect(hasMeaningfulText("...")).toBe(false);
    expect(hasMeaningfulText("-")).toBe(false);
  });
});

describe("validateReviewDecision", () => {
  it("asks for a decision before anything else", () => {
    expect(
      validateReviewDecision({ decision: "", notes: "", reasons: [] })
    ).toBe("Choose approve or reject before submitting");
  });

  it("lets an approval through without notes or reasons", () => {
    expect(
      validateReviewDecision({ decision: "approve", notes: "", reasons: [] })
    ).toBe("");
  });

  it("lets a complete rejection through", () => {
    expect(validateReviewDecision(rejection("Missing prerequisites."))).toBe(
      ""
    );
  });

  it("rejects a note with no readable text", () => {
    expect(validateReviewDecision(rejection("   "))).toBe(
      "Rejections require a note"
    );
    expect(validateReviewDecision(rejection("..."))).toBe(
      "Rejections require a note"
    );
  });

  it("still requires at least one reason", () => {
    expect(
      validateReviewDecision({
        decision: "reject",
        notes: "Needs work.",
        reasons: [],
      })
    ).toBe("Rejections require at least one reason");
  });

  it("reports both problems together", () => {
    expect(
      validateReviewDecision({ decision: "reject", notes: " ", reasons: [] })
    ).toBe("Rejections require at least one reason and a note");
  });
});
