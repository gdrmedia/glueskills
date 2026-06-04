# Creative Kickoff — Summary (document view) Momentum redesign

**Date:** 2026-06-04
**Branch:** `kickoff-momentum-redesign` (continues the Momentum exploration; local-only, uncommitted)
**Status:** approved design

## Goal

Re-skin the read-only **Summary / document view** (`kickoff-document.tsx`) — the screen shown
when a brief is submitted, under review, or approved — into the Momentum design language,
restructured to match the mockup `glue-work/_temp/Glue Skils/Brief Summary (standalone) 4.html`.
Reflect the redesign work already done (numbered sections, deliverables-as-sections) and
**omit the "Submission complete" readiness banner** (the dark box), as we omitted the editor's
XP bar. Data flow, schema, and transitions are unchanged.

## Font swap (global, affects all Momentum surfaces)

Replace **Baloo 2 → Manrope** at the single source in `globals.css`:
- swap the Google-Fonts `@import` to load Manrope (with the weights currently used for Baloo 2),
- point `--glue-font-logo` at Manrope.

Because `--glue-font-logo` / `.m-num` live in the shared `.momentum-kickoff` scope, this changes
the numerals/headline accents everywhere Momentum applies (editor + list + summary) in one edit.
Body text stays Inter.

## Header

`.momentum-kickoff` wrapper. Title + status badge on the left. On the right, the same `m-btn`
actions used by the editor (replacing the current shadcn `Button`/`Badge`):
- `under_review` → **Reopen / unlock** (`m-btn-outline`)
- `under_review` && approver → **Approve** (`m-btn-approve`, green)
- `approved` && approver → **Reopen** (`m-btn-outline`)
- always → **Back to list** (`m-btn-ghost`)

Transition handler (`doTransition` with `approve` / `reopen`) is unchanged.

## Omit the readiness banner

The mockup's `.banner` ("Submission complete — ready for your review" + 100% ring + XP number +
deliverable pills) is **not** rendered.

## Sticky subnav

`.m-subnav` — horizontal section tabs, sticky at top, active tab = pink (`--glue-primary`)
underline, completed sections show a small green check. Reuses the existing IntersectionObserver
scroll-spy and smooth `scrollIntoView` behavior; only the markup/classes change. First tab is the
**Overview** card; the rest are the numbered shown sections.

## Overview (meta) card

First card, **no section number**. Contents:
- Submission date (`formatDate(kickoff.submitted_at)`), Submitted by (a read-only **avatar chip** —
  pink circle + initials via the existing `initials()` helper + name from `editorNames`).
- When `status === "approved"`: Approved date + Approved by.
- **Attached-deliverable pills** — green-check pills for ONLY the deliverables that are on
  (`kickoff.deliverables[key]` true), labelled Case Study / Social Posts / Award Submission.

## Section cards

`.m-card` — rounded-20, `--shadow-card`, collapsible (chevron; **default open**). One per shown
section.
- **Head:** a **numbered chip matching the editor** (sequential number from the existing
  `navLayout(kickoff.deliverables)` numbering, so a section's number is identical in editor and
  summary) + the section title + a green **"Complete"** meter shown when the section's required
  fields are all filled (reusing the editor's completion rule: required-fields-filled, or
  all-fields-filled when a section has no required fields).
- **Body:** a `300px / 1fr` label/value grid (`.m-rows`) with row separators, rendering each field
  whose answer is non-empty; then an **Approval** badge and **Approval notes** when present.

Only sections with at least one displayable value render (the existing `shownSections` filter).
Section numbering comes from `navLayout` (active position), so a number always matches the editor;
a rare empty-but-active section is simply not shown (its number is skipped).

## Architecture

- New file `src/components/project-kickoff/momentum/summary-parts.tsx` — presentational pieces for
  the document view: `SubNav`, `MetaCard`, `SectionCard`, `Avatar`, `RowGrid`. Keeps the editor's
  `parts.tsx` focused.
- `kickoff-document.tsx` keeps its logic: `shownSections`, `activeSections`, scroll-spy
  (`IntersectionObserver`), `doTransition`, `formatDate`. It gains section numbers from `navLayout`
  and renders the new Momentum parts instead of the shadcn blocks. The `useState` collapse state
  moves into `SectionCard`.
- `globals.css`: the font swap, plus new summary classes (`.m-subnav`, `.m-card`, `.m-cardhead`,
  `.m-rows`, `.m-chip-num`, `.m-deliv-pill`, `.m-avatar`, etc.) added inside the `.momentum-kickoff`
  scope — additive and reversible.

## Reused logic (unchanged)

`activeSections`, `navLayout`, `shownSections` filter, the IntersectionObserver scroll-spy, the
smooth-scroll-to-section, `useKickoffTransition` / `doTransition`, `formatDate`.

## Testing

- No new pure-logic module is introduced (numbering reuses the tested `navLayout`), so there is no
  new unit test. Verification is `tsc` + `next build` + a manual browser pass against the mockup
  (header, no banner, subnav with pink underline + green checks, Overview card with avatar +
  attached pills, numbered collapsible section cards with label/value rows, Manrope numerals).
- Existing test suite stays green (this change touches only view components + CSS).

## Out of scope / non-goals

- No schema, validation, autosave, or transition-logic changes.
- The editor and list views are not restyled here (they only inherit the Baloo→Manrope token swap).
- Branch stays local-only and uncommitted (organized by the user).
