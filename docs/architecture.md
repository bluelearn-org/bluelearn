# Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                              browser                                │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  HTTPS
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  app/   React 19 · TanStack Start · TanStack Router/Query           │
│         shadcn/ui · Tailwind 4 · Vite                                │
│                                                                      │
│  Routes call the API via the Hono `hc<AppType>` client — fully       │
│  type-safe end-to-end from handler to component.                     │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  fetch (typed via hc<AppType>)
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  api/   Hono on Cloudflare Workers                                   │
│         Routes: /subjects · /walkthroughs · /guides                  │
│         Middleware: cors, supabaseMiddleware (auth), rateLimit (POST /guides) │
│         Validation: @hono/zod-validator                              │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  PostgREST / RPC
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  supabase/   Postgres · Auth · Storage                               │
│              Migrations in supabase/migrations/                      │
│              RLS policies enforce per-user access                    │
└──────────────────────────────────────────────────────────────────────┘
```

## Why this split

- **Workers for the API.** Cloudflare Workers gives us global edge
  execution and zero cold starts. Hono is small and fast — the right size
  for thin handlers that mostly delegate to Supabase.
- **Supabase for storage + auth.** A managed Postgres with RLS,
  GoTrue-based auth, and Storage means we don't reinvent any of it. We can
  always lift the lid (it's just Postgres) when we need to.
- **TanStack Start on the front.** SSR for SEO on concept pages,
  type-safe routing, cache-aware data via TanStack Query, accessible
  primitives via shadcn/ui.
- **Type safety across the wire.** Hono exports `AppType` from
  `api/src/index.ts`. The frontend imports it via `hc<AppType>` and gets
  full type-checking on every request and response — including zod-validated
  bodies. No code generation step.

## Boundaries

- `app/` never talks to Supabase directly. Everything goes through `api/`
  so auth, validation, and rate limits stay in one place.
- `api/` is mostly stateless. State lives in Postgres; cached state lives
  in Workers KV (when we add it).
- Shared types between `app` and `api` — today, via Hono's `AppType`
  export. As we accrete domain types, they'll move into `packages/types/`.

## Authentication

Supabase issues JWTs on sign-in. The frontend sends them on requests.
`supabaseMiddleware` in the API verifies the token and attaches the
user to `c.var.user`. Handlers then proxy to Supabase using a per-request
client scoped to that user — so RLS does the heavy lifting and the API
doesn't have to re-encode every policy.

## Phase 3 R&D (out of current scope)

Decentralized verification: signing the editorial history into a
verifiable log so a third party can confirm the canonical version. Tools
under exploration: SUI / Move (smart contracts) and Walrus (content
storage). Bonus skill area for contributors interested — not on the
critical path for Phase 1 or 2.

## Canonical promotion
A guide base's canonical_guide_id points at the variant readers see bydefault. The first published variant becomes canonical (set inclose_review_panel), after that, the pointer will be able to move to a siblingvariant that beats the top guide on votes.

Ranking uses the lower bound of a Wilson score interval (95% confidence by default) over each variant's up / down tally, (NOT THE RAW RATIO FOR VOTES), a variant with 2 up / 0 down should not outrank one with 50 up / 2 down for example. The Wilson lower bound is computed in SQL by the promote_canonical_guidefunction so the whole read-rank-write cycle will run in one transaction under a row lock on guide_bases.

Three guards prevent canonical flipping on each and every vote:

* A minimum vote floor of by default 5, challengers below this minimum floor will be ignored;
* Must strictly be the leading guide, a challenging guide MUST have it's Wilson lower bound be higher than the current leader's, ties not included.
A challenging guide must lead the current leader's by (by default) 0.05.

Promotion runs eagerly in castVote and retractVote ( with one extra RPC per vote) and lazily on the cron tick (promoteAllCanonicals), this to reconcile any missed eager calls. The cron path mirrors assemblePendingPanels: making it so one base failing does not stall the rest.
