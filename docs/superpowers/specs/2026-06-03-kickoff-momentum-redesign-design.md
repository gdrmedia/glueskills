# Creative Kickoff — "Momentum" editor redesign (exploration)

**Date:** 2026-06-03
**Branch:** `kickoff-momentum-redesign` (off `main`, not pushed — local preview only)
**Status:** approved design, exploration build

## Goal

Re-skin the Creative Kickoff **edit screen** in the "Momentum" visual direction
exported from Claude design (`glue-work/_temp/Glue Skils/concepts/concept1_progress.jsx`),
so Gui can see/feel it locally before deciding whether to take it further. No push.

What Gui liked and we are porting: font sizes, palette, the per-section
percentage rings, the panel sizes/paddings, and the smooth micro-transitions.
**Explicitly omitted:** the dark "Submission progress / XP" callout bar.

## Scope

In scope: `KickoffEditor` (`src/components/project-kickoff/kickoff-editor.tsx`)
and the presentational components it renders.

Out of scope (untouched): the route/page `[id]/page.tsx`, data fetching, autosave,
status transitions, nudge plumbing, the brief **list**, and the read-only
**document view**. `KickoffEditor`'s props stay identical so the page is unchanged.

## Layout (Momentum mockup → live data)

Faithful to the single-section layout in the screenshot:

- **Campaign header**: brief title + status badge; right side = SaveIndicator +
  Submit/Approve/Reopen transition button(s) + "Back to list".
- **Deliverable pills** (Case Study / Social / Award, orange when active) =
  the existing deliverable toggles; toggling adds/removes sections 4/5/6 from the nav.
- **Dark XP/progress bar** — OMITTED.
- **Left ring-nav**: one row per `activeSections` entry — completion ring,
  number that becomes a green check at 100%, title, "x/y done". Click sets active section.
- **Right panel** (one section at a time): "SECTION N / 7" eyebrow, title + small
  section-% ring, one-line blurb, controls row (status select + owner dropdown +
  Nudge), the section's fields, the approval control, then a Back / Save & continue footer.
- **Per-field**: green check pops in when filled; pink focus glow; rings animate via
  `stroke-dashoffset .5s`; fields fade-up on mount.

## Data mapping

| UI | Source |
|---|---|
| Title / status | `kickoff.title`, `kickoff.status` |
| Pills | `kickoff.deliverables` via `toggleDeliverable` |
| Nav sections | `activeSections(kickoff.deliverables)` |
| Section % ring + "x/y done" | required-fields-filled per section (mirror of `missingRequired` logic) |
| Status select | `section_status` via `onPatch` |
| Owner | Clerk `users` dropdown via `onPatch({ owner })` |
| Nudge | existing `NudgeDialog` + `nudgeOwner` |
| Fields | `FieldInput` data (`field.type` is only `text` / `textarea`) |
| Approval | existing `ApprovalControl` |
| Submit/Approve/Reopen | existing `doTransition` (moved into header) |

## Honoring the real schema

The live form is text/textarea only (e.g. Industry is a text field, not the mockup's
dropdown). We style those plus the status/owner selects. We do **not** introduce the
mockup's chips/slider/toggle controls — the data model doesn't use them.

## Styling & isolation

- Momentum `--glue-*` tokens scoped under a `.momentum-kickoff` wrapper so the rest of
  the GlueSkills dashboard keeps its purple Atelier theme.
- Baloo 2 (numerals/headline accents) via a Google-Fonts `@import` in `globals.css`,
  consistent with the repo rule "fonts on body, not in `@theme`". Body stays Inter.
- `gs-*` keyframes (pop, fade-up) added to `globals.css`, namespaced; includes the
  `prefers-reduced-motion` guard. All edits additive and reversible.

## Judgment calls (approved)

- Confetti/celebration toast: **off** (tied to the removed XP bar).
- Submit/Approve/Reopen: **in the header**, reachable from any section; footer stays
  clean (Back / Save & continue = prev/next navigation, autosave already persists).

## Out of scope / non-goals

- No DB, schema, validation, autosave, or transition logic changes.
- No restyle of list or document view (this branch).
- Not merged or pushed; purely a local look-and-feel preview.
