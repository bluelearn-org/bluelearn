# Agent Guide — Contribute Editor

Welcome to the **Contribute Editor** module! This guide outlines the implementation details, architectural decisions, and agent guidelines for working on the markdown/math editor interface.

---

## 1. Domain Context & Integration

The Contribute Editor is the content-creation interface for BLUE's knowledge graph. 

### Key Integration Points
* **Markdown Output**: The editor generates standard Markdown content which is stored in the `body` field of the `guide_revisions` table.
* **Topic Focus**: Per BLUE's guidelines (see [overall-system.md](file:///home/carterdeb/0-srcs/js-ts/bluelearn/docs/overall-system.md)), each guide covers exactly one atomic topic and relies on prerequisites. The editor enforces this focus.
* **H1 Restriction**: The title of the guide is versioned separately in `guide_revisions.title`. Therefore, the editor body itself is restricted from containing H1 (`#`) elements to keep formatting clean.

For wider architecture, monorepo setup, and database design, refer to the root documentation files:
- [docs/architecture.md](file:///home/carterdeb/0-srcs/js-ts/bluelearn/docs/architecture.md) — Frontend (TanStack Start, React 19) to API (Hono on Cloudflare Workers) mapping.
- [docs/overall-system.md](file:///home/carterdeb/0-srcs/js-ts/bluelearn/docs/overall-system.md) — The directed acyclic graph (DAG) structure of guides and prerequisite edges.
- [docs/database-schema.md](file:///home/carterdeb/0-srcs/js-ts/bluelearn/docs/database-schema.md) — Detailed specifications for `guide_bases`, `guides`, and `guide_revisions`.

---

## 2. Core Editor Architecture & Key Files

The editor is a customized markdown and LaTeX-capable editor built on top of [MDXEditor](https://mdxeditor.dev/) (which in turn uses [Lexical](https://lexical.dev/) under the hood).

### Key Code Files
- [Editor.tsx](file:///home/carterdeb/0-srcs/js-ts/bluelearn/app/src/components/contribute/editor/Editor.tsx) — Main editor wrapper. Sets up the MDXEditor instance, configures plugins (headings, lists, code block, tables, images, and math), handles auto-save to `localStorage` (`mdx_studio_content`) with a 1-second debounce, and manages initial state.
- [EditorToolbar.tsx](file:///home/carterdeb/0-srcs/js-ts/bluelearn/app/src/components/contribute/editor/EditorToolbar.tsx) — A custom toolbar offering basic styling buttons, block type selectors, list toggles, math block insertion, and copy/upload buttons.
- [CodeBlockShortcutListener.tsx](file:///home/carterdeb/0-srcs/js-ts/bluelearn/app/src/components/contribute/editor/CodeBlockShortcutListener.tsx) — A Lexical node listener that intercepts typed/pasted multi-line ` ``` ` formatting, parsing them into native code block nodes.
- [H1RestrictionListener.tsx](file:///home/carterdeb/0-srcs/js-ts/bluelearn/app/src/components/contribute/editor/H1RestrictionListener.tsx) — Restricts Heading 1 (`#`) formatting inside the editor and automatically downgrades it to Heading 2 (`##`) with a toast notification to the user.
- [MarkdownLinkImageShortcutListener.tsx](file:///home/carterdeb/0-srcs/js-ts/bluelearn/app/src/components/contribute/editor/MarkdownLinkImageShortcutListener.tsx) — Custom listener for link and image shortcut patterns.
- [math-plugin/](file:///home/carterdeb/0-srcs/js-ts/bluelearn/app/src/components/contribute/editor/math-plugin/) — A custom plugin integrating [mathlive](https://cortexjs.io/mathlive/) for LaTeX formula editing.

---

## 3. Agent Guidelines & Collaboration Model

To ensure high-quality, robust contributions, all agents working on this editor MUST follow these three core guidelines:

### Guideline 1: Always Ask Clarifying Questions First
Before implementing any changes or features in the editor implementation:
* Review requirements and look for ambiguity.
* Present different design paths or implementation choices directly to the user (e.g., custom listener logic vs. standard plugin features).
* Align on design decisions before writing any code. Do not make assumptions.

### Guideline 2: Practice the Scientific Method via Logging & Collaborative Verification
Lexical editor state transformations and cursor adjustments can be highly complex. You should debug and verify issues using the scientific method collaboratively:
1. **Hypothesize**: Formulate a clear hypothesis of why a bug is occurring or how a node transformation behaves.
2. **Instrument / Log**: Inject targeted, temporary diagnostic log statements (e.g., printing event properties or states via `console.log` on updates) into the component code.
3. **Collaborative Verification**: Do not spin up duplicate server instances in the background. Instead, ask the user to test the changes on their local development server (already running on their machine) by triggering the manual interactions, and request that they paste the browser developer tools console logs back to you.
4. **Analyze & Iterate**: Examine the user's reported logs, verify if the browser state matches the hypothesis, and adjust the code based on actual observations.

### Guideline 3: Clean Up Diagnostic Logs Before Completion
Once a feature or bugfix is fully verified and in a **correct state**, remove all diagnostic/debugging log statements. Production error logs (such as `console.error` for failed clipboard copies) should remain, but any verbose node structure logging must be cleaned up to keep the codebase clean.

### Guideline 4: Adhere to Git and Sign-off Guidelines
When committing any changes to the repository:
* **Conventional Commits**: Loosely follow conventional commits (e.g., `feat(app): ...` or `fix(app): ...`).
* **DCO Sign-off**: Every commit MUST be signed off using the `-s` flag (`git commit -s`). This appends a `Signed-off-by:` line and is your statement that you have the right to submit the change under the project's licenses (per the root [CONTRIBUTING.md](file:///home/carterdeb/0-srcs/js-ts/bluelearn/CONTRIBUTING.md#L88)).

### Guideline 5: Update the User Before Committing
* **Do Not Pre-emptively Commit**: Always update the user with your understanding, plan, and implemented changes, and wait for their explicit approval/feedback before committing any changes to the repository. Keep descriptions technical, concise, and focused on high-level ideas, avoiding overly verbose explanations.

