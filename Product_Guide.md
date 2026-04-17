# Evernear — Product Guide

This is the north star for the product. It is deliberately short. Longer planning material lives in [FOR_HUMAN_BUSINESS--DOC.md](FOR_HUMAN_BUSINESS--DOC.md), [FOR_HUMAN_CODE--DOC.md](FOR_HUMAN_CODE--DOC.md), and [FOR_HUMAN_AND_AI_ROADMAP--DOC.md](FOR_HUMAN_AND_AI_ROADMAP--DOC.md); anything here that contradicts those docs is the side that should win.

## For authors and anyone curious

Evernear is a desktop writing environment built for the moment you open a fantasy project you haven't touched in months and realize you don't quite remember your own world anymore. You can keep writing wherever you already write — Google Docs, Scrivener, whatever — and Evernear is the place you come back to when you want your characters, places, lore, and the structure of your manuscript to greet you again. Paste your latest exported draft in, and the people and places in it light up in context; hover one, and a little window reminds you who they are and shows the moments that matter. Nothing is trapped here: you can always select all, copy out, and paste the clean prose right back into the tool you left.

## For writers who also program

Evernear is a local-first Electron + ProseMirror desktop app whose central loop is *frictionless rehydration*. An author who edited their manuscript elsewhere — Google Docs, Scrivener, a round of copy edits from a year ago — can paste the entire exported document into Evernear and have it light up immediately. Entity detection is regex-based matching rules (literals, aliases, patterns) evaluated live over visible text, producing derived decorations rather than stored links. Document *structure* — book, part, chapter, section — is likewise matched by regex against the pasted prose, so the outline rehydrates without the author annotating anything. Slice boundaries and annotations ride a shared `TextAnchor` substrate so they survive the new paste; all existing entity-to-slice links remain live. From that zero-ceremony paste, the panel/modal/slice-viewer workflow gives the author quick hover previews and persistent context panels. Everything is append-only event-sourced so nothing is lost. Clipboard output stays clean — `Ctrl+A` / `Ctrl+C` yields prose, never editor chrome — so the round trip back out to Google Docs or Scrivener is just as frictionless as the one in.

## The laser-focused core loop

1. An author returns to a manuscript after months. They made edits — possibly a full round of copy edits — in Google Docs, Scrivener, or similar, and *never* synced those edits back into Evernear.
2. They don't remember their world as well as they used to. The people, places, and rules have drifted out of working memory.
3. They export the document from the external tool and paste the whole thing into Evernear.
4. Evernear's entity regex-highlighting and regex-based document-structure matching hydrate the manuscript on the spot: entity matches become live highlights, chapter / part / book structure is re-derived, existing entity-to-slice links continue to resolve against the new prose, and the edits from the external tool are now simply present.
5. From that frictionless paste, the panel workflow — hover to preview, click to pin, persistent slice viewer — is equally frictionless. Re-entry is achieved without bookkeeping.

The mirror case matters equally: an author can paste *out* of Evernear into Google Docs, edit on the go, and paste back. Round-tripping — including into and out of sliced regions — must stay clean.

## What we are not

Evernear is not a cloud SaaS, not a collaboration tool, not a generic notes app, and not a manual-linking wiki. Links are derived from entity rules, not hand-placed. Structure is derived from regex, not laboriously tagged. The author's prose is never held hostage by our decorations.

## Non-negotiables

- Paste-in and paste-out stay frictionless. Clipboard output is clean prose; clipboard input hydrates fully.
- Entities and document structure are defined by regex matching rules and re-evaluated against current text, never stored as document truth.
- Slice boundaries and annotations share one anchor substrate so they survive edits, including full re-paste.
- History is event-sourced; nothing the author does is lost.
- Local-first, desktop-first, single-user-first. The author owns the file.

## One-sentence identity

**Evernear is the desktop writing environment an author pastes their manuscript into after months away, and instantly gets their world, their structure, and their links back — with no ceremony in, and clean prose on the way back out.**
