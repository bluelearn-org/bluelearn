import type { ReactNode } from "react";

export function toText(value: ReactNode): string {
  if (value == null || typeof value === "boolean") return "";

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(toText).join("");
  }

  return "";
}