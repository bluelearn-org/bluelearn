import { z } from "zod";

export const knowledgeTypeSchema = z.enum(["theoretical", "practical"]);
export const guideTypeSchema = z.enum(["canonical", "variant"]);
export const guideStatusSchema = z.enum(["draft", "published", "archived"]);
export const revisionStatusSchema = z.enum(["draft", "submitted"]);
export const voteDirectionSchema = z.enum(["up", "down"]);
export const downvoteReasons = [
  "unclear",
  "factually_wrong",
  "missing_step",
  "outdated",
  "broken_link",
  "prereq_gap",
  "wrong_level",
  "scope_creep",
] as const;

export const downvoteReasonSchema = z.enum(downvoteReasons);
