# Contributing to BlueLearn

Thanks for being here. This document is the whole
contributor path, from "I want to help" to "my change is merged."

> If you only read one thing: open an issue or ping `#contributing` on
> [Discord](https://discord.gg/bluesystem) **before** large changes. The
> conversation saves you (and reviewers) a lot of time.

## Table of contents

- [Ways to contribute](#ways-to-contribute)
- [Your first contribution](#your-first-contribution)
- [Licensing and sign-off](#licensing-and-sign-off)
- [Development setup](#development-setup)
- [Repository layout](#repository-layout)
- [Working on the code](#working-on-the-code)
  - [PR naming](#pr-naming)
  - [Branch naming](#branch-naming)
  - [Commit messages](#commit-messages)
  - [Code style and linting](#code-style-and-linting)
  - [Tests](#tests)
- [Opening a pull request](#opening-a-pull-request)
- [Review process](#review-process)
- [Content contributions](#content-contributions)
- [Substantial proposals (RFCs)](#substantial-proposals-rfcs)
- [Reporting bugs](#reporting-bugs)
- [Security issues](#security-issues)
- [Code of conduct](#code-of-conduct)
- [Decision-making and governance](#decision-making-and-governance)

---

## Ways to contribute

Code is one path among many. The project needs all of these and treats
them as equal:

- **Code** — backend (`api/`), frontend (`app/`), database (`supabase/`),
  infrastructure, CI.
- **Documentation** — clarifying setup, fixing examples, writing tutorials,
  improving inline JSDoc / TSDoc / migration comments.
- **Triage** — reproducing bugs, asking clarifying questions on issues,
  tagging, closing duplicates. Quietly heroic work.
- **Reviews** — even one careful "have you thought about X?" comment on a PR
  is a contribution.
- **Design** — UI/UX critique, accessibility audits, dark mode, prefers-
  reduced-motion, mobile patterns.
- **Editorial** — concept summaries, prerequisite graph proposals (once the
  in-platform editor ships).
- **Translation** — once i18n lands in Phase 2.
- **Community** — answering questions on Discord, writing posts, giving talks.

You don't need to ask permission for any of these. Just start.

---

## Your first contribution

If you're new, the fastest path:

1. Find an issue labelled
   [`good first issue`](https://github.com/bluelearn-org/bluelearn/labels/good%20first%20issue)
   or [`help wanted`](https://github.com/bluelearn-org/bluelearn/labels/help%20wanted).
2. Comment on it: *"I'd like to take this"*. A maintainer will assign you
   within 48 hours (usually faster).
3. Follow [Development setup](#development-setup) below.
4. Open a draft PR early — even with a one-line change. We'd rather
   give you feedback at 10% than at 100%.

No issue caught your eye? Open one describing what you want to work on. We
respond within a week, usually within a day or two.

---

## Licensing and sign-off

BlueLearn is dual-licensed:

- **Source code** — [AGPL-3.0-or-later](LICENSE). Copyleft for networked
  services: forks hosted as a service must publish their source.
- **Educational content** (concepts, summaries, illustrations) —
  [CC BY-SA 4.0](LICENSE-CONTENT). Attribution + share-alike.

By submitting a contribution you agree your work is licensed under the
applicable license above and that you have the right to submit it.

**Sign-off (DCO):** every commit must be signed off with
[`git commit -s`](https://developercertificate.org/). This appends a
`Signed-off-by:` line and is your statement that you have the right to
submit the change under the project's licenses. We do not require a CLA —
the DCO is enough.

---

## Development setup

### Prerequisites

- [Node.js](https://nodejs.org/) **20+**
- [pnpm](https://pnpm.io/) **10+** (`npm install -g pnpm`)
- [Supabase CLI](https://supabase.com/docs/guides/local-development) (for
  local Postgres + Auth)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) — comes
  with the `api/` package

### Fork, clone, install, run
Fork the repository to your own GitHub account, then run the following commands in your terminal.

```bash
git clone https://github.com/<your-username>/bluelearn.git
cd bluelearn
pnpm install
```

Start Supabase (local Postgres on `:54322`, Auth on `:54321`):

```bash
pnpm supabase:start
```

Copy the example env files and fill in the values the CLI printed:

```bash
cp api/.dev.vars.example api/.dev.vars
cp app/.env.example app/.env
```

Then in two terminals (or your favourite runner):

```bash
pnpm dev:api      # Workers dev server  http://localhost:8787
pnpm dev:app      # Vite dev server     http://localhost:3000
```

The Vite dev server proxies API calls so you don't need to fight CORS in
development. See `app/vite.config.ts` for the proxy config.

---

## Repository layout

```
bluelearn/
├── app/         Frontend — React 19 + TanStack Start + shadcn/ui
├── api/         Backend — Hono on Cloudflare Workers
├── supabase/    Schema, migrations, local config
├── docs/        Architecture notes, design discussions, open questions
├── .github/     Issue templates, PR template, workflows, CODEOWNERS
└── README.md
```

Read [`docs/architecture.md`](docs/architecture.md) for the system
overview and [`docs/monorepo.md`](docs/monorepo.md) for why the repos
were consolidated.

---

## Working on the code

### PR naming
```
<type>(<scope>):<short description>
Where `<type>` is one of: `feat`, `fix`, `docs`, `refactor`, `chore`,
`test`, `perf`, `ci` and short description matches the issue title where possible.

Examples:

- `feat(app):integrate search route`
- `fix(api)auth redirect loop`
- `docs: simplify overall system doc`

```

### Branch naming

```
<type>/<short-kebab-description>
```

Where `<type>` is one of: `feat`, `fix`, `docs`, `refactor`, `chore`,
`test`, `perf`, `ci`.

Examples:

- `feat/concept-prefetch`
- `fix/auth-redirect-loop`
- `docs/architecture-update`

### Commit messages

We loosely follow [Conventional Commits](https://www.conventionalcommits.org/).
Not enforced — readable history is what matters.

```
<type>(<scope>): <imperative summary, < 70 chars>

<optional body explaining *why*, wrapped at 72 chars>

<optional footer — Closes #123, BREAKING CHANGE: ...>

Signed-off-by: Your Name <you@example.com>
```

Good commit messages:

- ✅ `feat(api): cache prereq walks for 60s at the edge`
- ✅ `fix(app): prevent infinite loop when concept slug is empty`
- ✅ `docs: clarify Supabase reset workflow`

Less good:

- ❌ `update stuff`
- ❌ `WIP`
- ❌ `fixed bug`

### Code style and linting

- **Frontend** — Prettier + ESLint. `pnpm --filter app format` and
  `pnpm --filter app lint` before committing.
- **Backend** — TypeScript strict mode. `pnpm --filter api exec tsc --noEmit`.
- **No reformatting drive-bys.** If you're fixing a bug, fix the bug. Don't
  reformat 80 unrelated files in the same PR.
- **No `// @ts-ignore` or `// @ts-expect-error`** without a one-line comment
  explaining *why*.
- **Path aliases** — `@/` maps to `src/` in `app/`. Always import via `@/lib/x`,
  never `../../../lib/x`.

### Tests

- New behaviour gets a test. New endpoint → at least one happy-path
  integration test. New component → at least a render test.
- We use **Vitest** in `app/` and (eventually) in `api/`.
- Run with `pnpm --filter app test`.
- Manual verification in a browser is also expected — exercise the golden
  path and the obvious edge cases.

---

## Opening a pull request

1. Fork the repo (or push a branch if you have write access).
2. Make your changes on a feature branch (see [Branch naming](#branch-naming)).
3. Run typecheck, lint, build, and tests locally — `pnpm typecheck && pnpm lint && pnpm build && pnpm test`.
4. Push and open a PR against `main`.
5. Fill in the PR template. The "Why" matters more than the "What" —
   reviewers can read the diff.
6. Mark as **Draft** if you're still iterating. Move to **Ready for review**
   when you want eyes.
7. Link the issue: *"Closes #123"* in the description so it auto-closes on merge.

### PR scope

Keep PRs focused. Refactors, feature work, and dependency bumps belong in
**separate** PRs. The reviewer's job gets exponentially harder as scope
grows.

A useful test: can you describe the PR in one sentence without using "and"?
If no, split it.

---

## Review process

- **Response time** — a maintainer will leave a first comment within
  **5 business days**. If 5 days pass with no response, ping
  `#contributing` on Discord. We sometimes drop the ball; gentle nudges help.
- **Approvals** — one maintainer approval is enough for most changes. Two
  for: changes to `api/src/middleware/`, the database schema, RLS policies,
  CI workflows, or anything touching auth.
- **CI must be green.** No merging on red.
- **Squash merge by default.** The squashed commit message uses the PR
  title — make it a good one.
- **Rebase or merge `main` into your branch** if it falls behind. Don't
  let conflicts pile up.

---

## Content contributions

The in-platform content pipeline (concept editing, verifier juries,
moderation) is still being designed. Until that ships, propose content
structure via the **Guide proposal** issue template.

When the platform is live, concept and walkthrough contributions will go
through the verifier-jury pre-publish review and the vote-based
post-publish moderation described in
[`docs/overall-system.md`](docs/overall-system.md). Repository PRs are not
the long-term path for editorial content.

---

## Substantial proposals (RFCs)

For changes that are too big for a single PR — new subsystems, API
redesigns, governance changes — write a short proposal first.

Today: open an issue using the **Feature request** template and tag it
`rfc`. A `bluelearn-org/rfcs` repo with a real template is on the
roadmap; until then, the issue is the proposal.

---

## Reporting bugs

- **Search [open](https://github.com/bluelearn-org/bluelearn/issues?q=is%3Aopen+is%3Aissue+label%3Abug)
  and [closed](https://github.com/bluelearn-org/bluelearn/issues?q=is%3Aclosed+is%3Aissue+label%3Abug)
  issues first** — your bug may already be tracked or fixed.
- Use the **Bug report** issue template. The template prompts you for what
  reviewers need to reproduce: steps, expected vs actual, environment.
- For **security** vulnerabilities, do **not** open a public issue. See
  [SECURITY.md](SECURITY.md).

---

## Security issues

Read [`SECURITY.md`](SECURITY.md). Short version: email
**security@bluelearn.org** with details. We acknowledge within 72 hours.

---

## Code of conduct

This project follows the [Contributor Covenant 2.1](CODE_OF_CONDUCT.md).
By participating you agree to abide by its terms. Report violations
privately to **conduct@bluelearn.org**.

---

## Decision-making and governance

How decisions get made, who has merge rights, how disagreements get
resolved: [`GOVERNANCE.md`](GOVERNANCE.md).

In one line: BlueLearn is a benevolent-dictator-for-now model that's
moving toward a small steering committee as the contributor pool grows.

---

Thanks for reading this far. We mean it about the Discord ping — it's the
fastest way to make sure your time gets spent on something the project
actually needs.
