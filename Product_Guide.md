# Evernear — Product Guide

This is the north star for the product. It is deliberately short. Longer planning material lives in [FOR_HUMAN_BUSINESS--DOC.md](FOR_HUMAN_BUSINESS--DOC.md), [FOR_HUMAN_CODE--DOC.md](FOR_HUMAN_CODE--DOC.md), and [FOR_HUMAN_AND_AI_ROADMAP--DOC.md](FOR_HUMAN_AND_AI_ROADMAP--DOC.md); anything here that contradicts those docs is the side that should win.

## For authors and anyone curious

Evernear is a desktop writing environment built for the moment you open a fantasy project you haven't touched in months and realize you don't quite remember your own world anymore. You can keep writing wherever you already write — Google Docs, Scrivener, whatever — and Evernear is the place you come back to when you want your characters, places, lore, and the structure of your manuscript to greet you again.

Here's the trick: **you never hand-link anything.** You tell Evernear once, the first time you 'link' a word or phrase, that "Harry Potter" should reference this spot in your character doc. From then on, every time you paste or type that word(s) or phrase, the app instantly knows. No right-clicking, no wiki-style `[[brackets]]`, no tagging — you just write, and the people and places you've defined light up on their own. Hover one, and a little window snaps straight to the doc you linked.

More than one doc? No problem, you can link as many as you want, and scroll in the pop-up, or click into it to get a whole panel -- with live editing!

## For writers who also program

Evernear is a local-first Electron + ProseMirror desktop app whose central loop is *frictionless rehydration*. An author who edited their manuscript elsewhere — Google Docs, Scrivener, a round of copy edits from a year ago — can paste the entire exported document into Evernear and have it light up immediately.

The architecture that makes a full destructive re-paste safe is a strict separation between **truth** and **projection surface**:

- **Entities are the truth.** Aliases, matching rules, slices, slice boundaries, and annotations all live as Entities, event-sourced and durable. They are the canonical record.
- **No document holds truth.** They hold prose and nothing else. They don't own links, slice data, or highlight records. They are streams of text that entity rules are evaluated *against* to produce derived decorations live.

Because no document carries any of the load-bearing metadata, blowing it away and pasting a fresh copy is not destructive — it's just feeding new text into the same regex pipeline. Entity detection is regex-based matching rules (literals, aliases, patterns) evaluated live over visible text; document *structure* (book, part, chapter, section) is likewise regex against the pasted prose, so the outline rehydrates with no author annotation. Slice boundaries and annotations ride a shared `TextAnchor` substrate and re-resolve against the new text. Everything is append-only event-sourced, so nothing is lost. Clipboard output stays clean — `Ctrl+A` / `Ctrl+C` yields prose, never editor chrome — so the round trip back out to Google Docs or Scrivener is as frictionless as the one in.

## The laser-focused core loop

1. An author returns to a manuscript after months. They made edits — possibly a full round of copy edits — in Google Docs, Scrivener, or similar, and *never* synced those edits back into Evernear.
2. They don't remember their world as well as they used to. The people, places, and rules have drifted out of working memory.
3. They export the document from the external tool and paste the whole thing into Evernear.
4. Evernear's entity regex-highlighting and regex-based document-structure matching hydrate the manuscript on the spot: entity matches become live highlights, chapter / part / book structure is re-derived, existing entity-to-slice links continue to resolve against the new prose, and the edits from the external tool are now simply present. The manuscript is a fresh projection surface; the entity truth underneath it never moved.
5. From that frictionless paste, the panel workflow — hover to preview, click to pin, persistent slice viewer — is equally frictionless. Re-entry is achieved without bookkeeping.

The mirror case matters equally: an author can paste *out* of Evernear into Scrivener, Google Docs, edit on the go, and paste back. Round-tripping — including into and out of sliced regions — must stay clean.

## Unapologetic desktop UI

Evernear is a desktop application built precisely for a multi-monitor writing workflow.

- **Panels are draggable and stackable.** Context is summoned as first-class panels that can be moved, docked, and piled. When a panel stacks over another, a back arrow takes the author *back* rather than leaving them lost three lore-hops deep.
- **Slices are delineated, not boxed in.** Inside a document, slice regions are marked with subtle horizontal and vertical colored bars — quiet edge indicators that respect the prose. No heavy cards, no framed boxes, no chrome crowding the text.
- **Annotations stay quieter still.** Default styling is something like a dotted gray underline; the author's eye goes to the words, not to our affordances.
- **Built for our workflow first.** The layout assumes multiple monitors, persistent side panels, and serious long sessions. We take advantage of the space instead of hiding from it.

## What we are not

Evernear is not a cloud SaaS, not a collaboration tool, not a generic notes app, and not a manual-linking wiki. Links are derived from entity rules, not hand-placed. Structure is derived from regex, not laboriously tagged. The author's prose is never held hostage by our decorations, and the UI is not negotiated down to a lowest common denominator.

## Non-negotiables

- The least manual linking, ever. Define an entity once; matches happen on their own, forever.
- Entities hold truth. Docs are a projection surface, safe to destroy and re-paste.
- Paste-in and paste-out stay frictionless. Clipboard output is clean prose; clipboard input hydrates fully.
- Entities and document structure are regex matching rules evaluated against current text, never stored as document truth.
- Slice boundaries and annotations share one anchor substrate so they survive edits, including full re-paste.
- History is event-sourced; nothing the author does is lost.
- The UI is opinionated, desktop-native, and built for multi-monitor work.
- Local-first, desktop-first, single-user-first. The author owns the file.

## One-sentence identity

**Evernear is the desktop writing environment an author pastes their manuscript into after months away, and instantly gets their world, their structure, and their links back — with no ceremony in, and clean prose on the way back out.**
