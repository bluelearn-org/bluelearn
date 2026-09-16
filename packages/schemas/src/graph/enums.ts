import { z } from "zod";

export const todoStatusSchema = z.enum(["open", "resolved"]);

export const edgeTypeSchema = z.enum(["prerequisite", "related"]);
