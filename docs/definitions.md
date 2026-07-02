
## Guide
A guide is the atomic unit of knowledge in Bluelearn.
- Each guide covers one specific concept or skill, whether practical ("how to") or theoretical ("understanding").
- Guides exist only once within the platform and are designed to be reused throughout the knowledge graph.

## Knowledge Graph
A Knowledge Graph is the complete structured network that represents all learning content in BLUE and the relationships between them.

It consists of:
- **Nodes**: entities such as guides, variants, subjects, learning paths, and other learning structures
- **Edges**: the relationships between those nodes, such as:
  - **prerequisite dependencies** - what must be learned first
  - **related guides** - inline links and references
  - **variants link** to the canonical guide 
  - **subject membership** - which subjects a guide belongs to
  - **learning paths memberships** - connections between guides and curated learning paths

## Walkthrough
A walkthrough is an automatically generated learning journey derived from the knowledge graph when a learner selects a specific goal guide. It represents all prerequisite knowledge required to understand that goal and organises it into a structured hierarchy of levels. These levels are not determined by the author - it is determined by the system based on prerequisites.

Each level contains a set of guides that:
- can be learned in any order within that level
- are independent of one another
- only depend on guides from lower levels

As a result, a walkthrough is not a linear sequence but a layered structure that progressively builds from foundational concepts up to the selected guide, always reflecting the current state of the knowledge graph.

## Level
A level groups together guides that can be learned in any order before progressing further.

Levels are calculated automatically based on prerequisite relationships rather than being assigned by authors. Because walkthroughs are generated dynamically, the same guide may appear at different levels depending on the learner's chosen goal.

## Learning Path
A learning path is a curated linear sequence of guides built from the knowledge graph created for a specific audience or objective. They can include multiple end goals, recommend particular teaching approaches, and intentionally simplify or tailor the learning journey.

Unlike walkthroughs, which include every prerequisite automatically, learning paths allow curators to select specific guides, choose preferred variants, and intentionally omit guides that are unnecessary for the intended audience or learning objective, and reorder guided within the same level.

## Variant
A variant is an alternative form of the same guide that preserves the core concept but changes how it is presented or applied.

Variants exist to adapt a single guide to different needs without duplicating knowledge.
They may:
- present different practical approaches to achieving the same outcome
- offer different explanations or conceptual framings of the same idea
- reflect cultural, regional, or contextual differences in how the concept is taught or used
- adapt the same concept to different tools, systems, or environments

Despite these differences in presentation or application, all variants connect to the same underlying guide (canonical guide).

## Subject
A subject is a flat, non-hierarchical tag used to label and group related guides within the knowledge graph.

Subjects function similarly to tags on blog posts or social media content. They exist purely for organisation, filtering, and discovery purposes, rather than defining structure or learning flow.