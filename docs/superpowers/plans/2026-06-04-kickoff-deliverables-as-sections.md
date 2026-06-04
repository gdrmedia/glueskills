# Kickoff Deliverables-as-Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the three deliverable toggle pills below the brief title and fold the deliverables into the left ring-nav as first-class sections — off by default with an "Add" affordance, active rows numbered with a remove (×).

**Architecture:** A new pure helper `navLayout(deliverables)` computes the nav's structure (lead always-sections → the three deliverable sections → tail always-sections) and the 1-based numbering across *active* sections. A presentational `SectionNav` component renders it with two row variants (active nav row + inactive add row) and a "DELIVERABLES" group header. `kickoff-editor.tsx` swaps its inline nav and the pills for `SectionNav`, reusing the existing `toggleDeliverable`/`goToSection` handlers. `activeSections()` and the data model are untouched.

**Tech Stack:** Next.js 16 (App Router) + TypeScript, React client components, Vitest (node env, logic-only), CSS in `globals.css` scoped under `.momentum-kickoff`.

**Note on testing:** Only the structural logic (`navLayout`) is unit-tested — the repo has no React component-test harness (vitest runs in the `node` environment; all existing `*.test.ts` are pure logic). The UI tasks are verified by `tsc`/`next build` and a manual browser pass (Task 5), matching how the rest of the Momentum branch was validated.

---

### Task 1: `navLayout` helper (TDD)

**Files:**
- Create: `src/lib/project-kickoff/nav-layout.ts`
- Test: `src/lib/project-kickoff/nav-layout.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/project-kickoff/nav-layout.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { navLayout } from "./nav-layout";
import type { Deliverables } from "./types";

const none: Deliverables = { case_study: false, social: false, award: false };

describe("navLayout", () => {
  it("partitions into lead (1-3), the three deliverables, and tail (Approvals)", () => {
    const { lead, deliverables, tail, total } = navLayout(none);
    expect(lead.map((r) => r.section.id)).toEqual([1, 2, 3]);
    expect(deliverables.map((d) => d.key)).toEqual(["case_study", "social", "award"]);
    expect(tail.map((r) => r.section.id)).toEqual([7]);
    expect(total).toBe(3);
  });

  it("numbers only active sections; inactive deliverables are null", () => {
    const { lead, deliverables, tail, activeOn, activeTotal } = navLayout(none);
    expect(lead.map((r) => r.number)).toEqual([1, 2, 3]);
    expect(deliverables.map((d) => d.number)).toEqual([null, null, null]);
    expect(tail.map((r) => r.number)).toEqual([4]); // Approvals right after 1-3
    expect(activeOn).toBe(0);
    expect(activeTotal).toBe(4);
  });

  it("worked example: only social on → Social=4, Approvals=5", () => {
    const { deliverables, tail, activeOn, activeTotal } = navLayout({ case_study: false, social: true, award: false });
    const social = deliverables.find((d) => d.key === "social")!;
    const caseStudy = deliverables.find((d) => d.key === "case_study")!;
    expect(social.active).toBe(true);
    expect(social.number).toBe(4);
    expect(caseStudy.number).toBeNull();
    expect(tail[0].number).toBe(5);
    expect(activeOn).toBe(1);
    expect(activeTotal).toBe(5);
  });

  it("all three on → 4,5,6 then Approvals=7", () => {
    const { deliverables, tail, activeOn, activeTotal } = navLayout({ case_study: true, social: true, award: true });
    expect(deliverables.map((d) => d.number)).toEqual([4, 5, 6]);
    expect(tail[0].number).toBe(7);
    expect(activeOn).toBe(3);
    expect(activeTotal).toBe(7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/project-kickoff/nav-layout.test.ts`
Expected: FAIL — `Failed to resolve import "./nav-layout"` (file does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/project-kickoff/nav-layout.ts`:

```ts
import { KICKOFF_FORM } from "./form-schema";
import type { Deliverables, DeliverableKey, SectionDef } from "./types";

type DeliverableSection = Extract<SectionDef, { always: false }>;

function isDeliverableSection(s: SectionDef): s is DeliverableSection {
  return !s.always;
}

export interface NavRow {
  section: SectionDef;
  number: number;
}

export interface NavDeliverable {
  section: SectionDef;
  key: DeliverableKey;
  active: boolean;
  number: number | null;
}

export interface NavLayout {
  lead: NavRow[];
  deliverables: NavDeliverable[];
  tail: NavRow[];
  activeOn: number;    // count of active deliverables
  total: number;       // total deliverables (3)
  activeTotal: number; // count of all active sections (for "Section n / N")
}

/**
 * Structural layout for the editor's section nav: the always-sections that lead
 * the brief, the three deliverable sections (active or not), and the always-
 * sections that trail it. Numbers are 1-based across *active* sections in
 * document order; inactive deliverables carry `number: null` (they render the
 * "+" add affordance). Purely structural — knows nothing about answers/progress.
 */
export function navLayout(deliverables: Deliverables): NavLayout {
  const firstDelIdx = KICKOFF_FORM.findIndex(isDeliverableSection);
  const leadSecs = KICKOFF_FORM.slice(0, firstDelIdx).filter((s) => s.always);
  const tailSecs = KICKOFF_FORM.slice(firstDelIdx).filter((s) => s.always);
  const delSecs = KICKOFF_FORM.filter(isDeliverableSection);

  let n = 0;
  const lead: NavRow[] = leadSecs.map((section) => ({ section, number: ++n }));
  const deliverablesOut: NavDeliverable[] = delSecs.map((section) => {
    const active = !!deliverables[section.deliverable];
    return { section, key: section.deliverable, active, number: active ? ++n : null };
  });
  const tail: NavRow[] = tailSecs.map((section) => ({ section, number: ++n }));

  const activeOn = deliverablesOut.filter((d) => d.active).length;
  return {
    lead,
    deliverables: deliverablesOut,
    tail,
    activeOn,
    total: delSecs.length,
    activeTotal: lead.length + activeOn + tail.length,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/project-kickoff/nav-layout.test.ts`
Expected: PASS — 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/project-kickoff/nav-layout.ts src/lib/project-kickoff/nav-layout.test.ts
git commit -m "feat(kickoff): navLayout helper — lead/deliverables/tail + active numbering"
```

---

### Task 2: Nav CSS (add-row, ×, remove pill styles)

**Files:**
- Modify: `src/app/globals.css` (the `.momentum-kickoff` scope)

- [ ] **Step 1: Add the new nav classes**

In `src/app/globals.css`, find the `/* section nav rows */` block (the `.m-navitem` rules ending at the `.m-navitem.is-active` line). Immediately AFTER that block, add:

```css
/* deliverable add-row + nav remove (deliverables-as-sections) */
.momentum-kickoff .m-navadd {
  display: flex;
  align-items: center;
  gap: 13px;
  width: 100%;
  text-align: left;
  border: 1.5px dashed var(--glue-ink-200);
  background: transparent;
  border-radius: 14px;
  padding: 12px 14px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s var(--ease);
}
.momentum-kickoff .m-navadd:hover,
.momentum-kickoff .m-navadd:focus-visible {
  border-color: var(--glue-primary);
  background: rgba(252, 46, 143, 0.05);
  outline: none;
}
.momentum-kickoff .m-navadd-circle {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1.5px dashed var(--glue-ink-300);
  color: var(--glue-ink-400);
  transition: all 0.15s var(--ease);
}
.momentum-kickoff .m-navadd:hover .m-navadd-circle,
.momentum-kickoff .m-navadd:focus-visible .m-navadd-circle {
  border-color: var(--glue-primary);
  color: var(--glue-primary);
}
.momentum-kickoff .m-navadd-cta {
  flex-shrink: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--glue-primary);
}
.momentum-kickoff .m-navx {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--glue-ink-400);
  cursor: pointer;
  transition: all 0.15s var(--ease);
}
.momentum-kickoff .m-navx:hover {
  background: rgba(19, 19, 26, 0.06);
  color: var(--glue-ink-700);
}
```

- [ ] **Step 2: Remove the now-dead deliverable-pill styles**

In `src/app/globals.css`, delete the entire `/* deliverable pills */` block — all five lines from `.momentum-kickoff .m-pill {` through `.momentum-kickoff .m-pill:disabled { cursor: default; }`. (Confirmed dead: `m-pill` is referenced nowhere after the pills are removed in Task 4.)

- [ ] **Step 3: Verify the build still compiles CSS**

Run: `npm run build`
Expected: build completes (the 5 pre-existing lint warnings are unrelated and do not fail `next build`). No new errors referencing `globals.css`.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "style(kickoff): nav add-row + remove styles; drop dead pill styles"
```

---

### Task 3: `SectionNav` component + icons in `parts.tsx`

**Files:**
- Modify: `src/components/project-kickoff/momentum/parts.tsx`

- [ ] **Step 1: Update the type imports at the top of the file**

Replace the existing type-import block:

```tsx
import type {
  DeliverableKey,
  Deliverables,
  FieldDef,
  KickoffUser,
} from "@/lib/project-kickoff/types";
```

with (drops `Deliverables`, adds `SectionDef` + the `NavLayout` import):

```tsx
import type {
  DeliverableKey,
  FieldDef,
  KickoffUser,
  SectionDef,
} from "@/lib/project-kickoff/types";
import type { NavLayout } from "@/lib/project-kickoff/nav-layout";
```

- [ ] **Step 2: Add `Close` and `Plus` icons**

Immediately after the existing `Arrow` function (the `export function Arrow(...)` block), add:

```tsx
export function Close({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function Plus({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
```

- [ ] **Step 3: Delete the dead `PillIcon` and `DeliverablePills`**

Remove the entire `function PillIcon(...)` block AND the entire `export function DeliverablePills(...)` block (and its preceding `/* ----- deliverable pills */` comment and the `const PILLS = [...]` array). They are replaced by `SectionNav`. The `Ring`, `Check`, `Arrow`, `Close`, `Plus`, `OwnerControl`, `CheckBadge`, and `MField` declarations stay.

- [ ] **Step 4: Add the `SectionNav` component**

At the end of `parts.tsx`, add:

```tsx
/* ----------------------------------------------------------------- section nav */
type NavProgress = { done: number; total: number; pct: number };

function NavItem({
  number, title, progress, active, onSelect, onRemove,
}: {
  number: number;
  title: string;
  progress: NavProgress;
  active: boolean;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  const done = progress.pct >= 1;
  return (
    <div
      className={`m-navitem${active ? " is-active" : ""}`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); }
      }}
    >
      <div style={{ position: "relative", width: 38, height: 38, display: "grid", placeItems: "center" }}>
        <Ring pct={progress.pct} color={done ? "var(--glue-green)" : "var(--glue-primary)"} />
        <span className="m-num" style={{ position: "absolute", fontSize: 12, fontWeight: 700, color: done ? "var(--glue-green)" : "var(--glue-ink)" }}>
          {done ? <Check size={14} /> : number}
        </span>
      </div>
      <span style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: active ? "var(--glue-ink)" : "var(--glue-ink-700)" }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--glue-ink-500)" }}>{progress.done}/{progress.total} done</div>
      </span>
      {onRemove && (
        <button type="button" className="m-navx" aria-label={`Remove ${title}`}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}>
          <Close size={16} />
        </button>
      )}
    </div>
  );
}

function AddItem({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <button type="button" className="m-navadd" onClick={onAdd}>
      <span className="m-navadd-circle"><Plus /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--glue-ink-500)" }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--glue-ink-400)" }}>Not in this brief</div>
      </span>
      <span className="m-navadd-cta">Add</span>
    </button>
  );
}

function DeliverablesHeader({ activeOn, total }: { activeOn: number; total: number }) {
  return (
    <div style={{ padding: "0 14px", marginTop: 14, marginBottom: 2 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 700, color: "var(--glue-ink-400)" }}>
          Deliverables
        </span>
        <span style={{ fontSize: 13, color: "var(--glue-ink-400)", fontWeight: 600 }}>{activeOn} of {total} on</span>
      </div>
      <div style={{ fontSize: 13, color: "var(--glue-ink-400)", marginTop: 2 }}>
        What this brief will produce — click to add.
      </div>
    </div>
  );
}

export function SectionNav({
  layout, activeId, progressFor, readOnly, onSelect, onAdd, onRemove,
}: {
  layout: NavLayout;
  activeId: number;
  progressFor: (section: SectionDef) => NavProgress;
  readOnly: boolean;
  onSelect: (id: number) => void;
  onAdd: (key: DeliverableKey, id: number) => void;
  onRemove: (key: DeliverableKey) => void;
}) {
  const showGroup = !readOnly || layout.activeOn > 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {layout.lead.map((r) => (
        <NavItem key={r.section.id} number={r.number} title={r.section.title}
          progress={progressFor(r.section)} active={r.section.id === activeId}
          onSelect={() => onSelect(r.section.id)} />
      ))}

      {showGroup && <DeliverablesHeader activeOn={layout.activeOn} total={layout.total} />}

      {layout.deliverables.map((d) => {
        if (d.active) {
          return (
            <NavItem key={d.section.id} number={d.number ?? 0} title={d.section.title}
              progress={progressFor(d.section)} active={d.section.id === activeId}
              onSelect={() => onSelect(d.section.id)}
              onRemove={readOnly ? undefined : () => onRemove(d.key)} />
          );
        }
        if (readOnly) return null;
        return (
          <AddItem key={d.section.id} title={d.section.title}
            onAdd={() => onAdd(d.key, d.section.id)} />
        );
      })}

      {layout.tail.map((r) => (
        <NavItem key={r.section.id} number={r.number} title={r.section.title}
          progress={progressFor(r.section)} active={r.section.id === activeId}
          onSelect={() => onSelect(r.section.id)} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors. (If `tsc` reports `Close`/`Plus`/`SectionNav` issues, recheck the imports from Step 1.) Note: `kickoff-editor.tsx` will still reference the removed `DeliverablePills` until Task 4 — so `tsc` will report exactly one error in `kickoff-editor.tsx` about `DeliverablePills` not being exported. That single, expected error is resolved in Task 4; no other errors should appear.

- [ ] **Step 6: Commit**

```bash
git add src/components/project-kickoff/momentum/parts.tsx
git commit -m "feat(kickoff): SectionNav with add-row + remove; drop pill components"
```

---

### Task 4: Wire `SectionNav` into `kickoff-editor.tsx`

**Files:**
- Modify: `src/components/project-kickoff/kickoff-editor.tsx`

- [ ] **Step 1: Update the parts import**

Replace:

```tsx
import { Ring, Check, Arrow, DeliverablePills, OwnerControl, MField } from "./momentum/parts";
```

with (drops `Check` + `DeliverablePills`, adds `SectionNav`):

```tsx
import { Ring, Arrow, OwnerControl, MField, SectionNav } from "./momentum/parts";
```

- [ ] **Step 2: Import the `navLayout` helper**

Add to the existing imports from `@/lib/project-kickoff/validation` area — directly below that line, add a new import:

```tsx
import { navLayout } from "@/lib/project-kickoff/nav-layout";
```

- [ ] **Step 3: Compute the nav layout and a number lookup**

Just after the `const sections = useMemo(...)` line near the top of the component body, add:

```tsx
  const nav = useMemo(() => navLayout(kickoff.deliverables), [kickoff.deliverables]);
  const numberById = useMemo(() => {
    const m: Record<number, number> = {};
    for (const r of nav.lead) m[r.section.id] = r.number;
    for (const d of nav.deliverables) if (d.number != null) m[d.section.id] = d.number;
    for (const r of nav.tail) m[r.section.id] = r.number;
    return m;
  }, [nav]);
```

- [ ] **Step 4: Remove the `<DeliverablePills>` line**

Delete the entire deliverable-pills block:

```tsx
      {/* deliverable pills */}
      <DeliverablePills deliverables={kickoff.deliverables} readOnly={readOnly} onToggle={toggleDeliverable} />
```

- [ ] **Step 5: Replace the inline ring-nav with `<SectionNav>`**

Replace the entire `{/* ring nav */}` block — the `<div style={{ width: 300, ... position: "sticky", top: 12 }}>` and everything inside it through its closing `</div>` (the `sections.map(...)` that renders the old nav rows) — with:

```tsx
        {/* ring nav */}
        <div style={{ width: 300, flexShrink: 0, position: "sticky", top: 12 }}>
          <SectionNav
            layout={nav}
            activeId={activeSection.id}
            progressFor={(s) => sectionProgress(s, kickoff.sections[String(s.id)])}
            readOnly={readOnly}
            onSelect={goToSection}
            onAdd={(key, id) => { toggleDeliverable(key, true); goToSection(id); }}
            onRemove={(key) => toggleDeliverable(key, false)}
          />
        </div>
```

- [ ] **Step 6: Update the section-panel eyebrow to sequential numbering**

Replace:

```tsx
          <div style={{ fontSize: 13, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--glue-ink-400)", fontWeight: 600 }}>
            Section {activeSection.id}
          </div>
```

with:

```tsx
          <div style={{ fontSize: 13, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--glue-ink-400)", fontWeight: 600 }}>
            Section {numberById[activeSection.id]} / {nav.activeTotal}
          </div>
```

- [ ] **Step 7: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors (the Task 3 `DeliverablePills` error is now resolved, and `Check` is no longer referenced in this file).

- [ ] **Step 8: Verify the production build**

Run: `npm run build`
Expected: build completes with no new errors (pre-existing unrelated lint warnings only).

- [ ] **Step 9: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the new `nav-layout.test.ts` and the unchanged validation/form-schema suites.

- [ ] **Step 10: Commit**

```bash
git add src/components/project-kickoff/kickoff-editor.tsx
git commit -m "feat(kickoff): nav deliverables inline; remove pills; sequential eyebrow"
```

---

### Task 5: Browser verification (manual)

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Next dev server on `http://localhost:3000`.

- [ ] **Step 2: Open a draft brief's edit screen**

Navigate (Chrome DevTools MCP) to a draft kickoff edit URL: `/dashboard/strategist/project-kickoff/<id>`. Take a snapshot.

- [ ] **Step 3: Verify the default (no-deliverables) state**

Confirm against the mockup:
- No deliverable pills below the title.
- Nav shows sections 1–3 (Campaign Overview, The Work, Results & Proof), numbered.
- A "DELIVERABLES" header with "0 of 3 on" + the "What this brief will produce — click to add." subtitle.
- Case Study / Social Posts / Award Submission each render as dashed "+" add-rows with "Not in this brief" + an "Add" button.
- Approvals & Assets renders last, numbered **4**.

- [ ] **Step 4: Verify Add → activates and opens**

Click "Add" on Social Posts. Confirm: the row becomes a numbered active row showing **4**, Approvals renumbers to **5**, the header reads "1 of 3 on", and the right panel switches to Social Post Specifics with eyebrow "Section 4 / 5".

- [ ] **Step 5: Verify × → silent soft-toggle preserves data**

Type a value into a Social field, then click the **×** on the Social nav row. Confirm: no dialog, Social returns to the "+ Add" state, Approvals renumbers back to **4**. Click "Add" on Social again → the previously typed value is still there.

- [ ] **Step 6: Verify locked state hides add affordances**

Open an under-review or approved brief. Confirm: inactive deliverables and all Add/× controls are hidden; the nav shows only the sections that are in the brief; the DELIVERABLES header appears only if ≥1 deliverable is active.

- [ ] **Step 7: Report**

Summarize what was observed vs. expected, with screenshots. No commit.

---

## Done when

- `npm test` green (new `nav-layout.test.ts` + unchanged suites).
- `npm run build` clean (no new errors).
- Browser pass confirms: pills gone; deliverables are inline add/active nav rows; Add opens, × soft-toggles preserving data; numbering is sequential; locked briefs hide the affordances.
- All commits land on `kickoff-momentum-redesign` (local-only; not pushed).
