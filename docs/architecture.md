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
