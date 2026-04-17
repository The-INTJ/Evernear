# Brief of Quality And Awesomeness

## 1. Purpose of this brief

This brief is not asking for immediate feature implementation.

The first job is to create a **planning and documentation system** that can guide a long, thoughtful build of this app. The documentation system should be good enough that we can iterate on the plan multiple times before writing real product code, and continue using that system throughout development.

This project is for **me first**, not for a team, not for a deadline, and not for a fast MVP theater exercise. The goal is not “ship something tonight.” The goal is to build toward the real vision without accidentally locking ourselves into bad foundations.

We should still work iteratively, but not in a way that forces fake-short-term choices that will obviously be thrown away.

---

## 2. Product vision

Build a **desktop-first, local-first writing environment for complex story work**, especially fantasy, where the primary problem being solved is **context re-entry**.

This is not just a writing app.
It is closer to **VS Code for stories**.

The core value is that when I come back to a story after time away, I can quickly rebuild my mental map of:

* characters
* places
* concepts
* lore
* relationships
* relevant background notes

without digging through separate scattered documents and without manually recreating my own understanding every time.

This app should treat story text as something that can be **semantically enriched**, not just typed into a blank page.

---

## 3. Core problem

I am not a full-time writer. That means I do not live deeply enough inside the story every day to tolerate high-friction re-entry.

This is especially painful in fantasy because there is a lot to track:

* names
* terms
* factions
* places
* history
* world rules
* linked concepts
* recurring references

Traditional document workflows split this across:

* a story document
* worldbuilding docs
* notes
* comments
* maybe images or extra references

That fragmentation creates friction.

### The problem, stated plainly

I do not just need a place to write.

I need a system that lets me:

* ease into and out of a story
* keep linked context close at hand
* inspect context at different levels of depth
* edit relevant supporting information without losing flow
* understand my old work quickly after time away

---

## 4. Core product idea

### 4.1 Entities, not manual hyperlinks

The system should not rely primarily on hand-placed links inside text.

Instead, it should treat important story terms as **entities**:

* character names
* place names
* titles
* concepts
* items
* factions
* phrases
* etc.

An entity should own:

* its name
* aliases
* matching rules or patterns
* category/type
* color/visual identity
* where it applies
* what it links to

The document should be parsed by the entity system rather than requiring me to manually link every occurrence.

---

### 4.2 Targets can be slices, not only full documents

An entity should be able to point to:

* a full document
* a bounded region inside a document
* maybe later an image, note, card, or other resource

The important part is that the system should remember not just “go to this doc,” but potentially “go to this exact relevant section.”

That matters because often I do not need the whole lore page.
I need the 5 relevant lines.

---

### 4.3 Multiple levels of interaction

When I encounter an entity in the story, I may want different levels of engagement:

* **Hover**: quick preview / refresher
* **Click**: open focused view of target content
* **Drag / open as separate pane/window**: persistent side reference while writing

The exact UI can evolve, but the principle matters:
**context access should be multi-resolution**.

---

### 4.4 Semantic overlay

The story should be able to visually reveal its structure.

I want the ability to toggle on a semantic overlay so that:

* characters may be one color
* places another
* enemy entities another
* concepts another
* etc.

There should be some kind of legend or clear mapping.

This is not decorative.
It is a re-entry tool.

---

### 4.5 Lightweight, low-noise annotation

I also want a very subtle note/comment system for moments where I notice something while reading and want to capture a thought without cluttering the whole document.

This should be less aggressive than standard Google Docs comments:

* lower visual noise
* minimal interruption
* more personal than collaborative
* not centered around email notifications or loud review workflows

---

## 5. What this app is and is not

### It is

* a desktop writing workspace
* local-first
* single-user first
* story-centric
* entity-aware
* context-aware
* designed for long-form, complex narrative work

### It is not

* a cloud-first SaaS
* a collaboration-first editor
* a generic note app
* a rent-capture writing platform
* a tool that traps authors away from their own files/data

Author ownership matters.

Even if I ever charge money, this should remain fundamentally respectful of the user’s ownership of their work.

---

## 6. Product philosophy

### 6.1 Local-first by default

The app should assume:

* local files
* local projects
* local storage
* local control

Cloud is not part of the core vision.

### 6.2 Desktop-first by design

This makes the most sense as a desktop app because:

* multi-pane workflows matter
* multi-monitor workflows matter
* persistent local files matter
* serious writing sessions feel desktop-native

### 6.3 Build for actual fit, not fake speed

We do not need to optimize for “demo fast at all costs.”

We do need:

* iteration
* working vertical slices
* frequent validation of whether the product is becoming what I want

But we do **not** need to force the kind of MVP that obviously builds the wrong thing.

### 6.4 Avoid dead-end shortcuts

We should be careful about building a simplistic editor foundation that would obviously need to be trashed if it blocks the real product.

Some throwaway work is acceptable.
Foundational stupidity is not.

---

## 7. Current stack direction

Use:

* **Electron**
* **React**
* **TypeScript**
* **Vite**
* **Lexical** for the editor layer
* **SQLite** for local project storage

Likely supporting choices:

* a small preload bridge
* very limited IPC surface
* state management only as needed, not by fashion
* keep the renderer relatively dumb and focused on UI

### Why Electron

Electron is preferred here because:

* this is initially just for me
* I value buildability and ecosystem familiarity
* AI/codegen is likely to be more useful in Electron’s ecosystem
* I would rather optimize for “actually gets built” than “architecturally pure shell”

Security should still be taken seriously, but in a sane way:

* local-first
* no remote content by default
* narrow preload API
* keep boundaries clean

---

## 8. High-level architecture direction

The app should not be modeled as “a text editor with hyperlinks.”

It should be modeled as something like:

* **documents**
* **entities**
* **aliases / match rules**
* **entity targets**
* **bounded slices**
* **annotations**
* **views / panes / layout state**
* **semantic categories**
* **project metadata**

This is important.

The moat is not the shell.
The moat is the data model and interaction model.

---

## 9. Important concepts to design early

These should be documented before serious implementation.

### 9.1 Project

A local writing project containing documents, entities, metadata, preferences, maybe assets.

### 9.2 Document

A piece of editable content. Could be story text, lore, notes, reference material.

### 9.3 Entity

A first-class object representing a meaningful in-world thing or concept.

### 9.4 Alias / matching rule

How the system recognizes an entity in text:

* literal terms
* variants
* maybe regex/pattern rules
* maybe document scope rules

### 9.5 Slice

A bounded region within a document that can be targeted and previewed.

### 9.6 Annotation

A lightweight personal thought marker, lower-noise than comments.

### 9.7 Semantic category

The grouping that drives colors, overlay behavior, filtering, and legend display.

### 9.8 View mode

Different ways content can be inspected:

* hover preview
* pane
* focused doc
* detached/floating later if appropriate

---

## 10. Development philosophy

### 10.1 Documentation-first

Before product code, build the internal documentation system for the project.

This should include:

* structured docs
* architecture notes
* ADRs
* phased plans
* feature specs
* open questions
* tradeoff logs
* backlog/priorities
* experiment notes
* validation notes

The docs should be good enough to guide both human thinking and Codex implementation.

### 10.2 Think hard before building

Codex should not be used like a code blender.

It should first help:

* clarify the architecture
* refine concepts
* identify risks
* propose sequence
* separate foundational work from nice-to-have work
* identify what must be proven early

### 10.3 Build in vertical slices

Once implementation begins, each milestone should prove something meaningful.

Good milestones are not:

* random disconnected components
* broad shallow scaffolding with no end-to-end flow

Good milestones are:

* a small but real workflow that demonstrates the product idea

### 10.4 Preserve optionality

Avoid early decisions that make later entity/slice/overlay behavior hard.

---

## 11. What “MVP” means here

MVP does **not** mean “the fastest generic editor we can ship.”

MVP should mean:

* the smallest version that proves the real product idea

That likely means some things must be present surprisingly early, because without them we are not testing the actual concept.

For example, a plain editor without meaningful entity behavior may be too fake to teach us much.

At the same time, MVP does **not** require every dream feature.

We need to define a “truthful MVP,” not a “fake MVP.”

---

## 12. Likely implementation sequence

This is broad guidance, not a rigid mandate.

### Phase 0: Planning and documentation system

Before major app code:

* establish doc structure
* create architecture docs
* define core concepts
* define MVP philosophy
* define sequencing
* identify unknowns
* write ADR templates and process
* create quality rules for future implementation
* create feature/spec templates
* create experiment logs

### Phase 1: Foundational technical spike

Prove the stack and core shell:

* Electron + React + TypeScript + Vite running cleanly
* Lexical integrated
* SQLite integrated
* local project opening/saving established
* small preload boundary defined and working

This phase is not feature-complete. It is technical proof.

### Phase 2: Minimal honest core workflow

Prove the central product loop:

* create/open project
* create documents
* create simple entities
* match entities in story text
* visually indicate them
* hover to preview linked target
* click to open target in a side pane or focused pane

If this works well, the concept is alive.

### Phase 3: Slice awareness

Introduce bounded targets:

* entity points to section, not only full doc
* preview reflects bounded region
* focused open still indicates the relevant bounded area

This is likely one of the most important differentiators.

### Phase 4: Semantic overlay + filtering

Introduce:

* categories
* colors
* legend
* toggles
* maybe document-scoped visibility

This is core to the re-entry experience.

### Phase 5: Lightweight annotation system

Add subtle personal thought capture.

### Phase 6: Layout sophistication

Only after core flows feel right:

* multi-pane refinement
* detachable windows if justified
* better layout persistence
* multi-monitor friendliness

### Later / optional

* images or non-document targets
* exports
* packaging polish
* Mac support
* distribution
* more advanced matching logic
* richer project analytics/search
* maybe AI-assisted author tools later, but not as the identity of the product

---

## 13. What must be proven early

These questions matter more than polish:

1. Can entity-aware writing actually feel good in a real editor?
2. Can we match terms in a way that is powerful without becoming visual spam?
3. Can slice-based references be implemented in a stable enough way to matter?
4. Does semantic overlay genuinely help me re-enter old work?
5. Can the data model support the concept without becoming brittle?

If these are not working, surface-level polish is irrelevant.

---

## 14. Risks and design tensions

These should be explicitly tracked.

### 14.1 Over-linking / visual noise

If every repeated term lights up aggressively, the document becomes unreadable.

### 14.2 Slice tracking complexity

Bounded regions are easy to imagine and harder to maintain when documents change.

### 14.3 Editor complexity

The more behavior we add directly into the editor, the more careful we must be about state and UX.

### 14.4 Becoming a worse Obsidian

If we drift toward “just a notes-and-links app,” we lose the special thing.

### 14.5 Becoming a worse word processor

If we drift toward generic editing features too early, we lose focus.

### 14.6 Premature windowing complexity

Detached windows and fancy layout systems are cool, but could eat time before the central concept is proven.

---

## 15. Anti-goals

Do not optimize for:

* cloud sync first
* collaboration first
* monetization mechanics
* plugin ecosystem first
* mobile first
* generic document editor parity
* feature count for its own sake

Do not default to:

* a standard WYSIWYG product mindset
* a generic note-taking app architecture
* overbuilding exports before the core workflow is enjoyable

---

## 16. Quality bar

The quality bar is not just “code runs.”

The quality bar is:

* the architecture remains comprehensible
* the docs stay useful
* the core product concept remains visible
* implementation choices preserve the long-term idea
* vertical slices are real and meaningful
* UX choices are in service of re-entry and context, not novelty
* the app feels like it is helping a writer think, not just store text

---

## 17. What Codex should do first

Before major feature coding, Codex should create a durable planning/documentation structure for this project.

That should likely include:

* `/docs/vision`
* `/docs/product`
* `/docs/architecture`
* `/docs/adr`
* `/docs/features`
* `/docs/ux`
* `/docs/experiments`
* `/docs/roadmap`
* `/docs/glossary`
* `/docs/open-questions`

And within that, create:

* a project vision document
* a problem statement
* core concepts glossary
* system architecture overview
* initial ADRs
* phased development plan
* MVP definition
* risk register
* UI/interaction principles
* data model draft
* editor strategy notes
* validation criteria for each phase

It should also establish templates for:

* feature briefs
* ADRs
* experiment writeups
* open question tracking
* milestone retrospectives

---

## 18. How Codex should behave

Codex should:

* think deeply before implementing
* challenge weak assumptions
* preserve the core product idea
* avoid shallow scaffolding for its own sake
* prefer clear docs over premature code
* recommend sequencing, not just dump architecture
* identify which problems are foundational vs deferrable
* avoid building throwaway fake-MVP structures unless clearly marked as experiments

Codex should not assume:

* we need speed over thoughtfulness
* we need a cloud product
* we need team workflows
* we need to imitate mainstream writing software

---

## 19. One-sentence product identity

**A local-first desktop writing environment for story authors, especially fantasy writers, that uses entities, linked context, semantic overlays, and low-friction views to dramatically reduce the pain of returning to complex narrative work.**

---

## 20. Final framing

This project should be treated as a serious attempt to build the right thing, not as a hustle app and not as a toy demo.

We are allowed to iterate slowly.
We are allowed to rethink architecture.
We are allowed to spend time on planning.

But every step should serve the central idea:

**help the writer regain context, stay in flow, and shape complex narrative worlds without drowning in their own documentation.**
