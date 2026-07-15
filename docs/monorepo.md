# Why a monorepo

Bluelearn started across two separate GitHub repos:

- **`blue-prototype`** — pnpm workspace with `api/` (Hono on Workers) and
  an early `app/` (Vite), plus `supabase/` migrations.
- **`blue-frontend`** — the newer React 19 + TanStack Start + shadcn/ui
  frontend, designed to replace `blue-prototype/app/`.

Operating two repos created the standard split-repo problems. The monorepo
fixes them at once.

## The problems

### API contract drift

The frontend's TypeScript types and the backend's request/response shapes
were edited in two repos. Hono's `hc<AppType>` client gets us type safety
when both are on disk together, but across two repos a published-API-types
package never quite landed, so changes drifted until something broke at
runtime.

### Non-atomic cross-stack changes

Renaming a field on a `Concept` model touches:

- a Supabase migration
- a Hono route handler + zod schema
- a generated `database.types.ts`
- a TS interface in the frontend
- the component that renders the field

In split repos that's three PRs landing in three orders. In a monorepo it's
one PR with all the files, one CI run, one review.

### Onboarding friction

A new contributor had to clone two repos, set up two toolchains, configure
two `.env` files, and figure out how the API URL got wired between them.
"Most" of that was documented, but "most" isn't "all" and people bounced.

### Shared utility forking

A `cn()` helper. A date formatter. A logger. Each got rebuilt in both repos
because there was no clean place to put a shared package without inventing
a third repo.

### CI/CD complexity

Two pipelines, two preview-deploy systems, two release flows. An end-to-end
test that spanned the stack required spinning both repos up by hand.

## What the monorepo gives us

- **One clone** to get the whole stack running locally.
- **One PR** to land a change across DB → API → UI.
- **One CI** that runs `api` and `app` jobs in parallel.
- **One issue tracker** so a bug can't fall between repos.
- A natural home for shared packages when we need them
  (`packages/types`, `packages/ui`, etc.) — not added yet, but the door is open.

## What it does NOT mean

- **Not one deploy.** Each app still ships independently:
  - `app/` → Vercel (Vite SSR or static)
  - `api/` → Cloudflare Workers (via `wrangler deploy`)
  - `supabase/` → applied to the Supabase project
- **Not one language.** TypeScript throughout, but per-package tooling
  (eslint, vitest, wrangler) stays sharp.
- **Not "the marketing site too."** The marketing site at
  `bluelearn.org` lives in `bluelearn-org/marketing` (private). Different
  audience, different deploy cadence, no shared code.

## What stays out of this repo

- `bluelearn-org/marketing` — marketing site + the Discord-stats Cloudflare
  Worker that serves it.
- Long-form RFCs and design docs — those land in `bluelearn-org/rfcs` if
  and when that repo gets created.

## Migration

Done in one step: this repo IS the consolidation. The old repos
(`blue-prototype`, `blue-frontend`) get archived with READMEs pointing here.
