import { describe, expect, it } from "vitest";
import { getAvatarUrl, getInitials } from "../profile";

describe("getInitials", () => {
  it("extracts up to two initials from single-word and multi-word names", () => {
    expect(getInitials("Ada")).toBe("AD");
    expect(getInitials("Ada Lovelace")).toBe("AL");
    expect(getInitials("Alan Mathison Turing")).toBe("AM");
  });

  it("handles empty or missing input", () => {
    expect(getInitials("")).toBe("?");
    expect(getInitials(null)).toBe("?");
    expect(getInitials(undefined)).toBe("?");
  });
});

describe("getAvatarUrl", () => {
  it("returns avatar endpoint URL for an id or seed", () => {
    const base = import.meta.env.VITE_API_BASE ?? "";
    expect(getAvatarUrl("test-user-123")).toBe(`${base}/avatar/test-user-123`);
  });

  it("returns empty string when id is falsy", () => {
    expect(getAvatarUrl("")).toBe("");
    expect(getAvatarUrl(null)).toBe("");
    expect(getAvatarUrl(undefined)).toBe("");
  });
});
