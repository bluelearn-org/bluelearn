# AGENTS.md

## Project at a glance

Open-source, prerequisite-graph education platform. pnpm monorepo with three
workspace packages:

| Package | Path | What it is |
|---|---|---|
| `app` | `app/` | React 19 · TanStack Start (SSR) · TanStack Router · shadcn/ui · Tailwind 4 · Vite |
| `api` | `api/` | Hono on Cloudflare Workers · OpenAPI auto-generated · Zod validation |
| `@bluelearn/schemas` | `packages/schemas/` | Shared Zod schemas (requests, responses, enums) consumed by both app and api |

Database: Supabase (Postgres 17, GoTrue Auth, RLS). Search: Typesense (separate service).

## Commands

All run from the repo root via pnpm.

```bash
pnpm install                 # install all deps
pnpm dev                     # app (port 3000) + api (port 8787) in parallel
pnpm dev:app                 # frontend only (Vite)
pnpm dev:api                 # API only (wrangler dev + tsc --watch)

pnpm build                   # build all packages
pnpm typecheck               # typecheck all packages
pnpm lint                    # lint all packages
pnpm format                  # prettier --write
pnpm format:check            # prettier --check (CI uses this)
pnpm test                    # test all packages (Vitest)
```

### Single-package commands

```bash
pnpm --filter app typecheck
pnpm --filter app lint
pnpm --filter app test
pnpm --filter app build

pnpm --filter api typecheck
pnpm --filter api lint
pnpm --filter api test
pnpm --filter api exec vitest run        # run API tests directly

pnpm --filter @bluelearn/schemas typecheck
pnpm --filter @bluelearn/schemas lint
```

### Database

```bash
pnpm supabase:start          # requires Docker
pnpm supabase:stop
pnpm supabase:reset          # drop + recreate + reseed
pnpm supabase:types          # regenerate api/src/database.types.ts (local)
pnpm supabase:types:remote   # regenerate from hosted Supabase
```

### Deployment

```bash
pnpm api:deploy              # wrangler deploy
```

### CI order (per package)

CI runs these jobs in parallel across packages:
- **format**: `pnpm format:check`
- **app**: typecheck → lint → test → build
- **api**: typecheck → lint → dry-deploy (`wrangler deploy --dry-run`)
- **schemas**: typecheck → lint

## Environment setup

Two env files, different prefixes:

1. Copy `api/.dev.vars.example` → `api/.dev.vars` (Supabase URL, keys, Typesense, APP_URL)
2. Copy `app/.env.example` → `app/.env` (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_API_BASE)
3. Fill values from `pnpm supabase:start` output.

**Critical**: Frontend env vars use `VITE_` prefix; API vars are plain. They are NOT interchangeable.

## Architecture

```
browser → app (Vite SSR, port 3000) → api (Wrangler, port 8787) → Supabase (Postgres + Auth)
```

- **app/** never talks to Supabase directly. All data flows through api/.
- **api/** is stateless; state lives in Postgres. Rate limiter uses a Durable Object (SQLite-backed), falls back to in-memory in dev/test.
- **Type safety**: `api/src/index.ts` exports `AppType`. The frontend imports it via `hc<AppType>()` for fully typed HTTP calls (request + response + validated body).

### API middleware stack

Applied in order: CORS → global rate limit (READ) → `supabaseMiddleware()` → per-route auth (`requireUser`) → per-route rate limits → `validate()` (Zod).

Routes mounted before `supabaseMiddleware()` (e.g., `/avatar`) are unauthenticated.

### Key files

| File | Why it matters |
|---|---|
| `api/src/index.ts` | AppType export, route mounting, cron entry point |
| `api/src/types.ts` | Bindings type (env vars) |
| `api/src/middleware/auth.middleware.ts` | `supabaseMiddleware`, `requireUser` |
| `api/src/middleware/rateLimits.ts` | Rate limit presets (CREATE, READ, SEARCH, etc.) |
| `app/src/lib/api/apiClient.ts` | Hono typed client with auto auth headers |
| `app/src/lib/authContext.tsx` | `useAuth()`, `useRequireRole()` |
| `packages/schemas/src/` | All shared Zod schemas (guides, objectives, subjects, etc.) |
| `api/src/database.types.ts` | Generated Postgres types — regenerate after schema changes |

### Cron triggers

- Every 5 min: `assemblePendingPanels`, `sweepExpiredReviewSeats`
- Every 12 hours: `promoteAllCanonicals`

## Conventions

### Branching and commits

- Branch: `<type>/<short-kebab>` (e.g., `feat/concept-prefetch`)
- PR title: `<type>(<scope>): <description>` where type is `feat|fix|docs|refactor|chore|test|perf|ci`
- Commits: Conventional Commits style, not enforced. Must include `Signed-off-by:` (`git commit -s`).

### Code style

- **Prettier**: double quotes, semicolons, 2-space indent, trailing commas (es5), LF line endings.
- **Path alias**: `@/` maps to `app/src/`. Always use `@/lib/x`, never `../../../lib/x`.
- **No `// @ts-ignore`** without a comment explaining why.
- **No drive-by reformatting** in bug-fix PRs.
- **Tailwind classes**: Use `cn()` from `app/src/lib/utils.ts` for conditional classes. Prettier sorts Tailwind via plugin.

### Frontend routing

File-based with TanStack Router in `app/src/routes/`. Layout routes use `<Outlet>`. Routes marked `ssr: false` are client-only (e.g., review). Loaders use `loader: async ({ abortController }) => {...}`.

### API route pattern

Each resource is a Hono router in `api/src/routes/`. Pattern:
```typescript
export const fooRouter = new Hono<HonoEnv>()
  .get("/", describeRoute({...}), validate("query", schema), handler)
  .post("/", describeRoute({...}), requireUser, rateLimitMiddleware({...}), validate("json", schema), handler);
```

Services live in `api/src/services/*.service.ts`, throw `ServiceError` for HTTP failures.

### Database

- Migrations: timestamp-prefixed `.sql` files in `supabase/migrations/`.
- Complex operations are PostgreSQL RPCs (defined in migrations, called via Supabase client).
- RLS policies enforce per-user access. API uses per-request Supabase client with the user's JWT.
- After schema changes: `pnpm supabase:types` to regenerate `api/src/database.types.ts`.

### Tests

- **App**: Vitest with `--passWithNoTests`. Tests in `app/src/lib/__tests__/`.
- **API**: Vitest in `api/tests/`. Tests create real users via `admin.auth.admin.createUser()` and run against the local Supabase DB. Factory helpers in `api/tests/factories/`.
- **OpenAPI validation**: `api/tests/openapi.ts` validates responses against generated spec.

## Gotchas

- Docker must be running for `supabase start`.
- `api/src/database.types.ts` is generated, not hand-written. Regenerate after any migration.
- API CORS only allows `APP_URL` from `.dev.vars`. Wrong value = silent CORS failures.
- The `RATE_LIMITER` Durable Object binding is optional in dev. Tests run without it and use in-memory counters.
- The app's `typecheck` script runs `pnpm --filter api build` first (builds API declarations needed for `AppType` import). This is intentional.
- `app/src/routeTree.gen.ts` is auto-generated by TanStack Router. Never edit it manually.
- `api/src/database.types.ts` and `app/src/routeTree.gen.ts` are both in `.prettierignore`.

## Instruction sources

- `CONTRIBUTING.md` — full contributor guide (setup, PR process, review expectations)
- `.github/copilot-instructions.md` — companion file with similar guidance for Copilot
- `docs/architecture.md` — system diagram and boundary rationale
- `docs/monorepo.md` — why one repo instead of three
- `.github/workflows/ci.yml` — CI pipeline definition
