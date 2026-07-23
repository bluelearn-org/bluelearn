// Reconciles the local Typesense instance with the desired collection schemas
// and backfills them from Postgres. Idempotent: safe to run any time.
//
//   pnpm --filter api search:sync            create collections if missing;
//                                            backfill only the empty ones
//   pnpm --filter api search:sync --force    drop, recreate, and reindex all
//
// Reads TYPESENSE_* and SUPABASE_* config from api/.dev.vars.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/database.types.ts";
import {
  guidesCollectionSchema,
  objectivesCollectionSchema,
  stripNulls,
  SEARCH_DOC_SELECT,
  OBJECTIVE_DOC_SELECT,
  type SearchDocument,
} from "../src/services/search.service";
import { buildGuideListItems } from "../src/services/guide.service";
import { buildObjectiveListItems } from "../src/services/objective.service";

type DB = SupabaseClient<Database>;

// .dev.vars is dotenv-format; parse it directly so the script needs no deps
// and uses the exact same values as the Worker.
function loadDevVars() {
  const path = resolve(import.meta.dirname, "../.dev.vars");
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/);
    if (match && !line.trimStart().startsWith("#")) {
      process.env[match[1]] ??= match[2].replace(/^["']|["']$/g, "");
    }
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} — set it in api/.dev.vars`);
    process.exit(1);
  }
  return value;
}

loadDevVars();
const force = process.argv.includes("--force");

const typesenseUrl = `${requireEnv("TYPESENSE_PROTOCOL")}://${requireEnv("TYPESENSE_HOST")}:${requireEnv("TYPESENSE_PORT")}`;
const headers = {
  "X-TYPESENSE-API-KEY": requireEnv("TYPESENSE_API_KEY"),
  "Content-Type": "application/json",
};

async function typesense(method: string, path: string, body?: string) {
  let res: Response;
  try {
    res = await fetch(`${typesenseUrl}${path}`, { method, headers, body });
  } catch {
    console.error(
      `Cannot reach Typesense at ${typesenseUrl} — is the container running? (docker compose up -d in api/)`
    );
    process.exit(1);
  }
  return res;
}

async function ensureCollection(schema: {
  name: string;
}): Promise<{ numDocuments: number }> {
  const existing = await typesense("GET", `/collections/${schema.name}`);

  if (existing.ok && force) {
    console.log(`--force: dropping collection "${schema.name}"`);
    await typesense("DELETE", `/collections/${schema.name}`);
  } else if (existing.ok) {
    const info = (await existing.json()) as { num_documents: number };
    return { numDocuments: info.num_documents };
  } else if (existing.status !== 404) {
    console.error(
      `Typesense error ${existing.status}: ${await existing.text()}`
    );
    process.exit(1);
  }

  const created = await typesense(
    "POST",
    "/collections",
    JSON.stringify(schema)
  );
  if (!created.ok) {
    console.error(
      `Failed to create collection: ${created.status} ${await created.text()}`
    );
    process.exit(1);
  }
  console.log(`Created collection "${schema.name}"`);
  return { numDocuments: 0 };
}

async function fetchPublishedGuides(supabase: DB): Promise<SearchDocument[]> {
  const { data, error } = await supabase
    .from("guide_bases")
    .select(SEARCH_DOC_SELECT)
    .eq("status", "published");

  if (error) {
    console.error("Failed to load guides from Supabase:", error.message);
    process.exit(1);
  }
  const rows = (data ?? []).filter((row) => row.slug && row.title);
  const items = await buildGuideListItems(supabase, rows);
  return items.map(stripNulls);
}

async function fetchPublishedObjectives(
  supabase: DB
): Promise<SearchDocument[]> {
  const { data, error } = await supabase
    .from("objectives")
    .select(OBJECTIVE_DOC_SELECT)
    .eq("status", "published");

  if (error) {
    console.error("Failed to load objectives from Supabase:", error.message);
    process.exit(1);
  }
  const rows = (data ?? []).filter((row) => row.slug && row.current?.title);
  const items = await buildObjectiveListItems(supabase, rows);
  return items.map(stripNulls);
}

async function indexDocuments(collection: string, docs: SearchDocument[]) {
  if (docs.length === 0) {
    console.log(
      `No published ${collection} in the database — nothing to index.`
    );
    return;
  }

  // Typesense bulk import takes JSONL.
  const jsonl = docs.map((doc) => JSON.stringify(doc)).join("\n");

  const res = await typesense(
    "POST",
    `/collections/${collection}/documents/import?action=upsert`,
    jsonl
  );
  const lines = (await res.text()).trim().split("\n");
  const failures = lines.filter((line) => !line.includes('"success":true'));

  if (!res.ok || failures.length > 0) {
    console.error(`Import finished with ${failures.length} failure(s):`);
    for (const failure of failures.slice(0, 5)) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log(`Indexed ${docs.length} ${collection}.`);
}

const supabase = createClient<Database>(
  requireEnv("SUPABASE_URL"),
  requireEnv("SUPABASE_SECRET_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const targets = [
  { schema: guidesCollectionSchema, fetch: fetchPublishedGuides },
  { schema: objectivesCollectionSchema, fetch: fetchPublishedObjectives },
];

for (const { schema, fetch } of targets) {
  const { numDocuments } = await ensureCollection(schema);
  if (numDocuments > 0) {
    console.log(
      `"${schema.name}" already has ${numDocuments} document(s) — skipping backfill. Use --force to reindex.`
    );
  } else {
    await indexDocuments(schema.name, await fetch(supabase));
  }
}
