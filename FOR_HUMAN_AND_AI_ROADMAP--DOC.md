# FOR_HUMAN_AND_AI_ROADMAP--DOC

## Last change
2026-04-17: added selection-driven Everlink authoring, panel-based slice placement, and fail-closed anchor-repair work to the phase map.
2026-04-17: added document-organization phases, large-import and clean-copy proof points, and reserved slice-preserving text transfer as an explicit later concern.
2026-04-17: aligned the phased plan with the locked ProseMirror decision and added event-log plus checkpoint replay as a Phase 1 proof gate.

## Why this exists
This is the shared execution map for one human decision-maker and repeated AI implementation passes.
It exists so future passes can see:

- what order matters
- what has to be proven before the next phase
- which ideas are load-bearing enough to justify a spike before feature momentum buries the risk

This is not a staffing document.
It should name proof, sequence, and exit criteria, not pretend a committee exists.

## Load-bearing ideas
- Document organization spine.
  - Folders organize documents now; anchored outline nodes can later navigate a huge document without turning chapters into separate documents by force.
- `TextAnchor` healing under live edits.
  - This serves both reusable slice boundaries and direct document annotations.
- Selection-driven Everlink authoring.
  - It must bootstrap entity truth and slice placement from a selection without turning the manuscript into a manual-link document.
- Live visible-range matching.
  - Matches are derived on demand from current text, never precomputed as document truth.
- Matching normalization plus performance while typing and scrolling.
- Clean text interoperability.
  - Writers need to paste large prose in and copy clean prose back out without editor-only artifacts leaking into the clipboard.
- Event-log and checkpoint replay.
  - History must stay fast and correct enough that replay, rebuild, and restore remain trustworthy.
- Future text-transfer provenance.
  - Slice-preserving copy or move is later, but the architecture must leave room for it now.
- Pretext layout fit.
  - It may help solve long-document layout and visible-range mapping before the repo commits too hard to a document-view strategy.
- Document persistence.
  - Snapshot writes plus plain-text projection should be proven early so the editor host does not quietly dictate the storage model later.

ProseMirror editor-host fit is already resolved by EXP-003, EXP-004, and ADR-005. Phase 1 no longer needs to reopen that decision.

## Phase 0: Documentation spine
Before major app code:

- keep the top-level business, code, and roadmap docs aligned
- define the project-tree model around folders plus generic documents
- document that organization is orthogonal to entities and slices
- reserve `DocumentOutlineNode`, `ProjectNavNode`, and `TextTransferProvenance` in the shared vocabulary
- document the clean copy-out promise and large-import workflow
- create ADRs for stack, storage, and proof gates
- create `docs/experiments`
- create reusable templates for feature briefs, experiments, retrospectives, and ADRs
- make the load-bearing bets easy to find

Validation criteria:

- the repo clearly shows where architecture decisions live
- the hard problems are named before implementation pressure blurs them
- no major concept is still trapped inside `Product_Guide.md`
- the organization model is clear enough that future code passes do not improvise folders, kinds, and outline behavior differently

## Phase 1: Load-bearing spikes
Before the honest product loop:

- spike shared anchor healing for slice boundaries and annotations
- spike live visible-range matching, rule normalization, and invalidation while typing
- spike event-log and checkpoint replay with projection rebuild checks
- spike Pretext as a possible long-document layout and visible-range mapping helper
- prove the document snapshot model round-trips cleanly through SQLite
- prove 50k+ word paste-in and save-reload round trips cleanly
- prove `Ctrl+A` and `Ctrl+C` copy clean prose out even when derived highlights or boundary decorations exist

Validation criteria:

- insert, delete, split, and join edits do not make shared anchors feel obviously fragile
- matching handles capitalization, possessives, and aliases without collapsing trust
- visible-range matching stays responsive while typing and scrolling, with no need for precomputed document match tables
- if highlighting is disabled, the typing path stays free of unnecessary match work
- event-log writes stay fast enough at typing pace, historical opens stay acceptable, and rebuilds match live projections exactly
- it becomes clear whether Pretext helps enough to influence long-document layout design
- document snapshots persist and reload without losing structure or corrupting plain-text projection
- imported long-form prose stays editable without obvious degradation
- clipboard output does not include entity markup, slice chrome, or other UI-only artifacts

Phase 2 is blocked until these pass well enough to trust.

## Phase 2: Foundational shell
Prove the technical baseline:

- Electron, React, TypeScript, and Vite running cleanly
- the chosen editor foundation integrated
- SQLite integrated
- local project opening and saving working
- a small preload boundary defined and working

Validation criteria:

- a local project opens, loads a document snapshot, and saves it back cleanly
- the main, preload, and renderer boundary stays typed and narrow
- the editor host does not force architecture shortcuts already rejected in Phase 1

## Phase 3: Writing workspace spine
Prove the writing workspace before semantic overlays depend on it:

- create and open a project
- create folders and generic documents
- reorder documents and move them between folders
- open, edit, and save large imported story and reference documents
- switch quickly between imported story and world docs

Validation criteria:

- the project tree restores correctly after closing and reopening
- folders help organization without becoming a second semantic system
- documents stay generic rather than splitting early into behavior-heavy kinds
- large imported material feels native enough to keep using

## Phase 4: Truthful core loop
Prove the central product promise:

- create entities and matching rules
- associate entities with slices
- start `Everlink it!` from selected story text, with explicit attach-to-existing-entity behavior and target-document choice
- derive highlights inside story text
- hover to preview slices in a modal
- click to open a persistent panel or focused document view

Validation criteria:

- the workflow already helps with re-entry on imported real text, not just toy samples
- entity workflows do not depend on a special document taxonomy
- net-new selections never silently auto-reuse merely similar entities
- derived highlights are useful without becoming immediate visual spam
- modal and panel feel like one continuous workflow rather than two unrelated features

## Phase 5: Boundary-aware context and annotations
Introduce the shared anchor substrate in earnest:

- reusable slice boundaries
- boundary-aware document view
- pending slice placement inside panel document view, including visible temporary rails and auto-fill on commit or blur when the slice is still empty
- boundary indication and editing affordances
- direct document annotations using the same anchor model
- default quiet annotation styling such as a dotted gray underline, with author-tunable styling later

Validation criteria:

- slice boundaries and annotations survive normal edits with acceptable healing
- mapped anchors repair by exact text plus context when needed, and ambiguous repair fails closed instead of jumping to the wrong lore
- annotation visuals stay noticeably quieter than entity highlights
- the shared anchor model feels like one system, not two overlapping hacks

## Phase 6: Outline navigation and overlap inspection
Introduce:

- `DocumentOutlineNode` entries for `book`, `part`, `chapter`, `section`, or custom navigation inside a document
- project-tree expansion from folders and documents into navigable outline entries where useful
- `All Slices` toggle
- overlap visualization
- clearer multi-boundary presentation
- merge or link workflows where useful

Validation criteria:

- outline nodes stay navigable after normal edits and make huge single-document manuscripts easier to re-enter
- overlap tools make old material easier to inspect rather than busier to read
- shared boundaries remain understandable when several slices refer to the same region

## Phase 7: Layout and ownership polish
Only after the core flows feel right:

- better panel persistence
- stronger export and package behavior
- detachable windows or multi-monitor behavior only if justified by actual use
- broaden history from restore-first into checkpoints and timeline surfaces

Validation criteria:

- reopening a project restores useful context instead of a blank shell
- export and package behavior make author ownership feel real, not promised
- history feels durable enough that restore and replay can be trusted

## Later or optional
- images or non-document targets
- richer packaging polish
- deeper search or analytics
- graph-style relationship views
- slice-preserving `Move Slice` workflows after anchored structure, clipboard provenance, and history replay are stable
- collaboration or cloud features
- AI-assisted authoring as product identity
  - not the direction here

## Current recommendation
- Keep ProseMirror as the editor foundation.
- Keep organization orthogonal to entity meaning.
- Keep the shared anchor problem load-bearing and explicit.
- Do not precompute or persist document match sets.
- Keep regex in entity matching and keep slice repair on exact text plus context.
- Explore Pretext before locking the long-document layout strategy.
- Preserve clean copy/paste behavior and leave room for future slice-aware transfer.
- Do not let a "working" editor shell outrun the proof needed for anchors, matching, persistence, and history replay.
