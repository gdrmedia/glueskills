# Creative Kickoff — deliverables as inline nav sections

**Date:** 2026-06-04
**Branch:** `kickoff-momentum-redesign` (continues the Momentum exploration; local-only, not pushed)
**Status:** approved design

## Goal

Remove the three deliverable toggle pills that sit below the brief title and fold the
deliverables into the left ring-nav as first-class sections. By default the three
deliverable sections are **off** (not in the brief) and render as an "Add" affordance;
clicking Add activates the section — exactly like toggling the old pill, but in place.
Active deliverable sections render as normal numbered nav rows with a remove (×) control.

This is a presentation change to the editor nav only. What counts as "in the brief"
(`activeSections`) and how a deliverable is toggled (`toggleDeliverable`) are unchanged.

## Nav layout

`navLayout(deliverables)` is a new pure helper in `src/lib/project-kickoff/` that walks
`KICKOFF_FORM` in document order and returns:

- **lead** — always-sections appearing before the first deliverable
  (Campaign Overview, The Work, Results & Proof)
- **deliverables** — the deliverable sections, each as `{ section, key, active, number | null }`
- **tail** — always-sections appearing after the last deliverable (Approvals & Assets)
- `activeOn` (count of active deliverables) and `total` (3) for the group header

Deliverable sections are contiguous in the schema (IDs 4–6), so the lead/tail split is
unambiguous. The helper does not change `activeSections()`, which stays the source of
truth for validation, submit-gating, and the right-hand panel.

## Numbering

Walk lead + active-deliverables + tail in document order and assign **1-based numbers to
active sections only**. Inactive deliverables get `number: null` and render the dashed "+"
circle instead of a number. Numbers therefore reflect position among *active* sections,
not the fixed schema ID.

Worked example (only Social on): Campaign Overview 1, The Work 2, Results & Proof 3,
Social Posts **4**, Approvals & Assets **5**. (Case Study / Award show "+", no number.)

The right-hand section panel's eyebrow follows the same scheme: `Section {n} / {activeTotal}`
— e.g. "Section 4 / 5" — so the nav and panel agree. (Today it reads `Section {id}`.)

## Components (`momentum/parts.tsx`)

Extract the nav into a `SectionNav` component with two row variants:

- **Active row** — the existing `.m-navitem` (ring + number/check + title + "x/y done"),
  plus an **×** remove button. The × is a nested button that stops propagation; clicking
  the rest of the row still navigates to the section.
- **Inactive deliverable row** — `.m-navitem-add`: dashed "+" circle, title,
  "Not in this brief" subtitle, and an **Add** button. The whole row is the click target.

A **deliverables group header** sits above the deliverable rows: a "DELIVERABLES" label
with an "{activeOn} of {total} on" counter on the right, and the subtitle
"What this brief will produce — click to add."

Wiring (reuses existing handlers in `kickoff-editor.tsx`):
- **Add** → `toggleDeliverable(key, true)` **and** `goToSection(sectionId)` (open it).
- **×** → `toggleDeliverable(key, false)` — silent soft-toggle. Section answers persist in
  `kickoff.sections` (keyed by section ID) and are restored verbatim if re-added. No confirm.

## Styling

New classes added inside the existing `.momentum-kickoff` scope in `globals.css`,
additive and reversible:
- `.m-navitem-add` — dashed border, muted text, and the pink-tint hover/focus state from
  the mockup.
- the deliverables-header label / counter / subtitle styles.
- the Add text-button and × icon-button styles.

Nothing outside the `.momentum-kickoff` scope changes.

## Read-only / locked briefs

When a brief is locked (under review / approved), the nav shows **only the sections that
are in the brief** — inactive deliverable rows and both the Add and × affordances are
hidden. A locked brief should not present controls that can't fire. The DELIVERABLES group
header still renders when at least one deliverable is active.

## Testing

- Unit test for `navLayout`: lead/deliverables/tail partition, active flags, and the
  1-based numbering across the 0/1/3-deliverables-on cases (including the worked example).
- Existing validation / submit / autosave tests stay green (no behavior change there).

## Out of scope / non-goals

- The three deliverable pills below the title are **removed** — the only thing leaving.
- No schema, validation, autosave, or transition-logic changes. `activeSections()` and
  `toggleDeliverable()` are reused as-is.
- List view and read-only document view are untouched; the document view keeps its own
  section numbering.
- Branch stays local-only — a look-and-feel preview, not merged or pushed.
