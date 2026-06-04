# Kickoff Summary (document view) Momentum Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **EXECUTION NOTE — stop-committing mode:** This branch (`kickoff-momentum-redesign`) has intentional uncommitted WIP. Implementers must **NOT** `git add` or `git commit` — leave all changes in the working tree. Each task ends with verification commands instead of a commit. The user organizes git history later.

**Goal:** Re-skin the read-only Summary / document view (`kickoff-document.tsx`) into the Momentum design language per the mockup, omitting the "Submission complete" banner and swapping Baloo 2 → Manrope globally.

**Architecture:** Reuse the existing data flow (`activeSections`, `shownSections` filter, scroll-spy, `doTransition`) and the tested `navLayout` numbering. Add a focused presentational module `momentum/summary-parts.tsx` (SubNav, MetaCard, SectionCard, RowGrid, Avatar). Export the existing `sectionComplete` rule from `validation.ts` so the summary's "Complete" markers match the editor exactly. Add summary CSS + the font swap inside the `.momentum-kickoff` scope in `globals.css`.

**Tech Stack:** Next.js 16 + TypeScript, React client components, Vitest (node, logic-only), CSS scoped under `.momentum-kickoff`, lucide-react icons.

**Testing note:** Only the `sectionComplete` export carries unit tests (Task 1). The view/CSS tasks are verified by `tsc` + `next build` + a manual browser pass (Task 5) — the repo has no React component-test harness.

---

### Task 1: Export `sectionComplete` from validation (TDD)

**Files:**
- Modify: `src/lib/project-kickoff/validation.ts`
- Test: `src/lib/project-kickoff/validation.test.ts`

- [ ] **Step 1: Add failing tests**

In `src/lib/project-kickoff/validation.test.ts`, update the import line:

```ts
import { activeSections, missingRequired, isSubmittable, progressOf, sectionComplete } from "./validation";
```

Add an import for the section lookup directly below the existing `import type { Deliverables, Sections } from "./types";` line:

```ts
import { SECTION_BY_ID } from "./form-schema";
```

Append this describe block to the end of the file:

```ts
describe("sectionComplete", () => {
  it("is true when all required fields of a section are filled", () => {
    const s = emptySections();
    s["1"].answers = {
      campaign_name: "x", client_brand: "x", industry: "x",
      campaign_summary: "x", business_problem: "x",
    };
    expect(sectionComplete(SECTION_BY_ID[1], s)).toBe(true);
  });

  it("is false when a required field is empty", () => {
    const s = emptySections();
    s["1"].answers = { campaign_name: "x" };
    expect(sectionComplete(SECTION_BY_ID[1], s)).toBe(false);
  });

  it("for a section with no required fields, requires every field filled", () => {
    const s = emptySections();
    // §4 (Case Study) has no required fields.
    expect(sectionComplete(SECTION_BY_ID[4], s)).toBe(false);
    const all: Record<string, string> = {};
    for (const f of SECTION_BY_ID[4].fields) all[f.key] = "x";
    s["4"].answers = all;
    expect(sectionComplete(SECTION_BY_ID[4], s)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/project-kickoff/validation.test.ts`
Expected: FAIL — `sectionComplete` is not exported (import resolves to `undefined`, calls throw).

- [ ] **Step 3: Export the existing function**

In `src/lib/project-kickoff/validation.ts`, change the declaration (around line 32) from:

```ts
function sectionComplete(section: SectionDef, sections: Sections): boolean {
```

to:

```ts
export function sectionComplete(section: SectionDef, sections: Sections): boolean {
```

(Do not change its body — it already implements the editor's rule: all required filled, or all fields filled when a section has no required fields. `SectionDef` is already imported in this file.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/project-kickoff/validation.test.ts`
Expected: PASS — all validation tests, including the 3 new `sectionComplete` cases.

- [ ] **Step 5: Verify (no commit)**

Run: `npx tsc --noEmit`
Expected: zero errors. Do NOT commit — leave changes in the working tree.

---

### Task 2: Font swap + summary CSS

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Swap the font @import (Baloo 2 → Manrope)**

In `src/app/globals.css`, replace line 4:

```css
@import url("https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&display=swap");
```

with:

```css
@import url("https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&display=swap");
```

- [ ] **Step 2: Point the `--glue-font-logo` token at Manrope**

In `src/app/globals.css`, find the `--glue-font-logo:` declaration inside the `.momentum-kickoff {` block (it currently reads `--glue-font-logo: "Baloo 2", "Helvetica Neue", ui-sans-serif, system-ui, sans-serif;`) and replace it with:

```css
  --glue-font-logo: "Manrope", "Helvetica Neue", ui-sans-serif, system-ui, sans-serif;
```

- [ ] **Step 3: Confirm no Baloo references remain**

Run: `grep -in "baloo" src/app/globals.css`
Expected: no output (zero matches).

- [ ] **Step 4: Add summary/document-view CSS**

Append this block to the END of `src/app/globals.css` (all selectors are inside the `.momentum-kickoff` scope, additive):

```css
/* ---- summary / document view (Momentum) ---- */
.momentum-kickoff .m-subnav {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 14px 0 0;
  margin: 20px 0 4px;
  background: rgba(249, 249, 249, 0.86);
  backdrop-filter: saturate(1.4) blur(8px);
  -webkit-backdrop-filter: saturate(1.4) blur(8px);
  border-bottom: 1px solid var(--glue-line);
}
.momentum-kickoff .m-subnav button {
  position: relative;
  white-space: nowrap;
  padding: 11px 16px 15px;
  font-size: 16px;
  font-weight: 600;
  font-family: inherit;
  color: var(--glue-ink-500);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: none;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: color 0.15s var(--ease);
}
.momentum-kickoff .m-subnav button:hover { color: var(--glue-ink-700); }
.momentum-kickoff .m-subnav button.is-active { color: var(--glue-ink); border-bottom-color: var(--glue-primary); }

.momentum-kickoff .m-ck {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--glue-green);
  color: #fff;
}

.momentum-kickoff .m-card {
  background: var(--glue-surface);
  border-radius: 20px;
  box-shadow: var(--shadow-card);
  margin-top: 20px;
  overflow: hidden;
  scroll-margin-top: 90px;
}
.momentum-kickoff .m-cardhead {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  text-align: left;
  border: none;
  background: none;
  font-family: inherit;
  padding: 24px 30px;
  cursor: pointer;
  user-select: none;
}
.momentum-kickoff .m-cardhead h3 {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: 23px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--glue-ink);
}
.momentum-kickoff .m-chip-num {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 12px;
  background: var(--glue-surface-alt);
  display: grid;
  place-items: center;
  color: var(--glue-ink-700);
  font-family: var(--glue-font-logo);
  font-weight: 800;
  font-size: 18px;
}
.momentum-kickoff .m-meter {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 14px;
  font-weight: 600;
  color: var(--glue-green);
}
.momentum-kickoff .m-chev {
  flex-shrink: 0;
  color: var(--glue-ink-400);
  transition: transform 0.25s var(--ease);
}
.momentum-kickoff .m-card.is-collapsed .m-chev { transform: rotate(180deg); }
.momentum-kickoff .m-cardbody { padding: 0 30px 28px; }
.momentum-kickoff .m-rows {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 2px 28px;
}
.momentum-kickoff .m-rows .m-label { color: var(--glue-ink-500); font-size: 16px; padding: 14px 0; }
.momentum-kickoff .m-rows .m-val { color: var(--glue-ink); font-size: 16px; padding: 14px 0; white-space: pre-wrap; }
.momentum-kickoff .m-rowsep { grid-column: 1 / -1; height: 1px; background: var(--glue-line); }
@media (max-width: 640px) {
  .momentum-kickoff .m-rows { grid-template-columns: 1fr; }
  .momentum-kickoff .m-rows .m-label { padding-bottom: 0; }
}

.momentum-kickoff .m-avatar {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--glue-primary);
  color: #fff;
  display: inline-grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
}
.momentum-kickoff .m-deliv-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--glue-surface-alt);
  border: 1px solid var(--glue-line);
  border-radius: 999px;
  padding: 7px 14px;
  font-size: 14px;
  font-weight: 600;
  color: var(--glue-ink-700);
}
.momentum-kickoff .m-deliv-pill .m-ck { width: 18px; height: 18px; }
```

- [ ] **Step 5: Verify the build (no commit)**

Run: `npm run build`
Expected: completes successfully (pre-existing unrelated lint warnings are fine; no NEW error referencing `globals.css`). Do NOT commit.

---

### Task 3: Create `momentum/summary-parts.tsx` (+ export `initials`)

**Files:**
- Modify: `src/components/project-kickoff/momentum/parts.tsx` (export `initials`)
- Create: `src/components/project-kickoff/momentum/summary-parts.tsx`

- [ ] **Step 1: Export `initials` from parts.tsx**

In `src/components/project-kickoff/momentum/parts.tsx`, find the helper `function initials(name: string): string {` (used by `OwnerControl`) and add `export`:

```ts
export function initials(name: string): string {
```

(Body unchanged.)

- [ ] **Step 2: Create the summary parts module**

Create `src/components/project-kickoff/momentum/summary-parts.tsx` with exactly:

```tsx
"use client";
// ===========================================================================
// Momentum kickoff — read-only Summary (document view) presentational parts.
// Pure UI for KickoffDocument: sticky subnav, overview/meta card, numbered
// collapsible section cards, label/value grid, avatar chip. Tokens come from
// the `.momentum-kickoff` scope in globals.css.
// ===========================================================================
import { Fragment, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { initials } from "./parts";
import type { Kickoff } from "@/lib/project-kickoff/types";

/** "M/D/YYYY · h:mmam/pm" — client-side only (callers guard hydration). */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;
  const mm = String(minutes).padStart(2, "0");
  return `${month}/${day}/${year} · ${hours}:${mm}${ampm}`;
}

export function Avatar({ name }: { name: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <span className="m-avatar">{initials(name)}</span>
      {name}
    </span>
  );
}

export interface NavItem {
  id: string;
  label: string;
  complete?: boolean;
}

export function SubNav({
  items, activeId, onSelect,
}: {
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="m-subnav">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={it.id === activeId ? "is-active" : undefined}
          onClick={() => onSelect(it.id)}
        >
          {it.complete && <span className="m-ck"><Check size={11} strokeWidth={3} /></span>}
          {it.label}
        </button>
      ))}
    </nav>
  );
}

export type Row = { label: string; node: React.ReactNode };

export function RowGrid({ rows }: { rows: Row[] }) {
  return (
    <div className="m-rows">
      {rows.map((r, i) => (
        <Fragment key={`${r.label}-${i}`}>
          {i > 0 && <div className="m-rowsep" />}
          <div className="m-label">{r.label}</div>
          <div className="m-val">{r.node}</div>
        </Fragment>
      ))}
    </div>
  );
}

export function SectionCard({
  id, number, title, complete, defaultOpen = true, children,
}: {
  id: string;
  number?: number;
  title: string;
  complete?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className={`m-card${open ? "" : " is-collapsed"}`}>
      <button type="button" className="m-cardhead" onClick={() => setOpen((v) => !v)}>
        {number != null && <span className="m-chip-num">{number}</span>}
        <h3>{title}</h3>
        {complete && (
          <span className="m-meter">
            <span className="m-ck"><Check size={11} strokeWidth={3} /></span> Complete
          </span>
        )}
        <ChevronDown className="m-chev" size={20} />
      </button>
      {open && <div className="m-cardbody">{children}</div>}
    </section>
  );
}

export function MetaCard({
  id, kickoff, editorNames,
}: {
  id: string;
  kickoff: Kickoff;
  editorNames: Record<string, string>;
}) {
  const dash = <span style={{ color: "var(--glue-ink-400)" }}>—</span>;
  const rows: Row[] = [
    {
      label: "Submission date",
      node: kickoff.submitted_at
        ? <span suppressHydrationWarning>{formatDate(kickoff.submitted_at)}</span>
        : dash,
    },
  ];
  if (kickoff.submitted_by) {
    rows.push({ label: "Submitted by", node: <Avatar name={editorNames[kickoff.submitted_by] ?? kickoff.submitted_by} /> });
  }
  if (kickoff.status === "approved" && kickoff.approved_at) {
    rows.push({ label: "Approved date", node: <span suppressHydrationWarning>{formatDate(kickoff.approved_at)}</span> });
  }
  if (kickoff.status === "approved" && kickoff.approved_by) {
    rows.push({ label: "Approved by", node: <Avatar name={editorNames[kickoff.approved_by] ?? kickoff.approved_by} /> });
  }

  const attached = (
    [
      ["case_study", "Case Study"],
      ["social", "Social Posts"],
      ["award", "Award Submission"],
    ] as const
  ).filter(([k]) => kickoff.deliverables[k]);

  return (
    <SectionCard id={id} title="Overview">
      <RowGrid rows={rows} />
      {attached.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
          {attached.map(([k, label]) => (
            <span key={k} className="m-deliv-pill">
              <span className="m-ck"><Check size={12} strokeWidth={3} /></span> {label}
            </span>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
```

- [ ] **Step 3: Verify types compile (no commit)**

Run: `npx tsc --noEmit`
Expected: ZERO errors. (`kickoff-document.tsx` still uses its old shadcn implementation and is untouched, so nothing breaks.) Do NOT commit.

---

### Task 4: Rewrite `kickoff-document.tsx` in Momentum

**Files:**
- Modify (full rewrite): `src/components/project-kickoff/kickoff-document.tsx`

- [ ] **Step 1: Replace the file contents**

Replace the ENTIRE contents of `src/components/project-kickoff/kickoff-document.tsx` with:

```tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  SubNav, MetaCard, SectionCard, RowGrid,
  type NavItem, type Row,
} from "./momentum/summary-parts";
import { useKickoffTransition } from "@/lib/project-kickoff/queries";
import { activeSections, sectionComplete } from "@/lib/project-kickoff/validation";
import { navLayout } from "@/lib/project-kickoff/nav-layout";
import type { Kickoff } from "@/lib/project-kickoff/types";

const STATUS_LABEL: Record<Kickoff["status"], string> = {
  draft: "Draft", under_review: "Under review", approved: "Approved",
};

export function KickoffDocument({
  kickoff, editorNames, isApprover,
}: {
  kickoff: Kickoff;
  editorNames: Record<string, string>;
  isApprover: boolean;
}) {
  const router = useRouter();
  const transition = useKickoffTransition(kickoff.id);

  // Sections that have at least one displayable value.
  const shownSections = useMemo(
    () =>
      activeSections(kickoff.deliverables).filter((s) => {
        const data = kickoff.sections[String(s.id)];
        if (!data) return false;
        const hasAnswer = s.fields.some((f) => (data.answers[f.key] ?? "").trim() !== "");
        const hasApproval = data.approval !== null;
        const hasNotes = (data.approval_notes ?? "").trim() !== "";
        return hasAnswer || hasApproval || hasNotes;
      }),
    [kickoff.deliverables, kickoff.sections]
  );

  // Sequential section numbers — identical to the editor — via navLayout.
  const numberById = useMemo(() => {
    const nav = navLayout(kickoff.deliverables);
    const m: Record<number, number> = {};
    for (const r of nav.lead) m[r.section.id] = r.number;
    for (const d of nav.deliverables) if (d.number != null) m[d.section.id] = d.number;
    for (const r of nav.tail) m[r.section.id] = r.number;
    return m;
  }, [kickoff.deliverables]);

  const navItems: NavItem[] = useMemo(
    () => [
      { id: "doc-overview", label: "Overview" },
      ...shownSections.map((s) => ({
        id: `doc-section-${s.id}`,
        label: s.title,
        complete: sectionComplete(s, kickoff.sections),
      })),
    ],
    [shownSections, kickoff.sections]
  );

  // Scroll-spy: highlight the topmost visible block.
  const [activeId, setActiveId] = useState<string>("doc-overview");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const navKey = navItems.map((n) => n.id).join(",");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const ids = navKey.split(",");
    const visible = new Map<string, number>();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.intersectionRatio);
        let best: string | null = null;
        let bestTop = Infinity;
        for (const id of ids) {
          if ((visible.get(id) ?? 0) > 0) {
            const el = document.getElementById(id);
            if (el) {
              const top = el.getBoundingClientRect().top;
              if (top < bestTop) {
                bestTop = top;
                best = id;
              }
            }
          }
        }
        if (best) setActiveId(best);
      },
      { threshold: [0, 0.1, 0.5, 1.0] }
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observerRef.current.observe(el);
    }
    return () => observerRef.current?.disconnect();
  }, [navKey]);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function doTransition(action: "approve" | "reopen") {
    try {
      await transition.mutateAsync(action);
      toast.success(action === "approve" ? "Approved" : "Reopened for editing");
      router.refresh();
    } catch (e) {
      const err = e as { status?: number };
      if (err.status === 403) toast.error("You don’t have permission for that");
      else toast.error("Something went wrong");
    }
  }

  return (
    <div className="momentum-kickoff" style={{ paddingBottom: 80 }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: "-.02em", color: "var(--glue-ink)" }}>{kickoff.title}</h1>
          <span style={{ background: "var(--glue-ink-100)", color: "var(--glue-ink-600)", fontSize: 14, fontWeight: 600, padding: "5px 13px", borderRadius: 999 }}>
            {STATUS_LABEL[kickoff.status]}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button type="button" className="m-btn m-btn-ghost" onClick={() => router.push("/dashboard/strategist/project-kickoff")}>
            Back to list
          </button>
          {kickoff.status === "under_review" && (
            <button type="button" className="m-btn m-btn-outline" disabled={transition.isPending} onClick={() => doTransition("reopen")}>
              Reopen / unlock
            </button>
          )}
          {kickoff.status === "under_review" && isApprover && (
            <button type="button" className="m-btn m-btn-approve" disabled={transition.isPending} onClick={() => doTransition("approve")}>
              Approve
            </button>
          )}
          {kickoff.status === "approved" && isApprover && (
            <button type="button" className="m-btn m-btn-outline" disabled={transition.isPending} onClick={() => doTransition("reopen")}>
              Reopen
            </button>
          )}
        </div>
      </div>

      {/* sticky section nav */}
      <SubNav items={navItems} activeId={activeId} onSelect={scrollTo} />

      {/* overview + section cards */}
      <MetaCard id="doc-overview" kickoff={kickoff} editorNames={editorNames} />

      {shownSections.map((section) => {
        const data = kickoff.sections[String(section.id)]!;
        const rows: Row[] = [];
        for (const f of section.fields) {
          if ((data.answers[f.key] ?? "").trim() !== "") {
            rows.push({ label: f.label, node: data.answers[f.key] });
          }
        }
        if (data.approval !== null) {
          rows.push({
            label: "Approval",
            node: <span className="m-deliv-pill" style={{ textTransform: "capitalize" }}>{data.approval}</span>,
          });
        }
        if ((data.approval_notes ?? "").trim() !== "") {
          rows.push({ label: "Approval notes", node: data.approval_notes });
        }
        return (
          <SectionCard
            key={section.id}
            id={`doc-section-${section.id}`}
            number={numberById[section.id]}
            title={section.title}
            complete={sectionComplete(section, kickoff.sections)}
          >
            <RowGrid rows={rows} />
          </SectionCard>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: ZERO errors.

- [ ] **Step 3: Verify the production build**

Run: `npm run build`
Expected: completes successfully (pre-existing unrelated lint warnings only).

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all tests pass (the new `sectionComplete` tests + all prior suites).

- [ ] **Step 5: Verify (no commit)**

Confirm `git status --short` shows the modified/new files unstaged. Do NOT commit — leave everything in the working tree.

---

### Task 5: Browser verification (controller-driven)

**Files:** none (verification only).

> Note: the Chrome DevTools MCP uses its own Chrome profile, which is NOT signed into Clerk, so `/dashboard/...` redirects to sign-in. If the controller cannot drive an authenticated session, hand this checklist to the user to verify in their logged-in browser (port 3000).

- [ ] **Step 1:** Ensure the GlueSkills dev server is running (`npm run dev`; an instance already runs on port 3000).
- [ ] **Step 2:** Open a **submitted / under-review** brief's view: `/dashboard/strategist/project-kickoff/<id>`.
- [ ] **Step 3: Verify against the mockup**
  - No "Submission complete" black box.
  - Header: title + status badge; actions `Back to list · Reopen / unlock · Approve` (Approve right-most, green).
  - Sticky subnav: Overview + section tabs; active tab has a pink underline; complete sections show a green check.
  - Overview card: Submission date, Submitted by (pink avatar + name), Approved date/by (if approved), green-check pills for attached deliverables only.
  - Section cards: numbered chip matching the editor's numbers, title, green "Complete" meter when required fields are filled; collapsible (chevron), default open; label/value rows with separators.
  - Numerals render in **Manrope** (confirm the editor's ring numbers also changed).
  - Scroll: subnav highlights the section in view; clicking a tab smooth-scrolls to it.
- [ ] **Step 4:** Report observations vs. expected, with screenshots. No commit.

---

## Done when

- `npm test` green (new `sectionComplete` tests + prior suites); `npx tsc --noEmit` clean; `npm run build` completes.
- `grep -in baloo src/app/globals.css` returns nothing.
- Browser pass confirms the Momentum summary: no banner, sticky pink-underline subnav with green checks, Overview card with avatar + attached pills, numbered collapsible section cards, Manrope numerals.
- All changes remain uncommitted in the working tree (stop-committing mode).
