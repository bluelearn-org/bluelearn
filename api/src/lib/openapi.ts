import { resolver, validator } from "hono-openapi";
import { z } from "zod";
import type {
  GenerateSpecOptions,
  ResolverReturnType,
  ResponsesWithResolver,
} from "hono-openapi";

export const errorSchema = z.strictObject({ error: z.string() });

const INVALID = {
  json: "Invalid request body",
  form: "Invalid request body",
  query: "Invalid query parameters",
  param: "Invalid path parameters",
  header: "Invalid headers",
  cookie: "Invalid cookies",
};

// Keeps validation failures in the { error } shape 400s are documented with.
export const validate: typeof validator = (target, schema, _hook, options) =>
  validator(
    target,
    schema,
    (result, c) =>
      result.success ? undefined : c.json({ error: INVALID[target] }, 400),
    options
  ) as never;

export type JsonResponse = {
  description: string;
  content: { "application/json": { schema: ResolverReturnType } };
};

// One application/json response entry for a describeRoute response block.
export function jsonContent(
  schema: z.ZodType,
  description: string
): JsonResponse {
  return {
    description,
    content: { "application/json": { schema: resolver(schema) } },
  };
}

export const sharedErrorResponses: ResponsesWithResolver = {
  BadRequest: jsonContent(errorSchema, "Validation failed"),
  Unauthorized: jsonContent(errorSchema, "Missing or invalid auth token"),
  Forbidden: jsonContent(
    errorSchema,
    "Authenticated but lacking the required role (e.g. not a curator)"
  ),
  NotFound: jsonContent(
    errorSchema,
    "Resource not found (or not permitted; RLS reports that as zero rows)"
  ),
  Conflict: jsonContent(errorSchema, "Conflicts with existing state"),
  Unprocessable: jsonContent(
    errorSchema,
    "Well-formed but not ready for this action (e.g. an incomplete draft)"
  ),
  RateLimited: {
    ...jsonContent(errorSchema, "Too many requests"),
    headers: {
      "Retry-After": {
        description: "Seconds until the next request is allowed",
        schema: { type: "integer", minimum: 1 },
      },
    },
  },
};

const BY_STATUS = {
  400: "BadRequest",
  401: "Unauthorized",
  403: "Forbidden",
  404: "NotFound",
  409: "Conflict",
  422: "Unprocessable",
  429: "RateLimited",
} as const;

export type ErrorStatus = keyof typeof BY_STATUS;

export function errorResponses(...statuses: ErrorStatus[]) {
  return Object.fromEntries(
    statuses.map((status) => [
      status,
      { $ref: `#/components/responses/${BY_STATUS[status]}` },
    ])
  );
}

// Everything the generator can't read off the routes themselves.
export const openApiDocumentation: GenerateSpecOptions["documentation"] = {
  openapi: "3.1.0",
  info: {
    title: "Bluelearn API",
    version: "0.1.0",
    description:
      "Hono API in front of Supabase/Postgres. The frontend never talks to " +
      "Supabase directly; every call goes through here and carries the user's " +
      "JWT so Postgres RLS enforces access.",
  },
  servers: [
    { url: "http://localhost:8787", description: "Local dev (pnpm dev:api)" },
  ],
  tags: [
    {
      name: "identity",
      description: "The caller's own profile (/me) and public profiles",
    },
    {
      name: "guides",
      description: "Topics (guide bases) and their canonical content",
    },
    { name: "variants", description: "Methods/alternatives under a topic" },
    {
      name: "guide-revisions",
      description: "Per-guide version history snapshots",
    },
    { name: "objectives", description: "Curated curricula" },
    {
      name: "objective-revisions",
      description: "Objective version history and node editing",
    },
    { name: "graph", description: "Prerequisite edges and TODO prerequisites" },
    { name: "subjects", description: "Subject tags over the global graph" },
    { name: "reviews", description: "Review cases, panels, and decisions" },
    { name: "media", description: "Object-storage uploads" },
    {
      name: "search",
      description: "Full-text search over guides and objectives",
    },
  ],
  components: {
    responses: sharedErrorResponses,
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "Supabase access token. Forwarded to Postgres so RLS applies.",
      },
    },
  },
};
