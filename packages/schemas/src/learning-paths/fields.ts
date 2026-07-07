import { z } from "zod";

// User-facing content primitives, shared across the path/revision/node
// requests so a trim or length rule lives in one place.
export const pathTitleSchema = z.string().trim().min(1).max(200);
export const pathSummarySchema = z.string().trim().max(500);
export const pathChangeSummarySchema = z.string().trim().max(500);
