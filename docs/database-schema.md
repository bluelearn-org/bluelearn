# Database Schema

This doc serves as the file for laying out the database schema for this site.

## Purpose

BLUE stores one global graph of topics. A guide base is a node in the learning graph, and its content lives in its guides (the original write-up plus any methods and alternatives), one of which the guide base designates as canonical. The graph is used to derive subject views, walkthroughs, levels, and reachability.

The schema deliberately keeps the database source of truth small:

- Store guide bases and the relationships between them.
- Store subjects as revision-scoped tags, not as separate trees; a guide base's live tags are its canonical variant's current revision's.
- Store methods and alternatives as guides under their parent guide base.
- Store version history for every guide (original write-up, methods, and alternatives).
- Store governance records (votes, review cases, panels, decisions) as ground truth.
- Do not store values that can be derived from the graph.



## Tables



### `profiles`

- `id`: primary key, references the auth user.
- `username`: unique URL handle.
- `created_at`: row creation time.
- `updated_at`: last update time, maintained by a trigger.
- `display_name`: optional human-facing name, separate from the unique `username` handle.
- `bio`: optional short profile text.
- `is_suspended`: optional flag for moderation actions against a member, kept separate from roles so a role is not silently lost on suspension.

`roles` is not a column on `profiles`. Every user is a `learner` implicitly; granted roles (`verifier`, `moderator`, `curator`, `admin`) live in `user_roles`.

### `user_roles`

The roles a user holds. A user may hold several at once (e.g. both `verifier` and `moderator`). `learner` is the implicit baseline and is not stored here; absence of any row means learner-only.

- `user_id`: FK to `profiles.id`.
- `role`: granted role enum `verifier | moderator | curator | admin`.
- `granted_at`: when the role was granted.

For now, roles are granted directly by an admin inserting the `user_roles` row. A self-service application flow is deferred for later; see [Role applications](#role-applications) under Not Yet Implemented.

### `guide_bases`

A guide base is the graph node. It stores no content of its own, as all content lives in its guides. The guide base points to which guide is currently canonical via `canonical_guide_id`.

- `id`: primary key of the guide base; the node identity in the graph.
- `canonical_guide_id`: nullable FK to `guides`. Points at the guide currently designated canonical, which is decided from a upvote/downvote system. Null before any guide is published. Creates a guide base ↔ guide pointer cycle (guide_bases → guides → guide_bases), so the FK should be deferrable.
- `slug`: stable URL identifier.
- `title`: human-readable title of the topic.
- `knowledge_type`: `theory` (a grand explanation of something we can observe) or `practice` (a route to a specific, well-defined goal). Determines how the topic is structured and what its guides are called: `practice` guides display as **methods**, `theory` guides as **alternatives**.
- `status`: draft lifecycle state (see enum below).
- `created_at`: row creation time.
- `updated_at`: last update time.
- `forked_from_guide_base_id`: nullable self-reference. When a cross-subject conflict resolves into a **spin-off** (see `overall-system.md`), the guide base forks into a subject-specific version. This makes the spin-off an explicit, governed exception to "one canonical guide base per topic" instead of looking like an accidental duplicate. In practice, there will be a message/indicator saying something like "forked from {original-title}".

Status enum values are:

- `draft` — no guide has been published yet; `canonical_guide_id` is null.
- `published` — live; `canonical_guide_id` points at a published guide.
- `archived` — deliberately retired; `canonical_guide_id` is left untouched so the last canonical content stays retrievable.
- 



### `guides`

Methods, alternatives, and the original write-up all live here as **guides** under a topic. Each guide is its own page with its own URL, revision history, and votes. The parent guide base designates one of them canonical via `guide_bases.canonical_guide_id`.

- `id`: primary key of the guide.
- `guide_base_id`: the parent guide base this guide lives under (FK to `guide_bases`).
- `slug`: stable, per-guide URL identifier, unique within `guide_base_id` (see [Slugs and URLs](#slugs-and-urls)). Derived from the title and frozen at first publish; never auto-changed by later title edits.
- `current_revision_id`: nullable FK to `guide_revisions`; points at the revision whose review case was approved (the guide's live content), null before the guide is first published. Creates a guide ↔ revision pointer cycle, so the FK should be deferrable.
- `status`: node-level disposition; same shape as `guide_bases.status` (see enum below).
- `author_id`: the guide's original author (FK to `profiles`).
- `created_at`: row creation time.
- `updated_at`: last update time.

Status enum values are:

- `draft` — nothing published yet.
- `published` — live content exists.
- `archived` — deliberately retired.

A guide stores no `title` or `summary` of its own: both are **versioned content** living on `guide_revisions`, so a rename is captured in history and restored on rollback like any other edit. A guide's live title/summary is its current revision's; lists and walkthrough previews read them by joining through `current_revision_id` (most often the canonical guide's). Ordering among sibling guides under the same guide base is **derived** from votes, not stored here.

### `guide_revisions`

The single content store: immutable, append-only version history for all guide content (the original write-up plus methods and alternatives). Every edit inserts a new row; revision content is never updated or deleted. This is what powers the history view, the change log, diffs between versions, and rollback. See [Snapshots vs. Deltas](#snapshots-vs-deltas) for a comparison between the two methods behind guide revisions. 

- `id`: primary key of the revision row.
- `guide_id`: which guide this revision belongs to (many revisions to one guide; FK to `guides`).
- `title`: the guide's human-facing title as of this revision. Versioned alongside `body`, so renames live in the history and are restored on rollback. The guide's live title is its current revision's title; `guides.slug` is derived from it at first publish and then frozen (see [Slugs and URLs](#slugs-and-urls)).
- `summary`: short description for lists and previews, as of this revision.
- `body`: the full guide content (markdown) as of this revision. Media is referenced by URL, not embedded, so large assets live in object storage rather than in the row.
- `change_summary`: author's note describing what changed in this revision (like a commit message). Drives the "what changed" entry in the history list.
- `author_id`: who wrote this specific revision. May differ from the guide's original author, which is how edit credit spreads across contributors.
- `created_at`: when this revision was written.
- `updated_at`: last edit time, maintained by a trigger. A draft is overwritten in place while being written, so this advances during the draft phase; once the revision is submitted and published it is immutable and the timestamp stops moving.
- `approved_at`: when this revision was approved and promoted to its guide's `current_revision_id` (the moment it went live), null until then. A revision can accrue several `review_cases` over its life (resubmit, dispute, appeal, re_review), so its go-live time can't be cleanly derived from them; it is recorded here as one unambiguous value. This is **not** the review verdict (that stays owned by `review_cases.status` and is derived) — only the publish-event time, used to order the published-version history by when each version actually went live rather than when its draft was written.
- `status`: draft lifecycle state (see enum below).
- `is_purged`: boolean, default `false`; set `true` when the content fields are nulled by a purge. Distinguishes a deliberate purge from accidental data corruption (a null `body` that nobody intended). Without it, an empty content row is ambiguous.

A purged revision has its content fields nulled in place and `is_purged = true` (see [Content removal](#content-removal)). Who purged it and when stays on the covering `content_holds` row; the nulled content plus `is_purged` is the physical tombstone.

Status enum values are:

- `draft` — being written, not yet submitted.
- `submitted` — handed off to review. The review outcome (in review, accepted, or rejected) is **not** stored here; it is derived from the revision's `guide_review_cases` → `review_cases.status` to avoid redundancy and drift.

Submitting a revision is the action that creates its `guide_review_cases` row, in the same transaction that sets `status = submitted`. So every `submitted` revision has exactly one case and the derivation always resolves; a `draft` revision has no case.

Note: `accepted` is not a stored revision value. A revision "reads as accepted" when its review case has `status = approved`. `published` is also deliberately **not** a revision value: "published" describes the guide or guide base node. A revision also never becomes `archived`; archiving happens at the guide or guide base level.

**Rollback.** Rollback never deletes newer rows. It inserts a new revision that copies an older one's content. Through this, the version history shows that a rollback occurred through the change_summary.

### `guide_edges`

Relationships between guide bases. This table *is* the global graph.

- `id`: primary key of the edge row.
- `from_guide_base_id`: the source guide base of the edge.
- `to_guide_base_id`: the target guide base of the edge.
- `edge_type`: what kind of relationship this edge represents (see allowed types below).
- `is_suspended`: flag to temporarily exclude an edge from graph traversal without deleting it. A suspended edge keeps its row (so it can be restored), still occupies its `(from, to)` slot for uniqueness, and is still counted by the cycle-prevention trigger so un-suspending can never resurrect a cycle. Walkthrough generation, level computation, reachability, and path projection must filter out suspended edges.
- `created_at`: row creation time.
- `updated_at`: last update time, maintained by a trigger.

For prerequisite edges, direction means:

```text
from_guide_base_id -> to_guide_base_id
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

Only `prerequisite` edges form the learning DAG. Walkthrough generation, level computation, and reachability checks must ignore other edge types. 

There must be a trigger that prevents cycles among prerequisite edges. Related edges may be cyclic because they do not define learning order. Related edges are used for "related" or "see also" links, discovery/navigation, and contextual suggestions. See [Related Edges in Practice](#related-edges-in-practice) for how the directed table represents these undirected links.

### `todo_prerequisites`

Missing prerequisite topics declared by authors when a real guide base does not exist yet. Also acts as a recruitment surface for topics that still need writing.

- `id`: primary key of the TODO entry.
- `dependent_guide_base_id`: the dependent guide base that declares the need (FK to `guide_bases`).
- `title`: the named missing prerequisite topic (free text, no guide base exists yet).
- `status`: `open` while unfilled, `resolved` once a real guide base is created for the topic.
- `resolved_guide_base_id`: the guide base that fulfilled this TODO, set when `status` becomes `resolved`; null while open.
- `created_at`: when the TODO was declared.

Example:

```text
Dependent guide base: Newton's laws
TODO prerequisite: Vectors
status = open
```

Because walkthrough and level generation use the **longest** path, redundant transitive edges are harmless to level correctness. Authors typically declare every prerequisite a guide base needs, not just the ones one level below, which produces shortcut edges (e.g. `Algebra -> Calculus`) alongside the real chain (`Algebra -> Functions -> Limits -> Calculus`). The longest path dominates, so the guide base still lands at its correct deep level; the shortcut cannot pull it up.

What over-declaration does cost is **graph bloat**: redundant edges clutter the DAG, walkthroughs, and diffs. A later **transitive reduction** pass can drop any edge `A -> C` when a longer path `A -> ... -> C` already exists. This is a tidiness optimization, not a correctness requirement, since levels stay correct without it. 

### `objectives`

The stable identity of an objective: it stores no curriculum content of its own and points at whichever revision is currently live.

- `id`: primary key; the objective's stable identity.
- `slug`: stable URL identifier (e.g. `ml-engineer`), unique **among objectives**. Objectives live under their own `/objectives/{slug}` route namespace, so an objective slug never collides with a guide base slug (`/{base-slug}`) — uniqueness only needs to hold within objectives, not site-wide. Derived from the first published revision's title and frozen at first publish; never auto-changed by later title edits, exactly like `guides.slug`.
- `current_revision_id`: nullable FK to `objective_revisions`. Points at the live published revision; null before the objective's first publish. Creates an objective ↔ revision pointer cycle, so the FK should be deferrable.
- `status`: node-level disposition `draft | published | archived` (same shape and meaning as `guide_bases.status`). `published` once `current_revision_id` is set; `archived` retires the whole objective while leaving the last revision retrievable.
- `created_by`: FK to `profiles.id`; the objective's original author, who must hold the `curator` role.
- `created_at`: row creation time.
- `updated_at`: last update time, maintained by a trigger.

An objective stores no `title` or `summary`: both are versioned content on `objective_revisions`, so a rename lives in history and is restored on rollback.

### `objective_revisions`

Append-only version history plus the objective's editorial metadata, mirroring `guide_revisions`. A published revision is immutable; further edits create a new revision rather than mutating a published one.

- `id`: primary key of the revision row.
- `objective_id`: which objective this revision belongs to (FK to `objectives`).
- `title`: the objective's human-facing title as of this revision. Versioned; `objectives.slug` is derived from it at first publish and then frozen.
- `summary`: short description for listings and the objective header, as of this revision.
- `change_summary`: curator's note describing what changed in this revision (like a commit message), driving the history list.
- `author_id`: who authored this specific revision, who must hold the `curator` role. May differ from the objective's original `created_by`, spreading curation credit.
- `status`: lifecycle state `draft | published`. Objectives have **no review gate**, so there is no `submitted` (awaiting review) state as on `guide_revisions`; a revision is either an editable draft or one a curator has published.
- `created_at`: when the revision (its draft) was created.
- `updated_at`: last edit time, maintained by a trigger. A draft is edited in place, so this advances during the draft phase and freezes once the revision is published. 
- `published_at`: when this revision went live, null until then.

Submitting a revision is a direct publish: in one transaction it flips `status = draft → published`, stamps `published_at`, freezes the revision's projected edges and linear order, and points `objectives.current_revision_id` at it (setting `objectives.status = published`, and freezing the slug on first publish). Whether a revision is currently live is read from `objectives.current_revision_id`, not from its status.

### `objective_revision_nodes`

The curriculum: every topic in this revision's target closure, which of them are the objective's goals, and which the curator skipped. A row exists for every closure topic; `is_included` distinguishes a kept topic from a skipped one (a soft hide, not a delete), so the editor can still list a skipped topic as a re-includable candidate and edge projection can bridge across it. An absent row means the topic was never in the closure at all.

- `id`: primary key for the node, so other tables (notably `objective_revision_node_placements`) can reference a node by a single id.
- `revision_id`: FK to `objective_revisions`.
- `guide_base_id`: the topic (FK to `guide_bases`).
- `guide_id`: the guide variant the curator chose for this topic (FK to `guides`). The variant is pinned, but its content is read live through `guides.current_revision_id` (the objective shows the up-to-date guide, not a frozen body).
- `is_target`: boolean, default `false`. `true` marks this node as one of the objective's goal topics (an endpoint the curriculum was built to reach). A revision may have several targets (an objective can climb toward Machine Learning *and* Statistics at once).
- `is_included`: boolean, default `true`. `false` means the curator skipped this topic: the row stays as a re-includable candidate but the topic is dropped from the published curriculum and bridged over by edge projection. Skipping is a soft hide; only included rows reach the published objective.
- `note`: optional curator annotation for this node within the objective.
- Primary key `id`. `(revision_id, guide_base_id)` is a unique constraint, so a topic still appears at most once per revision.
- 



### `objective_revision_edges`

The projected prerequisite edges among included nodes, computed once at publish time and stored so the published objective never drifts when the global DAG later changes.

- `revision_id`: FK to `objective_revisions`.
- `from_guide_base_id`: source endpoint (FK to `guide_bases`), an included node of this revision.
- `to_guide_base_id`: target endpoint (FK to `guide_bases`), an included node of this revision.
- Primary key `(revision_id, from_guide_base_id, to_guide_base_id)`.

These edges are derived from the global `guide_edges` graph, never hand-authored: at publish, the global prerequisite graph is projected onto the included (`is_included = true`) node set, bridging skipped prerequisites (if `A → Trig → C` and Trig is skipped, the projection stores `A → C`). They are a frozen *view* of the canonical graph, not a competing prerequisite authority (see [Objectives as frozen projections](#objectives-as-frozen-projections)). These edges power the objective's graph view, which is the secondary view. The primary view is the authored linear order in `objective_revision_node_placements` below.



### `objective_revision_node_placements`

The objective's linear reading order, authored per target (sub-objective) and the objective's primary view. It holds one row per placed node per target, so a topic shared across targets can sit at a different position in each target's sequence. Rows exist only for included nodes.

- `revision_id`: FK to `objective_revisions`.
- `target_node_id`: the target node whose sequence this row belongs to (FK to `objective_revision_nodes`).
- `node_id`: the node placed in the sequence (FK to `objective_revision_nodes`).
- `position`: integer slot in the target's sequence, starting at 0.
- Primary key `(revision_id, target_node_id, node_id)`.



### `subjects`

Subject tags, such as Math, Physics, or Game Development. Subjects are not containers and do not own guide bases. They are filters over the global graph.

- `id`: primary key of the subject.
- `slug`: stable URL identifier for the subject (e.g. `game-development`).
- `name`: human-readable subject name (e.g. `Game Development`).
- `summary`: optional short description for subject listings and the subject header. Nullable; subjects have no revision table, so it lives on the row.
- `creator_id`: FK to `profiles.id` (the user who created the subject).
- `created_at`: subject creation time.



### `guide_revision_subjects`

Many-to-many join table between guide revisions and subjects. Tagging is revision-scoped: each guide revision carries its own tag set, edited while the revision is a draft and frozen once submitted. A variant's live tags are its current revision's, and a guide base's live tags are its canonical variant's current revision's.

- `guide_revision_id`: the tagged guide revision.
- `subject_id`: the subject tag applied to it. The pair `(guide_revision_id, subject_id)` is the primary key, so a revision cannot carry the same tag twice.

Example (a base's live tags resolved through its canonical current revision):

```text
Guide base: Vectors
Subjects: Math, Physics, Game Development
```



### `objective_revision_subjects`

Many-to-many join table between objective revisions and subjects, mirroring `guide_revision_subjects`.

- `objective_revision_id`: the tagged objective revision.
- `subject_id`: the subject tag applied to it. The pair `(objective_revision_id, subject_id)` is the primary key, so a revision cannot carry the same tag twice.



### `votes`

Upvotes and downvotes on guides (the canonical one plus other methods and alternatives). Because all content lives in guides, a guide is the only votable content unit: voting "on the topic" is voting on its canonical guide.

Key fields:

- `voter_id`: the user who cast the vote. Half of the composite primary key.
- `guide_id`: the guide being voted on (FK to `guides`). A real foreign key, not a polymorphic pointer. The other half of the composite primary key.
- `direction`: `up` or `down`.
- `reason`: required only on downvotes. Enum mirroring the canonical downvote rubric exactly: `unclear`, `factually_wrong`, `missing_step`, `outdated`, `broken_link`, `prereq_gap`, `wrong_level`, `scope_creep` (covers material outside topic). 
- `note`: optional free-form text.
- `created_at`: when the vote was first cast.
- `updated_at`: when the vote was last changed.

Constraints:

- One vote per voter per guide, enforced directly by the composite primary key `(voter_id, guide_id)` — no separate surrogate `id` or unique constraint needed.
- A check that `reason` is present if and only if `direction = 'down'`.

Display rules: public users see upvote/downvote totals only. The rubric breakdown is visible to moderators only, enforced by row level security. Guide ordering among siblings is **derived** from net votes, not stored as a rank column.

### `content_holds`

Moderation record for hiding or purging content (see [Content removal](#content-removal)). Decoupled from the content so `guide_revisions` stays immutable for hides.

- `id`: primary key of the hold.
- `revision_id`: nullable FK to `guide_revisions`. Set for a single-revision hold.
- `guide_id`: nullable FK to `guides`. Set for a whole-guide hold.
- `guide_base_id`: nullable FK to `guide_bases`. Set for a whole-topic hold.
- `hold_type`: `dmca | csam | ncii | violent_extremism | tos_violation | gdpr_erasure | court_order | law_enforcement | counternotice`.
- `action`: `hidden` (reversible, content untouched), `purge` (irreversible content destruction), or `legal_hold` (must preserve, purge blocked until `preserve_until`).
- `preserve_until`: nullable timestamp; set on a `legal_hold`. While `preserve_until > now()`, purge of the covered content is blocked. Duration is set per the governing obligation.
- `actor_id`: FK to `profiles.id`; the moderator who placed the hold.
- `reason`: free-text note.
- `created_at`: when the hold was placed.
- `released_at`: nullable; set when a `hidden` hold is lifted. Null = active.
- `released_by`: nullable FK to `profiles.id`; the moderator who lifted the `hidden` hold. Null while active. Recorded separately from `actor_id` so the audit trail shows who placed *and* who lifted.
- `purged_at`: nullable; set when a `purge` finishes executing.
- `purged_by`: nullable FK to `profiles.id`; the moderator who executed the `purge`. Null until the purge completes. Separate from `actor_id` for the same audit reason.

Exactly one of `revision_id` / `guide_id` / `guide_base_id` is set. A node-scoped hold fans out to the revisions beneath it at purge time.

Holds are multi-row: one piece of content can carry several at once (e.g. a `hidden` hold to take it out of view *and* a `legal_hold` to preserve it for reporting). A `csam` item is typically held this way (hidden, preserved, reported) and only purged after the preservation window passes.

### `media_assets` and `revision_assets`

The manifest of object-storage assets, so a purge can delete media reliably instead of scraping URLs out of markdown.

`media_assets`:

- `id`: primary key of the asset.
- `storage_key`: object-storage key (not the public URL).
- `uploaded_by`: FK to `profiles.id`.
- `created_at`: upload time.

`revision_assets`: many-to-many between revisions and assets, written when a revision is saved.

- `revision_id`: FK to `guide_revisions`.
- `asset_id`: FK to `media_assets`. The pair `(revision_id, asset_id)` is the primary key.



### `review_cases`, `review_panels`, and `review_decisions`

Verifier gates, post-publish re-reviews, disputes, and appeals all share the same shape: an odd-numbered random panel, a majority outcome, and an independent written justification per member. They share one root object (`review_cases`) plus one panel table and one decision table. Type-specific fields hang off the root in **specialized tables** (`guide_review_cases`, `re_review_cases`, `disputes`, `appeals`), each keyed 1:1 on `case_id`. The root carries what every workflow has in common (lifecycle, who opened it, timestamps); the satellite carries only what that one case type needs.

`review_cases`:

The item being reviewed.

- `id`: primary key of the case.
- `case_type`: what work the case represents: `guide_publish` | `guide_edit` | `dispute` | `appeal` | `re_review`.
- `status`: lifecycle state: `pending` | `in_review` | `approved` | `rejected`.
- `created_by`: the user who opened the case (author for publish/edit/appeal, filer for dispute).
- `created_at`: when the case was created.
- `updated_at`: when the case status was updated. Updated via a trigger.
- `time_limit`: the maximum time a panel member can take to cast a vote on a case. When the voting window closes with voting spots still empty, the non-voting members are dropped and replaced by other randomly drawn panelists from the same pool (verifiers or moderators per case type) who will be assigned the same time limit.

`review_panels`:

An odd-numbered random group of panelists assembled to decide a case, drawn from the pool that matches the case type: **verifiers** for `guide_publish`/`guide_edit`, **moderators** for `re_review`/`dispute`/`appeal`.

- `id`: primary key of the panel.
- `case_id`: the case this panel decides (FK to `review_cases`). One case may have many panels.
- `target_seat_count`: how many seats this panel should fill (odd integer). Set when the panel is assembled by reading the size policy for the case type (a default per `case_type`, then clamped to the eligible pool and rounded to odd. See [Deciding panel size](#deciding-panel-size)).
- `outcome`: the panel's majority decision: `approved` | `rejected`. Null until the panel closes. Both `review_cases` and `review_panels` require a status/outcome column because a review case can have multiple panels in its lifetime.
- `opened_at`: when the panel was assembled.
- `closed_at`: when the panel reached its outcome; null while open.

`panel_members`:

Panelists seated on a panel. One row per seat per panel. Tracks each seat's lifecycle so the time-limit/replacement flow (see `review_cases.time_limit`) is ground truth, not inferred from whether a decision exists.

- `id`: primary key of the seat.
- `panel_id`: the panel this seat belongs to (FK to `review_panels`).
- `member_id`: the panelist (verifier or moderator) holding the seat (FK to `profiles.id`). 
- `status`: seat lifecycle state (see enum below).
- `assigned_at`: when the panelist was drawn onto the panel. The time limit counts from here.

Status enum values are:

- `assigned` — seated, vote pending.
- `recused` — stepped down for conflict of interest (see conduct rules in `overall-system.md`).
- `replaced` — dropped and swapped for a new panelist.
- `completed` — cast a decision.

A `replaced` seat does not delete the row; a new `panel_members` row is drawn for the replacement, so the full seat history of a panel stays auditable.

`review_decisions`:

One panel member's individual vote with its written justification.

- `id`: primary key of the decision.
- `panel_member_id`: the panel seat that cast it (FK to `panel_members`). One decision per seat — a `completed` seat has exactly one decision row. Carries both the panel and the panelist through the seat, so no separate `panel_id`/`member_id` pair is stored here.
- `decision`: that member's individual choice: `approved` | `rejected`.
- `notes`: written justification for the decision.
- `created_at`: when the decision was cast.

`review_decision_reasons`:

Links a decision to one or more rubric reasons → a reviewer can cite several at once (e.g. `hierarchy_issue` **and** `missing_required_information`). 

- `decision_id`: FK to `review_decisions.id`.
- `reason`: the rubric item cited by the reviewer: `hierarchy_issue` | `factual_error` | `duplicate_content` | `scope_violation` | `clarity_issue` | `missing_required_information`.

A `rejected` decision must have at least one row here; an `approved` has none. 

#### Specialized case tables

Each attaches type-specific data to a `review_cases` row. `case_id` is both primary key and FK to `review_cases` → one satellite row per case.

`guide_review_cases` (for `guide_publish`, `guide_edit`):

- `case_id`: PK and FK to `review_cases`.
- `guide_revision_id`: FK to `guide_revisions` — the exact guide revision under review. All content lives in one revision table now, so this is a single FK (no polymorphic split). It pins the panel to the exact snapshot it judged, so the decision stays attached to specific content after later edits.

`re_review_cases`:

- `case_id`: PK and FK to `review_cases`.
- `guide_id`: the live published guide pulled back for re-review (FK to `guides`). Re-review fires on a guide's accumulated votes, so it targets the guide — most often the canonical one, but any published guide (method or alternative) qualifies.
- `trigger_type`: which post-publish path fired it: `ratio` | `rubric_weighted` | `section_density` (see `overall-system.md` re-review triggers).

`disputes`:

- `case_id`: PK and FK to `review_cases`.
- `dispute_type`: `factual` |`reviewer_misconduct` | `governance` | `cross_subject`.
- `target_guide_id`: nullable FK to `guides`. Set for `factual`.
- `target_base_id`: nullable FK to `guide_bases`. Set for `cross_subject`.
- `target_profile_id`: nullable FK to `profiles`. Set for `reviewer_misconduct`.
- `claim_text`: the filer's written claim and evidence summary.

What each `dispute_type` points at, and which arm it sets:


| `dispute_type`        | Target id           | Target table  | Meaning                                                                  |
| --------------------- | ------------------- | ------------- | ------------------------------------------------------------------------ |
| `factual`             | `target_guide_id`   | `guides`      | A claim in a guide's content is wrong.                                   |
| `cross_subject`       | `target_base_id`    | `guide_bases` | Two subject communities conflict over one topic (may spin off).          |
| `reviewer_misconduct` | `target_profile_id` | `profiles`    | A verifier or moderator acted in bad faith, so it points at the user.    |
| `governance`          | *(none)*            | —             | A policy/process objection with no single content target; all arms null. |


Adding a new disputable type later is mechanical: add one nullable FK column.

A `cross_subject` dispute may resolve into a spin-off, recorded via `guide_bases.forked_from_guide_base_id`.

`appeals`:

Contests the outcome of a prior `review_case`.

- `case_id`: PK and FK to `review_cases`.
- `appealed_case_id`: the prior case whose outcome is being challenged (FK to `review_cases`). An appeal targets a *resolved case*, not content.
- `appeal_reason`: the filer's written argument for why the ruling was wrong. The filer may be the original author contesting a ruling on their own work, or any standing-gated member challenging a moderation/re-review outcome.

---



## Considerations

Design decisions and rules that span multiple tables.

### Guide Statuses

`guide_bases`, `guides`, and `guide_revisions` each have a status enum, and none of them stores a review outcome (`in_review`, `accepted`, `rejected`) deliberately to eilminate redundancy and potential drift. **Review outcome is owned by** `review_cases.status` **and derived everywhere else**, so it lives in exactly one place and cannot drift.

Submitting a revision creates a `guide_review_cases` row pointing at a `review_cases` row in the same transaction that flips the revision to `submitted`. From then on, the review lifecycle (`pending → in_review → approved | rejected`) is tracked entirely by `review_cases.status`. The revision and the node it belongs to read that state by joining through the case; they never copy it.

**Why** `guide_revisions.status` **is only** `draft | submitted`**.** A revision only needs to record the part of its lifecycle that *it* owns:

- `draft` — being written, mutable, no case yet.
- `submitted` — handed off to review; exactly one `guide_review_cases` row now exists.

Adding `in_review`, `accepted`, or `rejected` here would duplicate `review_cases.status`. Two columns describing the same fact means they can possibly disagree/drift (e.g. the case is `approved` but the revision still says `in_review` because an update was missed). So, a revision "reads as accepted" when its case is `approved`, and it is never stamped on the revision row itself. `published` and `archived` are excluded for a different reason: they describe a *node's* disposition, not a single revision's, so they belong to `guides`/`guide_bases`, not here.

**Why** `guides.status` **and** `guide_bases.status` **are only** `draft | published | archived`**.** These are the lasting states of a graph node, which do not include the transient state of a review in process:

- `draft` — nothing published yet.
- `published` — live content exists.
- `archived` — deliberately retired.

`in_review` and `rejected` are review-case states, not node states, so they would be category errors here. A guide does not "become rejected"; one of its *revisions'* review cases is rejected, after which the guide simply stays `draft`, and the rejected snapshot is kept in history with its outcome derivable from the case. Likewise, a guide is never `in_review` as a node; only a specific submitted revision is, via its case. Keeping these statuses off the node means a node's `status` answers exactly one question ("is this thing live?") and is never coupled to whatever review may or may not be running against one of its revisions.

**Summary of ownership:**


| Question                                            | Source of truth                                  | Read elsewhere by                     |
| --------------------------------------------------- | ------------------------------------------------ | ------------------------------------- |
| Is a revision still being written or handed off?    | `guide_revisions.status` (`draft                 | submitted`)                           |
| What is the review verdict on a submitted revision? | `review_cases.status` (via `guide_review_cases`) | revision "reads as accepted/rejected" |
| Is the node live, drafting, or retired?             | `guides.status` / `guide_bases.status` (`draft   | published                             |


The reason all three tables still need their own status is because the three levels form a dependency heirarchy: a `guide_revision` belongs to a `guide`, and a `guide` belongs to a `guide_base`. A child's effective state is its own status combined with every ancestor's because a parent's disposition cascades down:

- Archive a `guide_base` → every `guide` under it, and every revision under those is effectively archived regardless of each child's own status column. The topic is retired, so nothing beneath it is live.
- Archive a single `guide` → all of *its* revisions are effectively archived, but sibling guides under the same base are untouched.
- Revisions are never archived during its lifecycle.

Each level still keeps its own `status` because it answers a question only that level can answer, and a parent's status cannot stand in for it:

- `guide_bases.status` — is the **topic** live? (One archived base retires a whole collection of guides and revisions under it.)
- `guides.status` — is **this method/alternative** live, while its base and siblings stay published? You can archive one guide without touching the base.
- `guide_revisions.status` — is **this specific draft** still being written or already handed to review? This is per-revision and has no meaning at the node level.



### Content removal

An `action` field picks the path in the `content_holds` table: `hidden` (reversible) or `purge` (irreversible). Content only lives on `guide_revisions`, so every actual content destruction lands there (`guides` and `guide_bases` hold no `body` to destroy).

**Hide (**`hidden`**) — reversible, e.g. DMCA.** Insert a `content_holds` row; touch nothing else. The display layer hides any content with an active hold (`released_at IS NULL`). The revision row is never mutated, so immutability and history stay intact. Lift by setting `released_at`. The hold row is the audit trail.

**Purge (**`purge`**) — irreversible, e.g. CSAM or court order.** The content is destroyed but the row survives as a tombstone, so the audit trail (author, dates, which guide) and all foreign keys stay valid. Nulling the body alone is not enough — copies live in three places, and a purge must reach all three:

1. **Database row.** Null the content fields (`body`, `title`, `summary`, `change_summary`) and set `is_purged = true`; keep the skeleton (`id`, `guide_id`, `author_id`, `created_at`). The row stays so pointers (`current_revision_id`, review cases) resolve to a tombstone, not a dangling id. The `is_purged` flag marks the tombstone as deliberate (vs. accidental corruption that left content null); who/when lives on the covering `content_holds` row.
2. **Object storage.** Media is referenced by URL in the body, so parsing markdown to find assets is unreliable. Delete via the manifest instead: iterate `revision_assets → media_assets.storage_key`, delete each key from the bucket, and verify it is gone. Before deleting a key, confirm no surviving (non-purged) revision still references that asset — shared assets must outlive a single revision's purge. (A CSAM legal purge overrides this and removes the asset regardless of references.) Because the DB and the bucket cannot share a transaction, queue one delete job per asset and mark the purge complete only once every job verifies deletion; a periodic orphan sweep reconciles bucket keys with no live manifest row as a backstop.
3. **Backups.** Live nulling does nothing to existing DB/bucket backups. Policy (pick one, document it): **bounded retention** — backups expire after N days so purged content ages out (lingers ≤ N days in cold storage); or **crypto-shred** — per-object encryption keys, where deleting the key renders ciphertext unrecoverable in every backup at once. Bounded retention is the v1 default; crypto-shred is the upgrade if a notice demands immediate backup eradication.

**Node-scoped purge.** A whole guide or topic takedown is a fan-out, since the content lives below the node:

- **Whole guide:** purge every `guide_revisions` row under it (step 1) and its media (step 2); scrub `guides.slug` if the slug carries the offending text; set `guides.status = archived`. If it was canonical, `guide_bases.canonical_guide_id` still resolves to the tombstone — re-point or leave per policy.
- **Whole topic:** fan the guide purge over every guide under the base, then scrub `guide_bases.title` and `slug` (the base's own content) and set `status = archived`.

The `content_holds` row records the scope (revision, guide, or base); the destruction always lands on revision rows plus the media bucket.

**CSAM caveat.** Law may require preserve-and-report (e.g. NCMEC in the US) *before* destruction, for a fixed window. Model this with a `legal_hold` row carrying `preserve_until`; while that window is open the purge flow is blocked (step 2 of flow 10). Do not auto-fire a purge on a `csam` hold; the flow is hide → legal hold → preserve a sealed evidence copy → report → purge after the window. Confirm the required duration with counsel rather than assuming one (US federal CSAM preservation under 18 U.S.C. § 2258A(h) is 90 days, extendable to 180).

### Slugs and URLs

Slugs live in two layers, one stable identifier each:

- **Base slug** (`guide_bases.slug`) names the topic, e.g. `calculus`.
- **Guide slug** (`guides.slug`) names a page under that topic, unique within its `guide_base_id`, e.g. `physics-based`.

That gives two kinds of route:

- `/{base-slug}`: the topic front door. Always resolves to whatever `guide_bases.canonical_guide_id` currently points at. It is **not** owned by any one guide: "canonical" is a moving pointer (votes can change it), so it is never encoded in a slug. The first/original guide is no exception, as it does not "become" `/calculus`.
- `/{base-slug}/{guide-slug}`: a guide's stable permalink. Every guide has one, canonical or not, including the original write-up.

How a guide slug is decided:

1. Default to `slugify(title)` of the guide's title (author may override).
2. Resolve collisions against siblings under the **same base only** by appending a counter (`visual-method`, `visual-method-2`). This is a last resort, as it will only be used if the author decides to not change the guide's title to be unique. On guide submission, there will be a warning signaling the author that there is another guide with the same name, and they should change it unless they are okay with the numbered slug being used. Per-base scoping means a slug like `visual-method` can be reused under a different topic.
3. Assign at **first publish**, once the title has settled through review; drafts are addressed by id until then. After that the slug is frozen, and later title edits never move it.



### Snapshots vs. Deltas

So, guide revisions can basically be implemented in two ways: via whole snapshots (faster but take up slightly more storage, which may or may not be a problem because markdown/text is so tiny anyway; note: images will not be duplicated between revisions) or deltas/diffs (take up less storage but are slower and more complex). 

The main use cases for `guide_revisions` are for users to be able to see the history of specific guides, how they were changed, and if needed, to roll back to a previous version of the guide easily. Git itself stores snapshots internally for its version history system.

For BLUE's use case, it seems that snapshots are most likely the better option out of the two methods because they greatly simplify implementation while providing immediate support for rollback, auditing, and attribution. Guides are primarily text-based, which means storage requirements remain relatively small even with many revisions, especially compared to media assets such as images and videos. With snapshots, any revision can be viewed, restored, compared, or synchronized independently without reconstructing it from a long chain of changes. This makes moderation workflows, dispute resolution, and historical review much easier since moderators can inspect exactly what a guide looked like at any point in time. While delta-based storage can reduce storage usage, it introduces complexity around reconstruction, rollback, and maintenance. 

Later on, as BLUE grows to contain a massive amount of guides, `guide_revisions`'s snapshot system can be optimized for storage through compression (Postgres automatically TOAST-compresses large text, but further optimizations can be made), deduplication (e.g. multiple guides using the same assets), content hashing (generates a unique fingerprint of a revision’s content so identical or duplicate content can be detected and stored only once), and a snapshot + delta hybrid (snapshots as checkpoints with deltas in between each checkpoint).

`guide_revisions` stores a **full snapshot** of the content per revision. The intended uses are view history, see what changed, and roll back to a previous version, which all work directly off snapshots:

- **History view**: the published-version history lists the revisions that went live, ordered by `approved_at` (when each became the current content) rather than authoring order, so an early draft approved late lands where it went live.
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

### Related Edges in Practice

`guide_edges` is physically directed (`from_guide_base_id -> to_guide_base_id`), and for `prerequisite` rows that direction carries meaning (learning order). A `related` edge is **semantically undirected**: "Vectors related to Matrices" is the same fact as the reverse. The `from`/`to` columns therefore carry no meaning for `related` rows; they are just the two endpoints. `related` and `prerequisite` edges are kept on the same table rather than split into separate tables because they represent a single unified graph structure with differing semantics rather than fundamentally different data models while allowing potential future edge types to be easily added to the table.

**1. Canonical ordering kills duplicates.** For `related` rows we always store the pair with the smaller id in `from_guide_base_id`, so `(A, B)` and `(B, A)` cannot both exist. Enforce with a partial check and a partial unique index; both conditions apply only to `related` rows, so they never constrain `prerequisite` direction:

```sql
ALTER TABLE guide_edges
  ADD CONSTRAINT related_canonical_order
  CHECK (edge_type <> 'related' OR from_guide_base_id < to_guide_base_id);

CREATE UNIQUE INDEX guide_edges_related_unique
  ON guide_edges (from_guide_base_id, to_guide_base_id)
  WHERE edge_type = 'related';
```

**2. Reads query both columns.** Because direction is meaningless, the related guide bases of `X` can sit in either column. Always OR both sides and normalize to "the other endpoint":

```sql
SELECT CASE WHEN from_guide_base_id = :x THEN to_guide_base_id ELSE from_guide_base_id END AS related_guide_base_id
FROM guide_edges
WHERE edge_type = 'related'
  AND (from_guide_base_id = :x OR to_guide_base_id = :x);
```

Querying only `from_guide_base_id` would silently miss half the links, so this OR-both-columns logic must live behind a single backend helper (e.g. `getRelatedGuideBases(id)` and `addRelation(a, b)`), not be hand-written per call site. `addRelation` is responsible for swapping the pair into canonical order before insert so the constraint above holds.

For the reverse-direction lookups to stay fast, `to_guide_base_id` needs its own index. The prerequisite traversals already want one for walking backward, so a single index serves both:

```sql
CREATE INDEX guide_edges_to_guide_base_id ON guide_edges (to_guide_base_id);
```



### Deciding panel size

`review_panels.target_seat_count` is decided at assembly time, in three steps:

1. **Policy default per** `case_type`**.** A baseline count, e.g. `guide_publish`/`guide_edit` → 3 verifiers, `dispute`/`appeal`/`re_review` → 5 moderators (numbers illustrative). Higher-stakes governance gets a larger panel. This is a small static map (one odd number per `case_type`) that changes only on a policy decision, so it lives as an app-level constant, not a table. The value is read here and copied onto the panel, which freezes it.
2. **Clamp to the eligible pool.** The eligible pool is the role pool that matches the case type (verifiers vs moderators) minus anyone recused, conflicted, suspended (`profiles.is_suspended`), or the case author. You cannot seat more panelists than exist: `target = min(policy_default, eligible_pool_size)`.
3. **Round down to odd.** A majority must always be decidable, so an even clamp is reduced by one (`4 → 3`). A pool too small to seat the minimum (e.g. fewer than 3 eligible) blocks assembly rather than seating an even or trivially small panel.

```text
target_seat_count = round_down_to_odd( min( policy_default(case_type), eligible_pool_size ) )
```

The same eligibility filter feeds the replacement flow: when a seat is `replaced`, the new panelist is drawn from this pool minus those already seated.

### Objectives as frozen projections

A published objective revision stores its own `objective_revision_edges`, which can look like it duplicates or competes with the global `guide_edges` graph. It does neither, because the two answer different questions.

`guide_edges` is the single source of truth for **"what are the prerequisites of a topic?"** Only it may be traversed for walkthrough generation, level computation, and reachability. `objective_revision_edges` answers **"how does this one curated curriculum present its topics?"** When a curator excludes Trig from `Algebra → Trig → Calculus`, the stored edge `Algebra → Calculus` is not a claim that Trig stopped being a prerequisite of Calculus; it is a claim that *this objective* moves the learner from Algebra to Calculus directly. 

Two rules keep the invariant intact:

- **Projection:** objective edges are computed by projecting the global DAG onto the included node set at publish time; curators cannot draw arbitrary edges (e.g. an invented `Algebra → ML`). Every stored edge therefore originates from `guide_edges`.
- **Frozen, never authoritative:** once stored, objective edges are read only to render that revision. Nothing treats them as prerequisite authority, so they cannot drift the meaning of the global graph.

Storing the projection (rather than recomputing it from the live DAG on each read) allows objectives to not automatically change whenever an edge in the global DAG is added/altered, which could potentially lead to unwanted changes in the curated objective.

### Objective draft reconciliation

Only a **draft** revision tracks the live DAG; a published revision is frozen and is never affected by any of the below. While a draft is open, the global `guide_edges` graph can change underneath it. The governing rule is that the system computes the delta and surfaces it, but only the curator changes a topic's *included* membership. The node table keeps a row for every closure topic with an `is_included` flag, so it cleanly distinguishes "curator skipped this" (`is_included = false`) from "never in the closure" (no row). The system may add new closure topics as skipped rows (never overwriting an existing row), but it never flips `is_included` on its own. Four cases:

1. **New edge between two topics already in the draft:** nothing to reconcile. Draft edges are not stored (they freeze only at publish); the editor projects the live DAG onto the current node set on every render, so a new or removed edge between included topics is reflected automatically on the next redraw. No row changes.
2. **A new prerequisite topic enters the targets' closure:** the closure top-up inserts the topic as a node with `is_included = false` (`insert ... on conflict (revision_id, guide_base_id) do nothing`, so it only fills gaps and never touches an existing row). It joins the objective's candidate pool as a skipped topic; the published curriculum does not grow until the curator toggles it on (opt-in). The UI badges it as a new prerequisite (derived, see below) so a now-required topic does not hide unnoticed in the skipped pile. A previously skipped topic keeps its `is_included = false` and is never auto-resurrected.
3. **An edge is removed, so a kept topic is no longer required by the targets:** the topic stays in the draft (the curator may still want it); the system flags it ("Statistics is no longer required by your targets — keep or remove?") and the curator decides. No automatic change to `is_included`.
4. **A referenced guide or guide base is archived or purged mid-draft.** The affected node is flagged as broken; the curator must swap the variant (`guide_id`) or skip the node. Publish-time validation rejects any included node pointing at an archived or purged guide, so a broken reference can never freeze into a published revision.

**New-prerequisite badge.** "New this revision" is not stored; it is derived by anti-joining the draft's nodes against the revision the draft branched from (`objectives.current_revision_id`): a `guide_base_id` present in the draft but absent from the parent revision is new. Computed on read and returned alongside the nodes so the editor can badge it. (Rollback clones an *older* revision, for which `current_revision_id` is the wrong baseline; a stored `based_on_revision_id` would be needed to badge rollbacks accurately, deferred until needed.)

### Derived Data

These are computed from prerequisite edges and optional subject filters.

#### Levels

A level is computed inside a walkthrough. The level of a guide base is its longest prerequisite path from a primitive within that walkthrough. The same guide base can have different levels in different walkthroughs, so storing a global level would be wrong.

#### Reachability

Reachability is computed by checking whether every transitive prerequisite exists and whether TODO prerequisites remain unresolved. Storing `reachable` would risk drift whenever an edge, guide base, or TODO prerequisite changes.

#### Walkthroughs

Most walkthroughs should be generated on demand by picking a target guide base and computing its transitive prerequisite DAG. Saved or user-curated walkthroughs are intentionally left for a later migration because their sharing, attribution, and dispute model is still open in `docs/open-questions.md`.

### Not Yet Implemented

These are required by `overall-system.md` but intentionally deferred. They are listed here so the gaps are explicit rather than forgotten. None block the first-pass schema.

#### Subject prerequisite floor

`overall-system.md` lets a subject declare a **prerequisite floor** (e.g. "physics floor = arithmetic + algebra") that applies to its tagged subgraph, keeping subject views from spiralling into low-level dependencies. Floors are assumed readable, but no table stores them yet.

Planned shape: a join table, e.g.

```text
subject_prerequisite_floors (
  subject_id     FK -> subjects,
  guide_base_id  FK -> guide_bases,
  primary key (subject_id, guide_base_id)
)
```

Each row says "this guide base is part of subject S's floor." Walkthrough generation scoped to S can then stop descending past floor guide bases instead of chasing every transitive prerequisite. Writes are governance-only (see the `admin` role).

#### Section pointer on votes and re-review

`overall-system.md` lets a downvote optionally carry a **section pointer** (which header of the guide the flag targets), and the **section-density re-review path** fires when a single section accumulates enough flags. The current `votes` table has no section field, so neither the per-section moderator breakdown nor the section-density trigger can be built yet.

Planned shape: a nullable `section_ref` on `votes` holding the header anchor/slug. Sections are parsed from the markdown body at display time, so no separate section table is needed; a null `section_ref` is a whole-guide flag. `re_review_cases` gains a matching nullable `section_ref`, set only when `trigger_type = 'section_density'`, to scope the lighter section-level review.

#### Standing / reputation

`overall-system.md` standing-gates dispute filing "to prevent spam," and degrades a reviewer's standing when their decisions are overturned ("persistent patterns remove the verifier role"). Nothing in the schema currently exposes a member's standing.

Open question: **derive** it on demand from existing ground truth (contribution history, `review_decisions`, and `appeals` outcomes) or **store** a maintained `standing`/reputation column on `profiles`. Derivation avoids drift but must be cheap enough to evaluate at dispute-file time and panel-draw time; a stored column is faster to gate on but needs its own update path. Resolve before the dispute system ships.

#### Role applications

For now, `verifier`/`moderator`/`admin` roles are granted directly by an admin inserting a `user_roles` row. A self-service flow where users **apply** for a role and an admin (later, automated credentialing) reviews the request is deferred.

Potential shape: a `role_applications` table.

- `id`: primary key.
- `user_id`: FK to `profiles.id` (the applicant).
- `role`: role applied for, enum `verifier | moderator`. `admin` is never self-applied, as it stays granted directly.
- `status`: lifecycle state `pending | approved | rejected`.
- `statement`: optional applicant note / justification.
- `decided_at`: when the application was approved/rejected. Null while `pending`.
- `created_at`: when the application was filed.

Approval inserts the matching `user_roles` row. A partial unique index on `(user_id, role) WHERE status = 'pending'` stops a user stacking duplicate open applications for the same role.

#### Objective review gate

Objectives currently have **no review gate**: a curator's submit publishes the revision directly (flip to `published`, project edges, point `current_revision_id` at it), with no `review_cases` involved. A future gate would reuse the shared review machinery exactly like guides: add `objective_publish` / `objective_edit` back to the `case_type` enum and a `objective_review_cases` satellite (PK/FK `case_id`, plus `objective_revision_id` pinning the exact snapshot under review), drawn from the **verifier** pool. Submit would then open a case instead of publishing, and a revision would "read as approved" from its case before going live.

#### Objective post-publish governance

The first-pass objective schema covers authoring and frozen publishing. Post-publish governance (learner **votes** on an objective, vote-triggered **re-review**, **disputes** against an objective, and **content holds** (hide/purge) over an objective) is deliberately deferred. Objectives reference guides that already carry their own votes, holds, and disputes, so a bad guide is still governed at the guide level; what is missing is governance of the *curation* itself (e.g. an objective that skips a load-bearing prerequisite or pushes a fringe variant). When added, it should reuse the same machinery rather than grow a parallel one: a `re_review`/`dispute` case type targeting a `objective_id`, and a `content_holds` scope column for objectives.

---



## Table Flows in Practice

This section traces the main user actions end to end, showing which rows are written, in which tables, and in what order. It exists to check the schema against real usage. Each flow lists the steps as `table` → what is written.

### 1. Create a new topic and publish its first guide

A user starts a brand-new topic from scratch.

1. `guide_bases` → insert the node: `title`, `slug`, `knowledge_type`, `status = 'draft'`, `canonical_guide_id = NULL`. No content yet.
2. `guides` → insert the first guide under it: `guide_base_id`, `author_id`, `status = 'draft'`, `current_revision_id = NULL`, `slug = NULL` (addressed by id until first publish).
3. `guide_revisions` → insert the first revision while the author writes: `guide_id`, `title`, `summary`, `body`, `author_id`, `status = 'draft'`.
4. `media_assets` / `revision_assets` → for each asset embedded in the body, upsert the asset (`storage_key`) and insert a `(revision_id, asset_id)` link. This manifest is what a later purge deletes from object storage, instead of scraping URLs from markdown.

The author edits freely; each save can overwrite the draft revision (drafts are mutable up to submission; published revisions are immutable).

1. **Submit for review** (one transaction):
  - `guide_revisions` → set the revision `status = 'submitted'`.
  - `review_cases` → insert root: `case_type = 'guide_publish'`, `status = 'pending'`, `created_by = author`.
  - `guide_review_cases` → insert satellite: `case_id`, `guide_revision_id` (pins the exact snapshot).
2. **Panel assembled** (verifier pool, odd count):
  - Decide the size: `target = round_to_odd(min(policy_default(case_type), eligible_pool_size))`, where the eligible pool is the right role pool (verifiers here) minus anyone recused, conflicted, suspended, or the author. See [Deciding panel size](#deciding-panel-size).
  - `review_panels` → insert: `case_id`, `target_seat_count` = that value (frozen here), `outcome = NULL`, `opened_at`.
  - `panel_members` → insert one row per seat up to `target_seat_count`: `panel_id`, `member_id`, `status = 'assigned'`, `assigned_at`. `review_cases.status` → `in_review`.
3. **Each verifier votes**:
  - `review_decisions` → insert: `panel_member_id`, `decision`, `notes`. Seat `panel_members.status` → `completed`.
  - On a `rejected` decision: `review_decision_reasons` → one or more rubric rows for that decision.
  - Seats that miss `review_cases.time_limit`: `panel_members.status` → `replaced`, and a fresh `panel_members` row is drawn (history preserved).
4. **Panel closes on majority**:
  - `review_panels` → set `outcome`, `closed_at`. `review_cases.status` → `approved` or `rejected`.
5. **On approval** (publish, one transaction):
  - `guides` → set `current_revision_id` = the approved revision, `status = 'published'`, `slug = slugify(title)` (frozen from here; collisions resolved against siblings under the same base).
  - `guide_bases` → set `status = 'published'`, and `canonical_guide_id` = this guide (first published guide is canonical by default).

On rejection nothing publishes; the revision stays as a rejected snapshot (status derived from the case), and the author can revise and resubmit, which creates a new revision and a new case.

### 2. Add a method / alternative to an existing topic

A second author adds another guide under a topic that already has a canonical guide.

1. `guides` → insert a new guide: same `guide_base_id`, new `author_id`, `status = 'draft'`.
2. `guide_revisions` → revision 1 of the new guide.
3. Submit → review → publish: identical to flow 1 steps 4–8, **except** `guide_bases.canonical_guide_id` is **not** touched. The new guide publishes as a sibling; whether it becomes canonical is decided later by votes (flow 4), not by publishing.



### 3. Edit an existing published guide

1. `guide_revisions` → insert the next revision: edited `title`/`summary`/`body`, `change_summary`, `author_id` (may differ from original author → spreads edit credit), `status = 'draft'` then `submitted` on handoff. `media_assets` / `revision_assets` → link this revision's assets, same as flow 1 step 4.
2. `review_cases` → `case_type = 'guide_edit'`; `guide_review_cases` → points at the new `guide_revision_id`.
3. Panel / decisions / close: same as flow 1 steps 5–7.
4. **On approval**: `guides.current_revision_id` → the new revision. `guides.slug` is **not** changed even if the title changed (slug frozen at first publish). The previous revision stays in history.

**Rollback** is a special edit: insert a new revision copying an older snapshot's content (with a `change_summary` noting the rollback), then move `current_revision_id` to it. Older rows are never deleted.

### 4. Vote on a guide (and trigger re-review)

1. `votes` → insert: `(voter_id, guide_id)` composite PK, `direction`. On `down`, `reason` (rubric enum) is required; `note` optional. Re-voting updates the existing row (one vote per voter per guide).
2. **Canonical recompute** (derived, not stored): net votes order siblings under a guide base. If a non-canonical sibling overtakes the canonical guide, `guide_bases.canonical_guide_id` is repointed. No rank column is written.
3. **Re-review trigger** (post-publish, fired by accumulated votes):
  - `review_cases` → `case_type = 're_review'`, opened by the system/moderator.
  - `re_review_cases` → `guide_id`, `trigger_type` (`ratio | rubric_weighted | section_density`).
  - Panel is drawn from the **moderator** pool (not verifiers), then decisions/close as in flow 1.



### 5. File a dispute

A member contests content, a reviewer's conduct, a governance decision, or a cross-subject conflict.

1. `review_cases` → `case_type = 'dispute'`, `created_by = filer`.
2. `disputes` → `dispute_type`, the matching target FK arm (`target_guide_id` for `factual`, `target_base_id` for `cross_subject`, `target_profile_id` for `reviewer_misconduct`, none for `governance`), `claim_text`.
3. **Moderator** panel → decisions → close (flow 1 shape).
4. **If** `cross_subject` **resolves into a spin-off**: `guide_bases` → insert a new subject-specific node with `forked_from_guide_base_id` = the original. The fork is an explicit, governed exception to "one canonical base per topic."



### 6. Appeal a resolved case

1. `review_cases` → `case_type = 'appeal'`, `created_by = appellant`.
2. `appeals` → `appealed_case_id` (the prior resolved case being challenged), `appeal_reason`. An appeal targets a **case**, not content.
3. **Moderator** panel → decisions → close. Outcome may overturn the original ruling, driving the corresponding publish/edit/disposition change.



### 7. Declare prerequisites and graph edges

When authoring a guide base, the author wires it into the graph.

- **Real prerequisite exists**: `guide_edges` → insert `from_guide_base_id`, `to_guide_base_id`, `edge_type = 'prerequisite'`. A trigger rejects the insert if it would create a prerequisite cycle.
- **Related link**: `guide_edges` → insert with `edge_type = 'related'`, pair swapped into canonical order (`from < to`) by the `addRelation` helper so `(A,B)`/`(B,A)` cannot both exist.
- **Prerequisite topic does not exist yet**: `todo_prerequisites` → insert `dependent_guide_base_id`, `title` (free text), `status = 'open'`. Acts as a recruitment surface.
- **TODO later filled**: when a real base is created for that topic, `todo_prerequisites` → set `status = 'resolved'`, `resolved_guide_base_id` = the new base; typically a real `prerequisite` edge is added in `guide_edges` at the same time.



### 8. Tag a topic into subjects

1. `subjects` → row exists (or insert if new, governance-gated).
2. `guide_revision_subjects` → insert `(guide_revision_id, subject_id)` per tag on the draft revision being authored. A base surfaces under a subject once its canonical variant's current revision carries the tag.
3. `objective_revision_subjects` → insert `(objective_revision_id, subject_id)` per tag on the draft objective revision. Just like guides, an objective surfaces under a subject once its current revision carries the tag.



### 9. Hide content (reversible, e.g. DMCA)

A moderator takes content out of view without destroying it. See [Content removal](#content-removal).

1. `content_holds` → insert: `action = 'hidden'`, `hold_type`, `actor_id`, `reason`, and exactly one scope (`revision_id` / `guide_id` / `guide_base_id`).
2. Display layer hides any content with an active hold (`released_at IS NULL`). No content row is touched, so immutability and history are preserved.
3. **To lift:** `content_holds` → set `released_at` and `released_by`. Content reappears; the hold row remains as the audit trail.



### 10. Purge content (irreversible, e.g. CSAM / court order)

A moderator destroys content while keeping the audit trail. See [Content removal](#content-removal).

1. `content_holds` → insert: `action = 'purge'`, `hold_type`, `actor_id`, `reason`, scope. For a `csam` hold, place a `legal_hold` and preserve-and-report **before** purging.
2. **Check for an active legal hold.** If any covering `content_holds` row has `action = 'legal_hold'` with `preserve_until > now()`, the purge is blocked until the window passes. Preservation outranks destruction.
3. **Resolve scope to revisions.** A `revision_id` hold targets that row; a `guide_id` / `guide_base_id` hold fans out to every revision beneath it.
4. `guide_revisions` → for each target, null the content fields (`body`, `title`, `summary`, `change_summary`) and set `is_purged = true`; keep the skeleton row as a tombstone. Pointers (`current_revision_id`, review cases) still resolve.
5. **Object storage** → for each target revision, read `revision_assets → media_assets.storage_key`, delete each key from the bucket and verify, skipping any asset still referenced by a non-purged revision. Queue one delete job per asset; the purge is complete only when all jobs verify.
6. **Node scope only** → scrub the node's own content — `guides.slug`, or `guide_bases.title` + `slug` — and set `status = 'archived'`. If a purged guide was canonical, re-point or leave `guide_bases.canonical_guide_id` per policy (it resolves to the tombstone).
7. `content_holds` → set `purged_at` and `purged_by`. The revision carries `is_purged = true`; who/when stays on this hold row.



### 11. Author and publish an objective

A curator builds a curated curriculum from one or more targets. Most of the work (DAG closure, projection) happens at authoring/publish time; opening the objective later (flow 12) reads a frozen snapshot.

1. `objectives` → insert the shell: `slug = NULL` (addressed by id until first publish), `status = 'draft'`, `current_revision_id = NULL`, `created_by`.
2. `objective_revisions` → insert the first revision: `objective_id`, `title`, `summary`, `change_summary`, `author_id`, `status = 'draft'`.
3. **Pick targets:** the curator chooses one or more goal topics (and a variant for each). These are held in the editor until seeding; a target becomes a node flagged `is_target` in the next step.
4. **Seed the curriculum:** the system computes the transitive prerequisite DAG closure of the chosen targets over `guide_edges`, picks a default variant per topic, and immediately materializes the whole closure: `objective_revision_nodes` → insert one row per closure topic (`revision_id`, `guide_base_id`, `guide_id`), setting `is_target = true` (with the curator's chosen variant) on the target topics and `false` on the rest, and `is_included = true` on all of them. The draft starts as "everything included," and the curator narrows from there. Seeding into the real table (rather than holding the set in memory until submit) keeps a node row's meaning identical in every state. Every closure topic has a row; `is_included` says whether it reaches the published curriculum, so a `draft` revision and a `published` one read the same way and submit needs no convert-set-into-rows step. The draft persists server-side, so the curator can leave and resume.
5. **Curator edits the draft in place:** skip a topic → `PATCH` that node's `is_included = false` (a soft hide; the row stays as a re-includable candidate). Re-include → `is_included = true`. Swap a variant → update that row's `guide_id`. Annotate → set `note`. Toggle a goal → `is_target`. Edit metadata → update the revision's `title`/`summary`. Drafts are mutable up to submission (same as guide draft revisions). Whatever rows carry `is_included = true` at submit *are* the published set.
6. **Submit (direct publish), one transaction** (no review gate for now):
  - `objective_revisions` → `status = 'published'`, `published_at = now()`.
  - **Freeze the projection.** Project the current `guide_edges` graph onto the revision's included (`is_included = true`) node set, bridging skipped topics, and `objective_revision_edges` → insert one row per projected edge: `revision_id`, `from_guide_base_id`, `to_guide_base_id`. This is the only time these rows are written; the revision is now immutable.
  - `objectives` → set `current_revision_id` = this revision, `status = 'published'`, and on revision 1 `slug = slugify(revision.title)` (frozen from here).

A later edit is the same flow starting at step 2, except the new draft is **cloned** from the live revision rather than seeded from scratch: copy the current revision's node rows (`guide_id`, `is_target`, `is_included`, `note`) under the new `revision_id`, preserving every prior choice. The system then **tops up** the clone against the current closure — `insert ... on conflict (revision_id, guide_base_id) do nothing` adds any topic that newly entered the closure as a skipped (`is_included = false`) candidate, never overwriting a cloned row (see [Objective draft reconciliation](#objective-draft-reconciliation)). The curator reconciles, then submits; `current_revision_id` repoints and the slug is untouched. **Rollback** is a soft rollback: create a new revision cloning an older revision's targets/nodes, then submit to repoint `current_revision_id`. (A pre-publish gate is [deferred](#objective-review-gate); if added, submit would open a verifier case instead of publishing outright.)

### 12. Open an objective

A learner visits `/objectives/{slug}`. No DAG traversal happens; the response is read straight from the frozen snapshot.

1. `objectives` → resolve `slug` to the row; read `current_revision_id`.
2. `objective_revisions` → load the live revision's metadata (`title`, `summary`).
3. `objective_revision_nodes` → load the included nodes (`is_included = true`; skipped rows never reach the public view); join `guides` → `guides.current_revision_id` → `guide_revisions` for each node's live title/summary (the variant is frozen, its content is current).
4. `objective_revision_edges` → load the frozen projected edges for the revision.
5. **Derive levels in the app** by topological layering over the loaded edges (not stored; see [Objective levels](#objective-levels)), and return `{ nodes, edges }` for the graph UI to render. The `is_target` nodes drive the "this objective helps you reach …" display.

