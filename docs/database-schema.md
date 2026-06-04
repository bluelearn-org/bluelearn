# Database Schema

This doc serves as the file for laying out the database schema for this site. This is still a work in progress and is subject to change.

## Purpose

BLUE stores one global graph of canonical guides. A guide is a node in the learning graph, and its content lives in its variants (the original write-up plus any methods and alternatives), one of which the guide designates as canonical. The graph is used to derive subject views, frontiers, walkthroughs, levels, and reachability.

The schema deliberately keeps the database source of truth small:

- Store guides and their guide-to-guide relationships.
- Store subjects as tags on guides, not as separate trees.
- Store methods and alternatives under their parent guide.
- Store version history for guides, methods, and alternatives.
- Store governance records (votes, review cases, panels, decisions) as ground truth.
- Do not store values that can be derived from the graph.

### `profiles`

- `id`: primary key, references the auth user.
- `username`: unique URL handle.
- `created_at`: row creation time.
- `updated_at`: last update time, maintained by a trigger.
- `display_name`: optional human-facing name, separate from the unique `username` handle.
- `bio`: optional short profile text.
- `role`: governance role. Role enum `learner | maintainer | admin`.
- `is_suspended`: optional flag for moderation actions against a member, kept separate from `role` so a role is not silently lost.

See [Roles and Permissions](#roles-and-permissions) for what each role can do. 

### `guides`

A guide is the graph node. It stores no content of its own, as all content lives in its variants. The guide points to which variant is currently canonical via `canonical_variant_id`.

- `id`: primary key of the guide; the node identity in the graph.
- `canonical_variant_id`: nullable FK to `guide_variants`. Points at the variant currently designated canonical, which is decided from a upvote/downvote system. Null before any variant is published. Creates a guide ↔ variant pointer cycle (guides → variants → guides), so the FK should be deferrable.
- `slug`: stable URL identifier.
- `title`: human-readable guide title.
- `knowledge_type`: `theory` (a grand explanation of something we can observe) or `practice` (a route to a specific, well-defined goal). Determines how the guide is structured and what its variants are called: `practice` variants display as **methods**, `theory` variants as **alternatives**.
- `status`: draft lifecycle state (see enum below).
- `created_at`: row creation time.
- `updated_at`: last update time.
- `forked_from_guide_id`: nullable self-reference. When a cross-subject conflict resolves into a **spin-off** (see `overall-system.md`), the guide forks into a subject-specific version. This makes the spin-off an explicit, governed exception to "one canonical guide per topic" instead of looking like an accidental duplicate. In practice, there will be a message/indicator in the guide itself saying something like "forked from {original-guide-title}".

Status enum values are:

- `draft` — no variant has been published yet; `canonical_variant_id` is null.
- `published` — live; `canonical_variant_id` points at a published variant.
- `archived` — deliberately retired; `canonical_variant_id` is left untouched so the last canonical content stays retrievable.

### `guide_variants`

Methods, alternatives, and the guide's original write-up all live here as **variants** of the topic. Each variant is its own page with its own URL, revision history, and votes. The guide designates one of them canonical via `guides.canonical_variant_id`. 

- `id`: primary key of the variant.
- `parent_guide_id`: the parent guide this variant lives under.
- `slug`: stable URL identifier for the variant.
- `summary`: short description for lists and previews. A guide's list, frontier, and walkthrough preview uses its canonical variant's summary.
- `current_revision_id`: nullable FK to `guide_variant_revisions`; points at this variant's live `accepted` revision, null before the variant is first published. Creates a variant↔revision pointer cycle, so the FK should be deferrable.
- `status`: node-level disposition (`draft | published | archived`); same shape as `guides.status`.
- `author_id`: the variant's original author.
- `created_at`: row creation time.
- `updated_at`: last update time.

Ordering among sibling variants under the same parent is **derived** from votes, not stored here.

### `guide_variant_revisions`

The single content store: immutable, append-only version history for all variant content (the original write-up plus methods and alternatives). Every edit inserts a new row; revision content is never updated or deleted. This is what powers the history view, the change log, diffs between versions, and rollback. See [Snapshots vs. Deltas](#snapshots-vs-deltas) for a comparison between the two methods behind variant revisions. 

- `id`: primary key of the revision row.
- `variant_id`: which variant this revision belongs to (many revisions to one variant).
- `revision_number`: per-variant counter (1, 2, 3, ...), unique with `variant_id`.
- `body`: the full variant content (markdown) as of this revision. Media is referenced by URL, not embedded, so large assets live in object storage rather than in the row.
- `change_summary`: author's note describing what changed in this revision (like a commit message). Drives the "what changed" entry in the history list.
- `author_id`: who wrote this specific revision. May differ from the variant's original author, which is how edit credit spreads across contributors.
- `created_at`: when this revision was written.
- `status`: draft lifecycle state (see enum below).

Status enum values are:

- `draft` — being written, not yet submitted.
- `in_review` — submitted; a verifier panel is judging this revision.
- `accepted` — passed review. Multiple revisions can be `accepted` over a variant's life; the one currently live is whichever `current_revision_id` points at.
- `rejected` — this revision attempt was returned by the panel. The author iterates with a new revision; the variant stays `draft` (if never published) or keeps serving its current revision (if already published).

Note `published` is deliberately **not** a revision value. "Published" describes the variant/guide node, while a revision that cleared review is `accepted`. A revision also never becomes `archived`; archiving happens at the variant or guide level.

**Rollback.** Rollback never deletes newer rows. It inserts a new revision that copies an older one's content. Through this, the version history shows that a rollback occurred through the change_summary.

### `guide_edges`

Relationships between guides. This table *is* the global graph.

- `id`: primary key of the edge row.
- `from_guide_id`: the source guide of the edge.
- `to_guide_id`: the target guide of the edge.
- `edge_type`: what kind of relationship this edge represents (see allowed types below).

For prerequisite edges, direction means:

```text
from_guide_id -> to_guide_id
```

Example:

```text
Arithmetic -> Algebra
edge_type = prerequisite
```

That means Arithmetic must be understood before Algebra.

Allowed edge types right now are:

- `prerequisite`
- `related`

Only `prerequisite` edges form the learning DAG. Walkthrough generation, level computation, frontier detection, and reachability checks must ignore other edge types. 

There must be a trigger that prevents cycles among prerequisite edges. Related edges may be cyclic because they do not define learning order. Related edges are used for "related" or "see also" links, discovery/navigation, and contextual suggestions. See [Related Edges in Practice](#related-edges-in-practice) for how the directed table represents these undirected links.

### `subjects`

Subject tags, such as Math, Physics, or Game Development. Subjects are not containers and do not own guides. They are filters over the global guide graph.

- `id`: primary key of the subject.
- `slug`: stable URL identifier for the subject (e.g. `game-development`).
- `name`: human-readable subject name (e.g. `Game Development`).

### `guide_subjects`

Many-to-many join table between guides and subjects. Lets one canonical guide appear in multiple subject views without duplicating content.

- `guide_id`: the tagged guide.
- `subject_id`: the subject tag applied to it. The pair `(guide_id, subject_id)` is the primary key, so a guide cannot carry the same tag twice.

Example:

```text
Guide: Vectors
Subjects: Math, Physics, Game Development
```

### `todo_prerequisites`

Missing prerequisite topics declared by authors when a real guide does not exist yet. Also acts as a recruitment surface for guides that still need writing.

- `id`: primary key of the TODO entry.
- `dependent_id`: the dependent guide that declares the need.
- `title`: the named missing prerequisite topic (free text, no guide exists yet).
- `status`: `open` while unfilled, `resolved` once a real guide is created for the topic.
- `resolved_guide_id`: the guide that fulfilled this TODO, set when `status` becomes `resolved`; null while open.
- `created_at`: when the TODO was declared.

Example:

```text
Dependent guide: Newton's laws
TODO prerequisite: Vectors
status = open
```

Because walkthrough and level generation use the **longest** path, redundant transitive edges are harmless to level correctness. Authors typically declare every prerequisite a guide needs, not just the ones one level below, which produces shortcut edges (e.g. `Algebra -> Calculus`) alongside the real chain (`Algebra -> Functions -> Limits -> Calculus`). The longest path dominates, so the guide still lands at its correct deep level; the shortcut cannot pull it up.

What over-declaration does cost is **graph bloat**: redundant edges clutter the DAG, walkthroughs, and diffs. A later **transitive reduction** pass can drop any edge `A -> C` when a longer path `A -> ... -> C` already exists. This is a tidiness optimization, not a correctness requirement, since levels stay correct without it. 

### `votes`

Upvotes and downvotes on variants (the canonical one plus other methods and alternatives). Because all content lives in variants, a variant is the only votable content unit: voting "on the guide" is voting on its canonical variant.

Key fields:

- `id`: primary key of the vote.
- `voter_id`: the user who cast the vote.
- `variant_id`: the variant being voted on (FK to `guide_variants`). A real foreign key, not a polymorphic pointer.
- `direction`: `up` or `down`.
- `reason`: required only on downvotes. Enum mirroring the canonical downvote rubric exactly: `unclear`, `factually_wrong`, `missing_step`, `outdated`, `broken_link`, `prereq_gap`, `wrong_level`, `scope_creep` (covers material outside topic). 
- `note`: optional free-form text.
- `created_at`: when the vote was cast.

Constraints:

- One vote per voter per variant (`unique (voter_id, variant_id)`).
- A check that `reason` is present if and only if `direction = 'down'`.

Display rules: public users see upvote/downvote totals only. The rubric breakdown is visible to maintainers only, enforced by row level security. Variant ordering among siblings is **derived** from net votes, not stored as a rank column.

### `review_cases`, `review_panels`, and `review_decisions`

Verifier gates, post-publish re-reviews, disputes, and appeals all share the same shape: an odd-numbered random panel, a majority outcome, and an independent written justification per member. They share one root object (`review_cases`) plus one panel table and one decision table. Type-specific fields hang off the root in **specialized tables** (`variant_review_cases`, `re_review_cases`, `disputes`, `appeals`), each keyed 1:1 on `case_id`. The root carries what every workflow has in common (lifecycle, who opened it, timestamps); the satellite carries only what that one case type needs.

`review_cases`:

The item being reviewed.

- `id`: primary key of the case.
- `case_type`: what work the case represents: `variant_publish` | `variant_edit` | `dispute` | `appeal` | `re_review`. (All content is a variant now, so one publish/edit pair covers the original write-up and every method/alternative.)
- `status`: lifecycle state: `pending` | `in_review` | `approved` | `rejected`.
- `created_by`: the user who opened the case (author for publish/edit/appeal, filer for dispute).
- `created_at`: when the case was created.
- `updated_at`: when the case status was updated. Updated via a trigger.
- `time_limit`: the maximum time a panel member can take to cast a vote on a case. When the voting window closes with voting spots still empty, the non-voting members are dropped and replaced by other randomly drawn maintainers who will be assigned the same time limit.

`review_panels`:

An odd-numbered random group of maintainers assembled to decide a case.

- `id`: primary key of the panel.
- `case_id`: the case this panel decides (FK to `review_cases`). One case may have many panels.
- `outcome`: the panel's majority decision: `approved` | `rejected`. Null until the panel closes. Both `review_cases` and `review_panels` require a status/outcome column because a review case can have multiple panels in its lifetime.
- `opened_at`: when the panel was assembled.
- `closed_at`: when the panel reached its outcome; null while open.

`panel_members`:

Maintainers seated on a panel. One row per maintainer per panel. Tracks each seat's lifecycle so the time-limit/replacement flow (see `review_cases.time_limit`) is ground truth, not inferred from whether a decision exists.

- `id`: primary key of the seat.
- `panel_id`: the panel this seat belongs to (FK to `review_panels`).
- `member_id`: the maintainer holding the seat (FK to `profiles.id`). 
- `status`: seat lifecycle state (see enum below).
- `assigned_at`: when the maintainer was drawn onto the panel. The time limit counts from here.

Status enum values are:

- `assigned` — seated, vote pending.
- `recused` — stepped down for conflict of interest (see conduct rules in `overall-system.md`).
- `replaced` — dropped and swapped for a new maintainer.
- `completed` — cast a decision.

A `replaced` seat does not delete the row; a new `panel_members` row is drawn for the replacement, so the full seat history of a panel stays auditable.

`review_decisions`:

One panel member's individual vote with its written justification.

- `id`: primary key of the decision.
- `panel_member_id`: the panel seat that cast it (FK to `panel_members`). One decision per seat — a `completed` seat has exactly one decision row. Carries both the panel and the maintainer through the seat, so no separate `panel_id`/`member_id` pair is stored here.
- `decision`: that member's individual choice: `approve` | `reject`.
- `notes`: written justification for the decision.
- `created_at`: when the decision was cast.

`review_decision_reasons`:

Links a decision to one or more rubric reasons → a reviewer can cite several at once (e.g. `hierarchy_issue` **and** `missing_required_information`). 

- `decision_id`: FK to `review_decisions.id`.
- `reason`: the rubric item cited by the reviewer: `hierarchy_issue` | `factual_error` | `duplicate_content` | `scope_violation` | `clarity_issue` | `missing_required_information`.

A `reject` decision must have at least one row here; an `approve` has none. 

#### Specialized case tables

Each attaches type-specific data to a `review_cases` row. `case_id` is both primary key and FK to `review_cases` → one satellite row per case.

`variant_review_cases` (for `variant_publish`, `variant_edit`):

- `case_id`: PK and FK to `review_cases`.
- `variant_revision_id`: FK to `guide_variant_revisions` — the exact variant revision under review. All content lives in one revision table now, so this is a single FK (no polymorphic split). It pins the panel to the exact snapshot it judged, so the decision stays attached to specific content after later edits.

`re_review_cases`:

- `case_id`: PK and FK to `review_cases`.
- `variant_id`: the live published variant pulled back for re-review (FK to `guide_variants`). Re-review fires on a variant's accumulated votes, so it targets the variant — most often the canonical one, but any published variant (method or alternative) qualifies.
- `trigger_type`: which post-publish path fired it: `ratio` | `rubric_weighted` | `section_density` (see `overall-system.md` re-review triggers).

`disputes`:

- `case_id`: PK and FK to `review_cases`.
- `dispute_type`: `factual` |`maintainer_misconduct` | `governance` | `cross_subject`.
- `target_type`: what the dispute is against, paired with `target_id` (polymorphic, no single FK). Allowed values depend on `dispute_type` (see table below).
- `target_id`: the id of that target.
- `claim_text`: the filer's written claim and evidence summary.

What each `dispute_type` points at:


| `dispute_type`          | `target_type` | Meaning                                                                            |
| ----------------------- | ------------- | ---------------------------------------------------------------------------------- |
| `factual`               | `variant`     | A claim in a variant's content is wrong — any variant, canonical or not.           |
| `cross_subject`         | `guide`       | Two subject communities conflict over one guide (may spin off).                    |
| `maintainer_misconduct` | `profile`     | A verifier/maintainer acted in bad faith, so it points at the user.                |
| `governance`            | nullable      | A policy/process objection with no single content target; `target_id` may be null. |


A `cross_subject` dispute may resolve into a spin-off, recorded via `guides.forked_from_guide_id`.

`appeals`:

Contests the outcome of a prior `review_case`.

- `case_id`: PK and FK to `review_cases`.
- `appealed_case_id`: the prior case whose outcome is being challenged (FK to `review_cases`). An appeal targets a *resolved case*, not content.
- `appeal_reason`: the filer's written argument for why the ruling was wrong. The filer may be the original author contesting a ruling on their own work, or any standing-gated member challenging a moderation/re-review outcome.

---

## Snapshots vs. Deltas

So, variant revisions can basically be implemented in two ways: via whole snapshots (faster but take up slightly more storage, which may or may not be a problem because markdown/text is so tiny anyway; note: images will not be duplicated between revisions) or deltas/diffs (take up less storage but are slower and more complex). 

The main use cases for `guide_variant_revisions` are for users to be able to see the history of specific variants, how they were changed, and if needed, to roll back to a previous version of the variant easily. Git itself stores snapshots internally for its version history system.

For BLUE's use case, it seems that snapshots are most likely the better option out of the two methods because they greatly simplify implementation while providing immediate support for rollback, auditing, and attribution. Guides are primarily text-based, which means storage requirements remain relatively small even with many revisions, especially compared to media assets such as images and videos. With snapshots, any revision can be viewed, restored, compared, or synchronized independently without reconstructing it from a long chain of changes. This makes moderation workflows, dispute resolution, and historical review much easier since moderators can inspect exactly what a variant looked like at any point in time. While delta-based storage can reduce storage usage, it introduces complexity around reconstruction, rollback, and maintenance. 

Later on, as BLUE grows to contain a massive amount of guides, `guide_variant_revisions`'s snapshot system can be optimized for storage through compression (Postgres automatically TOAST-compresses large text, but further optimizations can be made), deduplication (e.g. multiple guides using the same assets), content hashing (generates a unique fingerprint of a revision’s content so identical or duplicate content can be detected and stored only once), and a snapshot + delta hybrid (snapshots as checkpoints with deltas in between each checkpoint).

`guide_variant_revisions` stores a **full snapshot** of the content per revision. The intended uses are view history, see what changed, and roll back to a previous version, which all work directly off snapshots:

- **History view**: list revisions by `revision_number` with `change_summary`, author, and date.
- **What changed**: compute a diff between two snapshots at display time (the diff is rendered, not stored).
- **Rollback**: move the accepted-revision pointer back, or insert a new revision copying an older snapshot. Never destructive.

If deltas were stored instead, a delta model would store only the change/patch from the previous revision instead of the whole `body`. In practice, suppose someone wants to view revision 50 of a guide. In a delta-based model, revision 1 would store the original content, such as “The cat sat.” Each subsequent revision would then store only the change from the previous version (e.g. revision 2 might be “+ ‘ on the mat’,” and revision 3 might represent a transformation like replacing “cat” with “dog,” and so on). This means revision 50 would effectively be represented as revision 1 plus a chain of deltas from revision 2 through revision 50. To reconstruct revision 50, the system would need to start from revision 1 and sequentially apply each delta in order until reaching the desired state, resulting in a reconstruction cost that grows linearly with the number of revisions or O(n).

**Comparison table:**


| Aspect                        | Full snapshots (current)                                                      | Deltas                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Storage                       | Larger; each revision repeats unchanged text (mitigated by TOAST compression) | Smaller; only changes stored                                             |
| Read a given version          | O(1): read one row                                                            | O(n): reconstruct all patches from a base, or store periodic checkpoints |
| Diff between versions         | Diff two snapshots directly                                                   | Already have one step; arbitrary version pairs still need reconstruction |
| Rollback                      | Trivial: point at / copy an old snapshot                                      | Must reconstruct the target version first                                |
| "Live = latest revision" rule | Simple                                                                        | Breaks; current content must be rebuilt from the chain                   |
| Complexity / bug surface      | Low                                                                           | Higher (patch apply, corruption risk if one delta is bad)                |


Because the use case is read-heavy (history, diff, rollback) and guide bodies are small markdown with media kept in object storage, **full snapshots are most likely the right option**. 

## Related Edges in Practice

`guide_edges` is physically directed (`from_guide_id -> to_guide_id`), and for `prerequisite` rows that direction carries meaning (learning order). A `related` edge is **semantically undirected**: "Vectors related to Matrices" is the same fact as the reverse. The `from`/`to` columns therefore carry no meaning for `related` rows; they are just the two endpoints. `related` and `prerequisite` edges are kept on the same table rather than split into separate tables because they represent a single unified graph structure with differing semantics rather than fundamentally different data models while allowing potential future edge types to be easily added to the table.

**1. Canonical ordering kills duplicates.** For `related` rows we always store the pair with the smaller id in `from_guide_id`, so `(A, B)` and `(B, A)` cannot both exist. Enforce with a partial check and a partial unique index; both conditions apply only to `related` rows, so they never constrain `prerequisite` direction:

```sql
ALTER TABLE guide_edges
  ADD CONSTRAINT related_canonical_order
  CHECK (edge_type <> 'related' OR from_guide_id < to_guide_id);

CREATE UNIQUE INDEX guide_edges_related_unique
  ON guide_edges (from_guide_id, to_guide_id)
  WHERE edge_type = 'related';
```

**2. Reads query both columns.** Because direction is meaningless, the related guides of `X` can sit in either column. Always OR both sides and normalize to "the other endpoint":

```sql
SELECT CASE WHEN from_guide_id = :x THEN to_guide_id ELSE from_guide_id END AS related_guide_id
FROM guide_edges
WHERE edge_type = 'related'
  AND (from_guide_id = :x OR to_guide_id = :x);
```

Querying only `from_guide_id` would silently miss half the links, so this OR-both-columns logic must live behind a single backend helper (e.g. `getRelatedGuides(id)` and `addRelation(a, b)`), not be hand-written per call site. `addRelation` is responsible for swapping the pair into canonical order before insert so the constraint above holds.

For the reverse-direction lookups to stay fast, `to_guide_id` needs its own index. The prerequisite traversals already want one for walking backward, so a single index serves both:

```sql
CREATE INDEX guide_edges_to_guide_id ON guide_edges (to_guide_id);
```

## Derived Data

These are computed from prerequisite edges and optional subject filters.

### Levels

A level is computed inside a walkthrough. The level of a guide is its longest prerequisite path from a primitive within that walkthrough.

The same guide can have different levels in different walkthroughs, so storing a global level would be wrong.

### Frontiers

A frontier is a guide with no dependents inside a subject-filtered graph.

The same guide can be a frontier in one subject and a prerequisite in another, so frontier status is derived per subject view.

### Reachability

Reachability is computed by checking whether every transitive prerequisite exists and whether TODO prerequisites remain unresolved.

Storing `reachable` would risk drift whenever an edge, guide, or TODO prerequisite changes.

### Walkthroughs

Most walkthroughs should be generated on demand by picking a target guide and computing its transitive prerequisite DAG.

Saved or user-curated walkthroughs are intentionally left for a later migration because their sharing, attribution, and dispute model is still open in `docs/open-questions.md`.

## Roles and Permissions

The roles are cumulative: every user is a `learner`, and `maintainer`/`admin` add permissions on top rather than replacing them. 

### `learner` (default, every user)

Responsible for consuming and contributing content and expressing preference through votes (and potentially comments in the future).

- Read published guides, variants, subject views, and walkthroughs.
- Author new guides, and methods/alternatives under existing guides (enters the maintainer queue).
- Modify own drafts and submit diff-style edits to canonical guides.
- Declare prerequisites and TODO prerequisites on own drafts.
- Upvote (single click) any guide or variant.
- Downvote, which requires a rubric reason and an optional section pointer.
- File disputes, standing-gated to prevent spam.
- Save walkthroughs (later migration).

Cannot publish content, see the per-row vote-rubric breakdown, or sit on panels.

### `maintainer` — pre-publish gate and post-publish review

Combines the verifier and moderator responsibilities from `overall-system.md` into one role: structural review before publish, and continuous vote-based review, re-review, and dispute resolution after publish. Maintainers are not required to be subject experts; the role is about applying consistent rubric-bound structural standards.

Pre-publish:

- Read the review queue (submissions in `in_review`).
- Sit on odd-numbered random review panels and cast an outcome: publish provisional or return to author.
- Write a rubric-citing justification per decision, recorded on the public audit log.

Post-publish:

- See the full vote-rubric breakdown at whole-guide and per-section granularity (learners see totals only).
- Sit on re-review panels when a guide trips a trigger (ratio, rubric-weighted, or section-density path).
- Apply re-review outcomes: edit, demote to author, route to dispute, or dismiss as brigade.
- Sit on dispute and appeal panels drawn from the maintainer pool.

Bounded by the conduct rules in `overall-system.md`: rejections must cite a named rubric item; style, ideology, author identity, and personal factual disagreement are out of scope; maintainers do not pick winners among methods/alternatives (votes do). Panels are odd-numbered, conflict-of-interest excluded, and require written justifications. A maintainer must not sit on a panel reviewing a decision they previously made on the same target — enforced at panel-draw time using the audit log, not by the role itself. Overturned decisions degrade standing.

### `admin` — operational

Not part of the `overall-system.md` governance spec; an operational role for running the platform.

- Grant and revoke the `maintainer` role (until automated credentialing exists).
- Manage `subjects` (create tags, set prerequisite floors).
- Suspend members (`is_suspended`).
- Service-role and infrastructure configuration, including governance-threshold tuning.

## Not Yet Implemented

These are required by `overall-system.md` but intentionally deferred. They are listed here so the gaps are explicit rather than forgotten. None block the first-pass schema.

### Subject prerequisite floor

`overall-system.md` lets a subject declare a **prerequisite floor** (e.g. "physics floor = arithmetic + algebra") that applies to its tagged subgraph, keeping subject views from spiralling into low-level dependencies. The [Row Level Security](#row-level-security) section already assumes floors are readable, but no table stores them yet.

Planned shape: a join table, e.g.

```text
subject_prerequisite_floors (
  subject_id  FK -> subjects,
  guide_id    FK -> guides,
  primary key (subject_id, guide_id)
)
```

Each row says "this guide is part of subject S's floor." Walkthrough generation scoped to S can then stop descending past floor guides instead of chasing every transitive prerequisite. Writes are governance-only (see the `admin` role).

### Section pointer on votes and re-review

`overall-system.md` lets a downvote optionally carry a **section pointer** (which header of the guide the flag targets), and the **section-density re-review path** fires when a single section accumulates enough flags. The current `votes` table has no section field, so neither the per-section moderator breakdown nor the section-density trigger can be built yet.

Planned shape: a nullable `section_ref` on `votes` holding the header anchor/slug. Sections are parsed from the markdown body at display time, so no separate section table is needed; a null `section_ref` is a whole-guide flag. `re_review_cases` gains a matching nullable `section_ref`, set only when `trigger_type = 'section_density'`, to scope the lighter section-level review.

### Standing / reputation

`overall-system.md` standing-gates dispute filing "to prevent spam," and degrades a maintainer's standing when their decisions are overturned ("persistent patterns remove the verifier role"). Nothing in the schema currently exposes a member's standing.

Open question: **derive** it on demand from existing ground truth (contribution history, `review_decisions`, and `appeals` outcomes) or **store** a maintained `standing`/reputation column on `profiles`. Derivation avoids drift but must be cheap enough to evaluate at dispute-file time and panel-draw time; a stored column is faster to gate on but needs its own update path. Resolve before the dispute system ships.