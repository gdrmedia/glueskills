# Creative Kickoff Brief Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-platform the Webflow "Creative Kickoff Brief" into a native GlueSkills tool on Supabase, with autosave drafts, soft per-section ownership/handoff, a draft→under_review→approved workflow, and an Active/Approved projects list.

**Architecture:** A framework-free **portable core** (`src/lib/project-kickoff/`: form schema, validation, status machine, merge, config) sits behind a `KickoffRepository` interface. Thin Next.js API routes orchestrate core + repository; React client components talk only to the API routes (never Supabase directly). Data is one `project_kickoffs` row per brief with a JSONB `sections` blob.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Clerk auth, Supabase (`@supabase/supabase-js`), TanStack Query, Tailwind v4, shadcn-v4/base-ui primitives, Zod, vitest.

**Spec:** `docs/superpowers/specs/2026-06-02-creative-kickoff-brief-tool-design.md`

---

## Conventions (read once)

- **Test runner:** `npm test` (= `vitest run`). Single file: `npx vitest run src/path/file.test.ts`. Tests are colocated `*.test.ts(x)`; env is `node`; `@/` → `src/`.
- **API pattern (mirror `src/app/api/brands/route.ts`):** `await auth()` from `@clerk/nextjs/server` → Zod validate → `createSupabaseClient(token)` where `token = await getToken({ template: "supabase" })` → structured `NextResponse.json`. Log server errors with `console.error`; return generic messages.
- **No Supabase imports in `src/lib/project-kickoff/*` except `repository.supabase.ts`.** No Next.js imports anywhere in the core.
- **Commit after every task.** Conventional-commit messages, scope `kickoff`.

## File structure

```
supabase/migrations/006_project_kickoffs.sql          (create)

src/lib/project-kickoff/
  types.ts            (create)  domain types — referenced everywhere
  form-schema.ts      (create)  the 7 sections + fields, as data
  config.ts           (create)  approver allowlist from env
  validation.ts       (create)  active sections, required-field gate, progress
  status-machine.ts   (create)  transitions + permissions
  merge.ts            (create)  section-slice merge + empty section
  repository.ts       (create)  KickoffRepository interface (the seam)
  repository.supabase.ts (create)  Supabase adapter (row <-> domain mapping)
  queries.ts          (create)  client fetch + TanStack Query hooks
  *.test.ts           (create)  colocated unit tests for the pure modules + adapter

src/app/api/kickoffs/
  route.ts            (create)  GET list, POST create   + route.test.ts
  [id]/route.ts       (create)  GET one, PATCH autosave, DELETE soft-delete + test
  [id]/transition/route.ts (create) POST transition     + test

src/components/project-kickoff/
  field-input.tsx       (create)  one field, editable/read-only
  approval-control.tsx  (create)  Yes/No/Partial segmented + notes
  deliverable-bar.tsx   (create)  3 toggle pills
  section-card.tsx      (create)  one collapsible section
  status-rail.tsx       (create)  left rail, jump + per-section status
  save-indicator.tsx    (create)  Saving / Saved / retry
  use-autosave.ts        (create)  debounced section PATCH hook
  kickoff-editor.tsx    (create)  composes the editor
  kickoff-list.tsx      (create)  list with Active/Approved tabs

src/app/dashboard/strategist/project-kickoff/
  page.tsx            (create)  list page
  [id]/page.tsx       (create)  editor page

src/app/dashboard/strategist/page.tsx   (modify) register tool card
src/app/dashboard/page.tsx              (modify) add featured workflow + allTools entry
```

---

# Phase 0 — Database & config

### Task 0: Migration, env var, Clerk template

**Files:**
- Create: `supabase/migrations/006_project_kickoffs.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Creative Kickoff Brief: one row per brief, JSONB sections.
-- See: docs/superpowers/specs/2026-06-02-creative-kickoff-brief-tool-design.md

create table if not exists project_kickoffs (
  id            uuid primary key default gen_random_uuid(),
  title         text not null default 'Untitled brief',
  status        text not null default 'draft',  -- draft | under_review | approved
  locked        boolean not null default false,
  deliverables  jsonb not null default '{"case_study":false,"social":false,"award":false}'::jsonb,
  sections      jsonb not null default '{}'::jsonb,
  created_by    text not null,
  submitted_by  text,
  submitted_at  timestamptz,
  approved_by   text,
  approved_at   timestamptz,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_project_kickoffs_status     on project_kickoffs(status);
create index if not exists idx_project_kickoffs_deleted_at on project_kickoffs(deleted_at);

-- set_updated_at() already exists (migration 005_brands.sql).
drop trigger if exists project_kickoffs_set_updated_at on project_kickoffs;
create trigger project_kickoffs_set_updated_at
  before update on project_kickoffs
  for each row execute function set_updated_at();

alter table project_kickoffs enable row level security;

-- Internal-team posture (same as brands): any authenticated Clerk user has full access.
-- Finer rules (who can approve, lock gating, draft-only delete) live in the app core.
create policy "Authenticated read kickoffs"   on project_kickoffs for select to authenticated using (true);
create policy "Authenticated insert kickoffs" on project_kickoffs for insert to authenticated with check (true);
create policy "Authenticated update kickoffs" on project_kickoffs for update to authenticated using (true) with check (true);
create policy "Authenticated delete kickoffs" on project_kickoffs for delete to authenticated using (true);
```

- [ ] **Step 2: Apply the migration**

Run it in the Supabase SQL editor for this project (there is no Supabase CLI in `package.json`; migrations are applied by hand, same as 001–005). Confirm the table exists:
`select * from project_kickoffs limit 1;` → returns 0 rows, no error.

- [ ] **Step 3: Add the approver env var**

Add to `.env.local` (and document in `.env.local.example`):
```
KICKOFF_APPROVER_IDS=user_REPLACE_WITH_CLERK_ID
```
The Clerk **`supabase` JWT template** is already configured (the brands tool uses `getToken({ template: "supabase" })`); no new Clerk setup needed.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/006_project_kickoffs.sql .env.local.example
git commit -m "feat(kickoff): add project_kickoffs table + RLS migration"
```

---

# Phase 1 — Portable core (pure, TDD)

### Task 1: Domain types

**Files:**
- Create: `src/lib/project-kickoff/types.ts`

- [ ] **Step 1: Write the types** (no test — pure type declarations)

```ts
export type DeliverableKey = "case_study" | "social" | "award";
export type Deliverables = Record<DeliverableKey, boolean>;

export type KickoffStatus = "draft" | "under_review" | "approved";
export type SectionStatus = "not_started" | "in_progress" | "done";
export type ApprovalValue = "yes" | "no" | "partial" | null;

export type FieldType = "text" | "textarea";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
}

export interface SectionDef {
  id: number; // 1..7
  title: string;
  always: boolean; // §1,2,3,7
  deliverable?: DeliverableKey; // §4,5,6
  fields: FieldDef[];
}

export interface SectionData {
  answers: Record<string, string>;
  approval: ApprovalValue;
  approval_notes: string;
  owner: string | null;
  section_status: SectionStatus;
  last_edited_by: string | null;
  last_edited_at: string | null;
}

export type Sections = Record<string, SectionData>; // keys "1".."7"

export interface Kickoff {
  id: string;
  title: string;
  status: KickoffStatus;
  locked: boolean;
  deliverables: Deliverables;
  sections: Sections;
  created_by: string;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KickoffSummary {
  id: string;
  title: string;
  status: KickoffStatus;
  deliverables: Deliverables;
  progress: { done: number; total: number };
  updated_at: string;
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → Expected: no errors.
```bash
git add src/lib/project-kickoff/types.ts
git commit -m "feat(kickoff): add core domain types"
```

---

### Task 2: Form schema (the 7 sections as data)

**Files:**
- Create: `src/lib/project-kickoff/form-schema.ts`
- Test: `src/lib/project-kickoff/form-schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { KICKOFF_FORM } from "./form-schema";

describe("KICKOFF_FORM", () => {
  it("has 7 sections with ids 1..7", () => {
    expect(KICKOFF_FORM.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("marks §1,2,3,7 as always and §4,5,6 as deliverable-gated", () => {
    const always = KICKOFF_FORM.filter((s) => s.always).map((s) => s.id);
    expect(always).toEqual([1, 2, 3, 7]);
    expect(KICKOFF_FORM.find((s) => s.id === 4)?.deliverable).toBe("case_study");
    expect(KICKOFF_FORM.find((s) => s.id === 5)?.deliverable).toBe("social");
    expect(KICKOFF_FORM.find((s) => s.id === 6)?.deliverable).toBe("award");
  });

  it("has globally-unique field keys", () => {
    const keys = KICKOFF_FORM.flatMap((s) => s.fields.map((f) => f.key));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("marks the known required fields", () => {
    const required = KICKOFF_FORM.flatMap((s) =>
      s.fields.filter((f) => f.required).map((f) => f.key)
    );
    expect(required).toContain("client_brand");
    expect(required).toContain("campaign_name");
    expect(required).toContain("social_platforms"); // §5 required
    expect(required).toContain("award_shows");      // §6 required
    expect(required).not.toContain("case_narrative"); // §4 has no required fields
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/project-kickoff/form-schema.test.ts`
Expected: FAIL — cannot find module `./form-schema`.

- [ ] **Step 3: Write the form schema**

```ts
import type { SectionDef } from "./types";

const text = (key: string, label: string, required = false) =>
  ({ key, label, type: "text" as const, required });
const area = (key: string, label: string, required = false) =>
  ({ key, label, type: "textarea" as const, required });

export const KICKOFF_FORM: SectionDef[] = [
  {
    id: 1, title: "Campaign Overview", always: true,
    fields: [
      text("client_brand", "Client / brand name", true),
      text("campaign_name", "Campaign / project name", true),
      text("industry", "Industry / category", true),
      area("campaign_summary", "In one sentence, what did this campaign do?", true),
      area("business_problem", "What was the business problem or opportunity?", true),
    ],
  },
  {
    id: 2, title: "The Work", always: true,
    fields: [
      area("creative_idea", "What was the creative idea / big concept?", true),
      area("channels", "What channels / formats did the campaign run across?"),
      area("differentiator", "What made this work different or unexpected?"),
      area("craft_details", "Are there any craft / production details worth highlighting?"),
    ],
  },
  {
    id: 3, title: "Results & Proof", always: true,
    fields: [
      area("result_business", "Business result", true),
      area("result_audience", "Audience / engagement result", true),
      area("result_brand", "Brand / perception result"),
      area("result_other", "Any other noteworthy numbers, earned media, or cultural signals?"),
      area("result_restrictions", "What are the result-sharing restrictions, if any?"),
    ],
  },
  {
    id: 4, title: "Case Study Specifics", always: false, deliverable: "case_study",
    fields: [
      area("case_narrative", "What's the narrative arc?"),
      area("case_audience", "Who is the case study written for?"),
      area("case_quotes", "What quotes or client testimonials are available?"),
      area("case_assets", "What visual assets are available for the case study?"),
    ],
  },
  {
    id: 5, title: "Social Post Specifics", always: false, deliverable: "social",
    fields: [
      area("social_platforms", "Which platforms are we posting on?", true),
      area("social_accounts", "Whose account(s)?", true),
      area("social_tone", "What's the tone / voice for social?"),
      area("social_goal", "What do we want people to feel or do after seeing the post?"),
      area("social_credits", "Are there any credits, tags, or handles to include?"),
      area("social_timing", "Any post timing, campaign tie-ins, or industry events to align with?"),
    ],
  },
  {
    id: 6, title: "Award Submission Specifics", always: false, deliverable: "award",
    fields: [
      area("award_shows", "Which award show(s) are we entering?", true),
      area("award_categories", "Which category / categories?"),
      area("award_ambition", "What level of ambition are we setting?"),
      area("award_worthy", "What is the single most award-worthy thing about this work?"),
      area("award_benchmarks", "Are there competitive or industry benchmarks to reference?"),
      area("award_limit", "What is the entry word / character limit?"),
    ],
  },
  {
    id: 7, title: "Approvals & Assets", always: true,
    fields: [
      text("approver_internal", "Who is the internal approver?", true),
      text("approver_client", "Does the client need to approve?", true),
      area("assets_location", "Where are the final assets housed?"),
      area("clearances", "Are there any legal, IP, talent, or music clearances to be aware of?"),
      area("exclusions", "Is there anything that must NOT be included in any of the deliverables?"),
    ],
  },
];

export const SECTION_BY_ID: Record<number, SectionDef> =
  Object.fromEntries(KICKOFF_FORM.map((s) => [s.id, s]));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/project-kickoff/form-schema.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/project-kickoff/form-schema.ts src/lib/project-kickoff/form-schema.test.ts
git commit -m "feat(kickoff): add form schema (7 sections, fields ported from live form)"
```

---

### Task 3: Config (approver allowlist)

**Files:**
- Create: `src/lib/project-kickoff/config.ts`
- Test: `src/lib/project-kickoff/config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { approverIds, canApprove } from "./config";

const ORIG = process.env.KICKOFF_APPROVER_IDS;
afterEach(() => { process.env.KICKOFF_APPROVER_IDS = ORIG; });

describe("config", () => {
  it("parses a comma-separated list, trimming blanks", () => {
    process.env.KICKOFF_APPROVER_IDS = " user_a , user_b ,";
    expect(approverIds()).toEqual(["user_a", "user_b"]);
  });

  it("canApprove is true only for listed ids", () => {
    process.env.KICKOFF_APPROVER_IDS = "user_a";
    expect(canApprove("user_a")).toBe(true);
    expect(canApprove("user_b")).toBe(false);
    expect(canApprove(null)).toBe(false);
  });

  it("returns empty list when unset", () => {
    delete process.env.KICKOFF_APPROVER_IDS;
    expect(approverIds()).toEqual([]);
    expect(canApprove("user_a")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/project-kickoff/config.test.ts` → Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// The ONLY core module that reads process.env. Approver rule lives here (not in RLS)
// so it ports with the rest of the core; back it with a roles table later if needed.
export function approverIds(): string[] {
  return (process.env.KICKOFF_APPROVER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function canApprove(userId: string | null): boolean {
  if (!userId) return false;
  return approverIds().includes(userId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/project-kickoff/config.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/project-kickoff/config.ts src/lib/project-kickoff/config.test.ts
git commit -m "feat(kickoff): add config-driven approver allowlist"
```

---

### Task 4: Validation (active sections, required gate, progress)

**Files:**
- Create: `src/lib/project-kickoff/validation.ts`
- Test: `src/lib/project-kickoff/validation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { activeSections, missingRequired, isSubmittable, progressOf } from "./validation";
import type { Deliverables, Sections } from "./types";

const noDeliverables: Deliverables = { case_study: false, social: false, award: false };

function emptySections(): Sections {
  const s: Sections = {};
  for (const id of [1, 2, 3, 4, 5, 6, 7]) {
    s[String(id)] = {
      answers: {}, approval: null, approval_notes: "",
      owner: null, section_status: "not_started",
      last_edited_by: null, last_edited_at: null,
    };
  }
  return s;
}

describe("activeSections", () => {
  it("returns §1,2,3,7 when no deliverables selected", () => {
    expect(activeSections(noDeliverables).map((s) => s.id)).toEqual([1, 2, 3, 7]);
  });
  it("includes §4 when case_study is selected", () => {
    const ids = activeSections({ ...noDeliverables, case_study: true }).map((s) => s.id);
    expect(ids).toEqual([1, 2, 3, 4, 7]);
  });
});

describe("missingRequired", () => {
  it("lists every empty required field in active sections", () => {
    const missing = missingRequired(noDeliverables, emptySections());
    const keys = missing.map((m) => m.key);
    expect(keys).toContain("client_brand"); // §1
    expect(keys).not.toContain("social_platforms"); // §5 inactive
    expect(isSubmittable(noDeliverables, emptySections())).toBe(false);
  });

  it("is submittable when all active required fields are filled", () => {
    const s = emptySections();
    for (const id of [1, 2, 3, 7]) {
      s[String(id)].answers = {
        client_brand: "x", campaign_name: "x", industry: "x", campaign_summary: "x",
        business_problem: "x", creative_idea: "x", result_business: "x",
        result_audience: "x", approver_internal: "x", approver_client: "x",
      };
    }
    expect(missingRequired(noDeliverables, s)).toEqual([]);
    expect(isSubmittable(noDeliverables, s)).toBe(true);
  });

  it("treats whitespace-only answers as empty", () => {
    const s = emptySections();
    s["1"].answers.client_brand = "   ";
    expect(missingRequired(noDeliverables, s).some((m) => m.key === "client_brand")).toBe(true);
  });
});

describe("progressOf", () => {
  it("counts done sections out of active sections", () => {
    const s = emptySections();
    s["1"].section_status = "done";
    expect(progressOf(noDeliverables, s)).toEqual({ done: 1, total: 4 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/project-kickoff/validation.test.ts` → Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
import { KICKOFF_FORM } from "./form-schema";
import type { Deliverables, Sections, SectionDef } from "./types";

export interface MissingField { section: number; key: string; label: string; }

export function activeSections(deliverables: Deliverables): SectionDef[] {
  return KICKOFF_FORM.filter(
    (s) => s.always || (s.deliverable ? deliverables[s.deliverable] : false)
  );
}

export function missingRequired(deliverables: Deliverables, sections: Sections): MissingField[] {
  const out: MissingField[] = [];
  for (const sec of activeSections(deliverables)) {
    const data = sections[String(sec.id)];
    for (const f of sec.fields) {
      if (!f.required) continue;
      const val = (data?.answers?.[f.key] ?? "").trim();
      if (!val) out.push({ section: sec.id, key: f.key, label: f.label });
    }
  }
  return out;
}

export function isSubmittable(deliverables: Deliverables, sections: Sections): boolean {
  return missingRequired(deliverables, sections).length === 0;
}

export function progressOf(deliverables: Deliverables, sections: Sections): { done: number; total: number } {
  const active = activeSections(deliverables);
  const done = active.filter((s) => sections[String(s.id)]?.section_status === "done").length;
  return { done, total: active.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/project-kickoff/validation.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/project-kickoff/validation.ts src/lib/project-kickoff/validation.test.ts
git commit -m "feat(kickoff): add validation (active sections, required gate, progress)"
```

---

### Task 5: Status machine (transitions + permissions)

**Files:**
- Create: `src/lib/project-kickoff/status-machine.ts`
- Test: `src/lib/project-kickoff/status-machine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { applyTransition } from "./status-machine";

describe("applyTransition", () => {
  it("submit: draft → under_review when required complete, sets locked", () => {
    const r = applyTransition("submit", { status: "draft", isApprover: false, requiredComplete: true });
    expect(r).toMatchObject({ ok: true, nextStatus: "under_review", locked: true });
  });
  it("submit: blocked when required incomplete", () => {
    const r = applyTransition("submit", { status: "draft", isApprover: false, requiredComplete: false });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("required_incomplete");
  });
  it("submit: only from draft", () => {
    expect(applyTransition("submit", { status: "approved", isApprover: false, requiredComplete: true }).ok).toBe(false);
  });

  it("approve: under_review → approved only for approver", () => {
    expect(applyTransition("approve", { status: "under_review", isApprover: true, requiredComplete: true }))
      .toMatchObject({ ok: true, nextStatus: "approved", locked: true });
    const denied = applyTransition("approve", { status: "under_review", isApprover: false, requiredComplete: true });
    expect(denied.ok).toBe(false);
    expect(denied.code).toBe("forbidden");
  });

  it("reopen: under_review → draft for any user, clears lock", () => {
    expect(applyTransition("reopen", { status: "under_review", isApprover: false, requiredComplete: true }))
      .toMatchObject({ ok: true, nextStatus: "draft", locked: false });
  });
  it("reopen: approved → draft only for approver", () => {
    expect(applyTransition("reopen", { status: "approved", isApprover: true, requiredComplete: true }))
      .toMatchObject({ ok: true, nextStatus: "draft", locked: false });
    expect(applyTransition("reopen", { status: "approved", isApprover: false, requiredComplete: true }).code)
      .toBe("forbidden");
  });
  it("reopen: invalid from draft", () => {
    expect(applyTransition("reopen", { status: "draft", isApprover: true, requiredComplete: true }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/project-kickoff/status-machine.test.ts` → Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
import type { KickoffStatus } from "./types";

export type TransitionAction = "submit" | "approve" | "reopen";

export interface TransitionContext {
  status: KickoffStatus;
  isApprover: boolean;
  requiredComplete: boolean;
}

export type TransitionCode = "ok" | "invalid_transition" | "forbidden" | "required_incomplete";

export interface TransitionResult {
  ok: boolean;
  code: TransitionCode;
  nextStatus?: KickoffStatus;
  locked?: boolean;
}

export function applyTransition(action: TransitionAction, ctx: TransitionContext): TransitionResult {
  switch (action) {
    case "submit":
      if (ctx.status !== "draft") return { ok: false, code: "invalid_transition" };
      if (!ctx.requiredComplete) return { ok: false, code: "required_incomplete" };
      return { ok: true, code: "ok", nextStatus: "under_review", locked: true };

    case "approve":
      if (ctx.status !== "under_review") return { ok: false, code: "invalid_transition" };
      if (!ctx.isApprover) return { ok: false, code: "forbidden" };
      return { ok: true, code: "ok", nextStatus: "approved", locked: true };

    case "reopen":
      if (ctx.status === "under_review") return { ok: true, code: "ok", nextStatus: "draft", locked: false };
      if (ctx.status === "approved") {
        if (!ctx.isApprover) return { ok: false, code: "forbidden" };
        return { ok: true, code: "ok", nextStatus: "draft", locked: false };
      }
      return { ok: false, code: "invalid_transition" };

    default:
      return { ok: false, code: "invalid_transition" };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/project-kickoff/status-machine.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/project-kickoff/status-machine.ts src/lib/project-kickoff/status-machine.test.ts
git commit -m "feat(kickoff): add status machine (transitions + approver gating)"
```

---

### Task 6: Merge (section-slice autosave merge)

**Files:**
- Create: `src/lib/project-kickoff/merge.ts`
- Test: `src/lib/project-kickoff/merge.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { emptySectionData, mergeSection, allEmptySections } from "./merge";
import type { Sections } from "./types";

describe("mergeSection", () => {
  it("merges answers into the target section and stamps editor + time", () => {
    const before: Sections = { "2": emptySectionData() };
    const after = mergeSection(before, 2, { answers: { creative_idea: "Big idea" } }, "user_x", "2026-06-02T00:00:00Z");
    expect(after["2"].answers.creative_idea).toBe("Big idea");
    expect(after["2"].last_edited_by).toBe("user_x");
    expect(after["2"].last_edited_at).toBe("2026-06-02T00:00:00Z");
  });

  it("does not mutate the input", () => {
    const before: Sections = { "2": emptySectionData() };
    mergeSection(before, 2, { answers: { x: "y" } }, "user_x", "t");
    expect(before["2"].answers).toEqual({});
  });

  it("preserves sibling sections", () => {
    const before: Sections = { "1": { ...emptySectionData(), owner: "user_a" }, "2": emptySectionData() };
    const after = mergeSection(before, 2, { section_status: "done" }, "user_x", "t");
    expect(after["1"].owner).toBe("user_a");
    expect(after["2"].section_status).toBe("done");
  });

  it("creates the section if absent", () => {
    const after = mergeSection({}, 5, { approval: "partial" }, "user_x", "t");
    expect(after["5"].approval).toBe("partial");
  });

  it("merges answers additively (keeps prior keys)", () => {
    let s: Sections = { "1": emptySectionData() };
    s = mergeSection(s, 1, { answers: { a: "1" } }, "u", "t");
    s = mergeSection(s, 1, { answers: { b: "2" } }, "u", "t");
    expect(s["1"].answers).toEqual({ a: "1", b: "2" });
  });
});

describe("allEmptySections", () => {
  it("returns 7 empty sections keyed 1..7", () => {
    const s = allEmptySections();
    expect(Object.keys(s).sort()).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    expect(s["1"].section_status).toBe("not_started");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/project-kickoff/merge.test.ts` → Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
import type { Sections, SectionData, ApprovalValue, SectionStatus } from "./types";

export interface SectionPatch {
  answers?: Record<string, string>;
  approval?: ApprovalValue;
  approval_notes?: string;
  owner?: string | null;
  section_status?: SectionStatus;
}

export function emptySectionData(): SectionData {
  return {
    answers: {},
    approval: null,
    approval_notes: "",
    owner: null,
    section_status: "not_started",
    last_edited_by: null,
    last_edited_at: null,
  };
}

export function allEmptySections(): Sections {
  const s: Sections = {};
  for (const id of [1, 2, 3, 4, 5, 6, 7]) s[String(id)] = emptySectionData();
  return s;
}

export function mergeSection(
  sections: Sections,
  sectionId: number,
  patch: SectionPatch,
  editor: string,
  nowIso: string
): Sections {
  const key = String(sectionId);
  const prev = sections[key] ?? emptySectionData();
  const next: SectionData = {
    ...prev,
    ...(patch.approval !== undefined ? { approval: patch.approval } : {}),
    ...(patch.approval_notes !== undefined ? { approval_notes: patch.approval_notes } : {}),
    ...(patch.owner !== undefined ? { owner: patch.owner } : {}),
    ...(patch.section_status !== undefined ? { section_status: patch.section_status } : {}),
    answers: patch.answers ? { ...prev.answers, ...patch.answers } : prev.answers,
    last_edited_by: editor,
    last_edited_at: nowIso,
  };
  return { ...sections, [key]: next };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/project-kickoff/merge.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/project-kickoff/merge.ts src/lib/project-kickoff/merge.test.ts
git commit -m "feat(kickoff): add immutable section-merge for autosave"
```

---

# Phase 2 — Persistence (repository seam)

### Task 7: Repository interface

**Files:**
- Create: `src/lib/project-kickoff/repository.ts`

- [ ] **Step 1: Write the interface** (no test — type-only contract)

```ts
import type { Kickoff, KickoffSummary } from "./types";

export type ListTab = "active" | "approved";

/** Persistence seam. Reimplement this one file to move platforms. */
export interface KickoffRepository {
  list(tab: ListTab): Promise<KickoffSummary[]>;
  get(id: string): Promise<Kickoff | null>;
  create(createdBy: string): Promise<string>; // returns new id
  /** Partial update of the persisted columns. Returns the fresh row. */
  update(id: string, patch: KickoffUpdate): Promise<Kickoff>;
  softDelete(id: string): Promise<void>;
}

export interface KickoffUpdate {
  title?: string;
  status?: Kickoff["status"];
  locked?: boolean;
  deliverables?: Kickoff["deliverables"];
  sections?: Kickoff["sections"];
  submitted_by?: string | null;
  submitted_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → Expected: no errors.
```bash
git add src/lib/project-kickoff/repository.ts
git commit -m "feat(kickoff): add KickoffRepository interface (persistence seam)"
```

---

### Task 8: Supabase adapter

**Files:**
- Create: `src/lib/project-kickoff/repository.supabase.ts`
- Test: `src/lib/project-kickoff/repository.supabase.test.ts`

- [ ] **Step 1: Write the failing test** (verify row↔domain mapping + query shape with a fake client)

```ts
import { describe, it, expect, vi } from "vitest";
import { makeSupabaseKickoffRepository } from "./repository.supabase";

function fakeRow(over: Record<string, unknown> = {}) {
  return {
    id: "id1", title: "Acme", status: "draft", locked: false,
    deliverables: { case_study: true, social: false, award: false },
    sections: { "1": { answers: {}, approval: null, approval_notes: "", owner: null, section_status: "done", last_edited_by: null, last_edited_at: null } },
    created_by: "user_a", submitted_by: null, submitted_at: null,
    approved_by: null, approved_at: null,
    created_at: "t", updated_at: "t", ...over,
  };
}

describe("supabase adapter", () => {
  it("get() maps a row to a Kickoff", async () => {
    const single = vi.fn().mockResolvedValue({ data: fakeRow(), error: null });
    const client = {
      from: () => ({ select: () => ({ eq: () => ({ is: () => ({ single }) }) }) }),
    };
    const repo = makeSupabaseKickoffRepository(client as never);
    const k = await repo.get("id1");
    expect(k?.id).toBe("id1");
    expect(k?.deliverables.case_study).toBe(true);
  });

  it("list() returns summaries with computed progress", async () => {
    const order = vi.fn().mockResolvedValue({ data: [fakeRow()], error: null });
    const client = {
      from: () => ({ select: () => ({ in: () => ({ is: () => ({ order }) }) }) }),
    };
    const repo = makeSupabaseKickoffRepository(client as never);
    const rows = await repo.list("active");
    expect(rows[0].progress).toEqual({ done: 1, total: 5 }); // §1,2,3,4,7 active; §1 done
  });

  it("create() inserts and returns the new id", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "newid" }, error: null });
    const client = { from: () => ({ insert: () => ({ select: () => ({ single }) }) }) };
    const repo = makeSupabaseKickoffRepository(client as never);
    expect(await repo.create("user_a")).toBe("newid");
  });

  it("get() returns null on not-found error", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    const client = { from: () => ({ select: () => ({ eq: () => ({ is: () => ({ single }) }) }) }) };
    const repo = makeSupabaseKickoffRepository(client as never);
    expect(await repo.get("missing")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/project-kickoff/repository.supabase.test.ts` → Expected: FAIL — module not found.

- [ ] **Step 3: Write the adapter**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Kickoff, KickoffSummary } from "./types";
import type { KickoffRepository, KickoffUpdate, ListTab } from "./repository";
import { allEmptySections } from "./merge";
import { progressOf } from "./validation";

const TABLE = "project_kickoffs";

type Row = Omit<Kickoff, never>; // DB row has the same field names as Kickoff

function rowToKickoff(r: Row): Kickoff {
  return {
    id: r.id, title: r.title, status: r.status, locked: r.locked,
    deliverables: r.deliverables, sections: r.sections ?? {},
    created_by: r.created_by,
    submitted_by: r.submitted_by, submitted_at: r.submitted_at,
    approved_by: r.approved_by, approved_at: r.approved_at,
    created_at: r.created_at, updated_at: r.updated_at,
  };
}

export function makeSupabaseKickoffRepository(client: SupabaseClient): KickoffRepository {
  return {
    async list(tab: ListTab): Promise<KickoffSummary[]> {
      const statuses = tab === "approved" ? ["approved"] : ["draft", "under_review"];
      const { data, error } = await client
        .from(TABLE)
        .select("id, title, status, deliverables, sections, updated_at")
        .in("status", statuses)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: Row) => ({
        id: r.id, title: r.title, status: r.status,
        deliverables: r.deliverables, updated_at: r.updated_at,
        progress: progressOf(r.deliverables, r.sections ?? {}),
      }));
    },

    async get(id: string): Promise<Kickoff | null> {
      const { data, error } = await client
        .from(TABLE).select("*").eq("id", id).is("deleted_at", null).single();
      if (error) {
        if (error.code === "PGRST116") return null; // no rows
        throw error;
      }
      return rowToKickoff(data as Row);
    },

    async create(createdBy: string): Promise<string> {
      const { data, error } = await client
        .from(TABLE)
        .insert({ created_by: createdBy, sections: allEmptySections() })
        .select("id").single();
      if (error) throw error;
      return (data as { id: string }).id;
    },

    async update(id: string, patch: KickoffUpdate): Promise<Kickoff> {
      const { data, error } = await client
        .from(TABLE).update(patch).eq("id", id).select("*").single();
      if (error) throw error;
      return rowToKickoff(data as Row);
    },

    async softDelete(id: string): Promise<void> {
      const { error } = await client
        .from(TABLE).update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/project-kickoff/repository.supabase.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/project-kickoff/repository.supabase.ts src/lib/project-kickoff/repository.supabase.test.ts
git commit -m "feat(kickoff): add Supabase repository adapter"
```

---

# Phase 3 — API routes

> Shared helper used by all routes to build an authed repository. Define it inline in each route's imports.

### Task 9: List + create route

**Files:**
- Create: `src/app/api/kickoffs/route.ts`
- Test: `src/app/api/kickoffs/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockGetToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const mockList = vi.fn();
const mockCreate = vi.fn();
vi.mock("@/lib/project-kickoff/repository.supabase", () => ({
  makeSupabaseKickoffRepository: () => ({ list: mockList, create: mockCreate }),
}));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseClient: () => ({}) }));

import { GET, POST } from "./route";
import { auth } from "@clerk/nextjs/server";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetToken.mockResolvedValue("jwt");
  vi.mocked(auth).mockResolvedValue({ userId: "user_a", getToken: mockGetToken } as never);
  mockList.mockResolvedValue([]);
  mockCreate.mockResolvedValue("newid");
});

function req(url: string): NextRequest {
  return new Request(url) as unknown as NextRequest;
}

describe("GET /api/kickoffs", () => {
  it("401 when signed out", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    expect((await GET(req("http://x/api/kickoffs?tab=active"))).status).toBe(401);
  });
  it("returns list for the requested tab", async () => {
    mockList.mockResolvedValue([{ id: "a" }]);
    const res = await GET(req("http://x/api/kickoffs?tab=approved"));
    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith("approved");
    expect((await res.json()).kickoffs).toHaveLength(1);
  });
  it("defaults to active for an unknown tab", async () => {
    await GET(req("http://x/api/kickoffs?tab=garbage"));
    expect(mockList).toHaveBeenCalledWith("active");
  });
});

describe("POST /api/kickoffs", () => {
  it("401 when signed out", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    expect((await POST()).status).toBe(401);
  });
  it("creates a draft and returns the id", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith("user_a");
    expect((await res.json()).id).toBe("newid");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/kickoffs/route.test.ts` → Expected: FAIL — module not found.

- [ ] **Step 3: Write the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase/client";
import { makeSupabaseKickoffRepository } from "@/lib/project-kickoff/repository.supabase";
import type { ListTab } from "@/lib/project-kickoff/repository";

async function authedRepo() {
  const { userId, getToken } = await auth();
  if (!userId) return null;
  const token = await getToken({ template: "supabase" });
  return { userId, repo: makeSupabaseKickoffRepository(createSupabaseClient(token ?? undefined)) };
}

export async function GET(req: NextRequest) {
  const ctx = await authedRepo();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const raw = req.nextUrl.searchParams.get("tab");
  const tab: ListTab = raw === "approved" ? "approved" : "active";
  try {
    const kickoffs = await ctx.repo.list(tab);
    return NextResponse.json({ kickoffs });
  } catch (e) {
    console.error("kickoffs list failed:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST() {
  const ctx = await authedRepo();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const id = await ctx.repo.create(ctx.userId);
    return NextResponse.json({ id });
  } catch (e) {
    console.error("kickoff create failed:", e);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/kickoffs/route.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/kickoffs/route.ts src/app/api/kickoffs/route.test.ts
git commit -m "feat(kickoff): add list + create API route"
```

---

### Task 10: Get / autosave (PATCH) / soft-delete route

**Files:**
- Create: `src/app/api/kickoffs/[id]/route.ts`
- Test: `src/app/api/kickoffs/[id]/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockGetToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const mockGet = vi.fn();
const mockUpdate = vi.fn();
const mockSoftDelete = vi.fn();
vi.mock("@/lib/project-kickoff/repository.supabase", () => ({
  makeSupabaseKickoffRepository: () => ({ get: mockGet, update: mockUpdate, softDelete: mockSoftDelete }),
}));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseClient: () => ({}) }));

import { GET, PATCH, DELETE } from "./route";
import { auth } from "@clerk/nextjs/server";

const baseKickoff = {
  id: "id1", title: "Untitled brief", status: "draft", locked: false,
  deliverables: { case_study: false, social: false, award: false },
  sections: {}, created_by: "user_a",
  submitted_by: null, submitted_at: null, approved_by: null, approved_at: null,
  created_at: "t", updated_at: "t",
};

const params = { params: Promise.resolve({ id: "id1" }) };

function patchReq(body: unknown): NextRequest {
  return new Request("http://x/api/kickoffs/id1", {
    method: "PATCH", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
  }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetToken.mockResolvedValue("jwt");
  vi.mocked(auth).mockResolvedValue({ userId: "user_a", getToken: mockGetToken } as never);
  mockGet.mockResolvedValue(baseKickoff);
  mockUpdate.mockResolvedValue({ ...baseKickoff, updated_at: "t2" });
});

describe("GET /api/kickoffs/[id]", () => {
  it("401 signed out", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    expect((await GET(new Request("http://x") as never, params)).status).toBe(401);
  });
  it("404 when missing", async () => {
    mockGet.mockResolvedValue(null);
    expect((await GET(new Request("http://x") as never, params)).status).toBe(404);
  });
  it("200 with the kickoff", async () => {
    const res = await GET(new Request("http://x") as never, params);
    expect((await res.json()).kickoff.id).toBe("id1");
  });
});

describe("PATCH /api/kickoffs/[id]", () => {
  it("merges a section answer slice and returns fresh updated_at", async () => {
    const res = await PATCH(patchReq({ section: 2, patch: { answers: { creative_idea: "x" } } }), params);
    expect(res.status).toBe(200);
    const arg = mockUpdate.mock.calls[0][1];
    expect(arg.sections["2"].answers.creative_idea).toBe("x");
    expect(arg.sections["2"].last_edited_by).toBe("user_a");
    expect((await res.json()).updated_at).toBe("t2");
  });
  it("mirrors campaign_name into title", async () => {
    await PATCH(patchReq({ section: 1, patch: { answers: { campaign_name: "Acme Spring" } } }), params);
    expect(mockUpdate.mock.calls[0][1].title).toBe("Acme Spring");
  });
  it("updates deliverables", async () => {
    await PATCH(patchReq({ deliverables: { case_study: true, social: false, award: false } }), params);
    expect(mockUpdate.mock.calls[0][1].deliverables.case_study).toBe(true);
  });
  it("403 when the brief is locked", async () => {
    mockGet.mockResolvedValue({ ...baseKickoff, locked: true });
    expect((await PATCH(patchReq({ section: 1, patch: { answers: { a: "b" } } }), params)).status).toBe(403);
  });
  it("400 on malformed body", async () => {
    expect((await PATCH(patchReq({ section: 99, patch: {} }), params)).status).toBe(400);
  });
});

describe("DELETE /api/kickoffs/[id]", () => {
  it("soft-deletes a draft", async () => {
    const res = await DELETE(new Request("http://x", { method: "DELETE" }) as never, params);
    expect(res.status).toBe(200);
    expect(mockSoftDelete).toHaveBeenCalledWith("id1");
  });
  it("409 when not a draft", async () => {
    mockGet.mockResolvedValue({ ...baseKickoff, status: "under_review" });
    expect((await DELETE(new Request("http://x", { method: "DELETE" }) as never, params)).status).toBe(409);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/api/kickoffs/[id]/route.test.ts"` → Expected: FAIL — module not found.

- [ ] **Step 3: Write the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { createSupabaseClient } from "@/lib/supabase/client";
import { makeSupabaseKickoffRepository } from "@/lib/project-kickoff/repository.supabase";
import { mergeSection } from "@/lib/project-kickoff/merge";
import type { KickoffUpdate } from "@/lib/project-kickoff/repository";

type Ctx = { params: Promise<{ id: string }> };

async function authedRepo() {
  const { userId, getToken } = await auth();
  if (!userId) return null;
  const token = await getToken({ template: "supabase" });
  return { userId, repo: makeSupabaseKickoffRepository(createSupabaseClient(token ?? undefined)) };
}

const sectionPatchSchema = z.object({
  answers: z.record(z.string(), z.string()).optional(),
  approval: z.enum(["yes", "no", "partial"]).nullable().optional(),
  approval_notes: z.string().optional(),
  owner: z.string().nullable().optional(),
  section_status: z.enum(["not_started", "in_progress", "done"]).optional(),
});

const patchSchema = z.object({
  section: z.number().int().min(1).max(7).optional(),
  patch: sectionPatchSchema.optional(),
  deliverables: z.object({
    case_study: z.boolean(), social: z.boolean(), award: z.boolean(),
  }).optional(),
}).refine((b) => (b.section === undefined) === (b.patch === undefined), {
  message: "section and patch must be provided together",
});

export async function GET(_req: NextRequest, { params }: Ctx) {
  const ctx = await authedRepo();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const kickoff = await ctx.repo.get(id);
    if (!kickoff) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ kickoff });
  } catch (e) {
    console.error("kickoff get failed:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const ctx = await authedRepo();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.format() }, { status: 400 });
  }

  try {
    const current = await ctx.repo.get(id);
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (current.locked) return NextResponse.json({ error: "Locked" }, { status: 403 });

    const update: KickoffUpdate = {};
    if (parsed.data.deliverables) update.deliverables = parsed.data.deliverables;
    if (parsed.data.section !== undefined && parsed.data.patch) {
      const now = new Date().toISOString();
      update.sections = mergeSection(current.sections, parsed.data.section, parsed.data.patch, ctx.userId, now);
      const campaign = parsed.data.patch.answers?.campaign_name;
      if (parsed.data.section === 1 && campaign !== undefined) {
        update.title = campaign.trim() || "Untitled brief";
      }
    }

    const fresh = await ctx.repo.update(id, update);
    return NextResponse.json({ updated_at: fresh.updated_at, kickoff: fresh });
  } catch (e) {
    console.error("kickoff patch failed:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const ctx = await authedRepo();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const current = await ctx.repo.get(id);
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (current.status !== "draft") return NextResponse.json({ error: "Only drafts can be deleted" }, { status: 409 });
    await ctx.repo.softDelete(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("kickoff delete failed:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/api/kickoffs/[id]/route.test.ts"` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/kickoffs/[id]/route.ts" "src/app/api/kickoffs/[id]/route.test.ts"
git commit -m "feat(kickoff): add get + autosave PATCH + soft-delete route"
```

---

### Task 11: Transition route

**Files:**
- Create: `src/app/api/kickoffs/[id]/transition/route.ts`
- Test: `src/app/api/kickoffs/[id]/transition/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockGetToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const mockGet = vi.fn();
const mockUpdate = vi.fn();
vi.mock("@/lib/project-kickoff/repository.supabase", () => ({
  makeSupabaseKickoffRepository: () => ({ get: mockGet, update: mockUpdate }),
}));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseClient: () => ({}) }));

import { POST } from "./route";
import { auth } from "@clerk/nextjs/server";

const params = { params: Promise.resolve({ id: "id1" }) };

const filledSections = (() => {
  const s: Record<string, unknown> = {};
  const fill = { answers: { client_brand: "x", campaign_name: "x", industry: "x", campaign_summary: "x", business_problem: "x", creative_idea: "x", result_business: "x", result_audience: "x", approver_internal: "x", approver_client: "x" } };
  for (const id of [1, 2, 3, 7]) s[String(id)] = { ...fill, approval: null, approval_notes: "", owner: null, section_status: "done", last_edited_by: null, last_edited_at: null };
  return s;
})();

const draft = {
  id: "id1", title: "Acme", status: "draft", locked: false,
  deliverables: { case_study: false, social: false, award: false },
  sections: filledSections, created_by: "user_a",
  submitted_by: null, submitted_at: null, approved_by: null, approved_at: null,
  created_at: "t", updated_at: "t",
};

function body(action: string): NextRequest {
  return new Request("http://x", { method: "POST", body: JSON.stringify({ action }), headers: { "Content-Type": "application/json" } }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetToken.mockResolvedValue("jwt");
  vi.mocked(auth).mockResolvedValue({ userId: "user_a", getToken: mockGetToken } as never);
  process.env.KICKOFF_APPROVER_IDS = "user_approver";
  mockGet.mockResolvedValue(draft);
  mockUpdate.mockImplementation((_id, patch) => Promise.resolve({ ...draft, ...patch }));
});

describe("POST transition", () => {
  it("submit moves draft → under_review and locks", async () => {
    const res = await POST(body("submit"), params);
    expect(res.status).toBe(200);
    const patch = mockUpdate.mock.calls[0][1];
    expect(patch.status).toBe("under_review");
    expect(patch.locked).toBe(true);
    expect(patch.submitted_by).toBe("user_a");
  });

  it("submit blocked (422) when required fields missing", async () => {
    mockGet.mockResolvedValue({ ...draft, sections: {} });
    const res = await POST(body("submit"), params);
    expect(res.status).toBe(422);
    expect((await res.json()).missing.length).toBeGreaterThan(0);
  });

  it("approve forbidden (403) for non-approver", async () => {
    mockGet.mockResolvedValue({ ...draft, status: "under_review" });
    expect((await POST(body("approve"), params)).status).toBe(403);
  });

  it("approve succeeds for approver", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_approver", getToken: mockGetToken } as never);
    mockGet.mockResolvedValue({ ...draft, status: "under_review" });
    const res = await POST(body("approve"), params);
    expect(res.status).toBe(200);
    expect(mockUpdate.mock.calls[0][1].approved_by).toBe("user_approver");
  });

  it("reopen under_review → draft for any user", async () => {
    mockGet.mockResolvedValue({ ...draft, status: "under_review", locked: true });
    const res = await POST(body("reopen"), params);
    expect(res.status).toBe(200);
    expect(mockUpdate.mock.calls[0][1].status).toBe("draft");
    expect(mockUpdate.mock.calls[0][1].locked).toBe(false);
  });

  it("400 on unknown action", async () => {
    expect((await POST(body("frobnicate"), params)).status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/api/kickoffs/[id]/transition/route.test.ts"` → Expected: FAIL — module not found.

- [ ] **Step 3: Write the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { createSupabaseClient } from "@/lib/supabase/client";
import { makeSupabaseKickoffRepository } from "@/lib/project-kickoff/repository.supabase";
import { applyTransition } from "@/lib/project-kickoff/status-machine";
import { isSubmittable, missingRequired } from "@/lib/project-kickoff/validation";
import { canApprove } from "@/lib/project-kickoff/config";
import type { KickoffUpdate } from "@/lib/project-kickoff/repository";

type Ctx = { params: Promise<{ id: string }> };
const bodySchema = z.object({ action: z.enum(["submit", "approve", "reopen"]) });

export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const token = await getToken({ template: "supabase" });
  const repo = makeSupabaseKickoffRepository(createSupabaseClient(token ?? undefined));

  try {
    const current = await repo.get(id);
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const result = applyTransition(parsed.data.action, {
      status: current.status,
      isApprover: canApprove(userId),
      requiredComplete: isSubmittable(current.deliverables, current.sections),
    });

    if (!result.ok) {
      if (result.code === "required_incomplete") {
        return NextResponse.json(
          { error: "Required fields incomplete", missing: missingRequired(current.deliverables, current.sections) },
          { status: 422 }
        );
      }
      if (result.code === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.json({ error: "Invalid transition" }, { status: 409 });
    }

    const now = new Date().toISOString();
    const patch: KickoffUpdate = { status: result.nextStatus, locked: result.locked };
    if (parsed.data.action === "submit") { patch.submitted_by = userId; patch.submitted_at = now; }
    if (parsed.data.action === "approve") { patch.approved_by = userId; patch.approved_at = now; }

    const fresh = await repo.update(id, patch);
    return NextResponse.json({ kickoff: fresh });
  } catch (e) {
    console.error("kickoff transition failed:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/api/kickoffs/[id]/transition/route.test.ts"` → Expected: PASS. Then run the whole suite: `npm test` → Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/kickoffs/[id]/transition/route.ts" "src/app/api/kickoffs/[id]/transition/route.test.ts"
git commit -m "feat(kickoff): add status-transition route"
```

---

# Phase 4 — Client data layer

### Task 12: Query + mutation hooks

**Files:**
- Create: `src/lib/project-kickoff/queries.ts`

> No unit test (thin fetch wrappers; covered by manual E2E in Phase 7, matching the repo's convention of not unit-testing client glue).

- [ ] **Step 1: Write the hooks**

```ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Kickoff, KickoffSummary, Deliverables } from "./types";
import type { TransitionAction } from "./status-machine";
import type { SectionPatch } from "./merge";

async function jsonOrThrow(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error ?? res.statusText), { status: res.status, body });
  }
  return res.json();
}

export function useKickoffList(tab: "active" | "approved") {
  return useQuery({
    queryKey: ["kickoffs", tab],
    queryFn: async (): Promise<KickoffSummary[]> =>
      (await jsonOrThrow(await fetch(`/api/kickoffs?tab=${tab}`))).kickoffs,
  });
}

export function useKickoff(id: string) {
  return useQuery({
    queryKey: ["kickoff", id],
    queryFn: async (): Promise<Kickoff> =>
      (await jsonOrThrow(await fetch(`/api/kickoffs/${id}`))).kickoff,
  });
}

export function useCreateKickoff() {
  return useMutation({
    mutationFn: async (): Promise<string> =>
      (await jsonOrThrow(await fetch("/api/kickoffs", { method: "POST" }))).id,
  });
}

export type SavePayload =
  | { section: number; patch: SectionPatch }
  | { deliverables: Deliverables };

export function useSaveKickoff(id: string) {
  return useMutation({
    mutationFn: async (payload: SavePayload): Promise<{ updated_at: string; kickoff: Kickoff }> =>
      jsonOrThrow(await fetch(`/api/kickoffs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })),
  });
}

export function useTransition(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (action: TransitionAction): Promise<Kickoff> =>
      (await jsonOrThrow(await fetch(`/api/kickoffs/${id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }))).kickoff,
    onSuccess: (k) => {
      qc.setQueryData(["kickoff", id], k);
      qc.invalidateQueries({ queryKey: ["kickoffs"] });
    },
  });
}

export function useDeleteKickoff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => jsonOrThrow(await fetch(`/api/kickoffs/${id}`, { method: "DELETE" })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kickoffs"] }),
  });
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → Expected: no errors.
```bash
git add src/lib/project-kickoff/queries.ts
git commit -m "feat(kickoff): add client query/mutation hooks"
```

---

### Task 13: Autosave hook

**Files:**
- Create: `src/components/project-kickoff/use-autosave.ts`

- [ ] **Step 1: Write the hook**

```ts
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSaveKickoff, type SavePayload } from "@/lib/project-kickoff/queries";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Debounced autosave. Each queued payload carries a FULL slice (an entire section, or
 * the deliverables object), so coalescing by replacement never drops a field. Switching
 * target (a different section, or deliverables) flushes the pending one first so it isn't
 * lost. Concurrency is last-write-wins: the PATCH route always merges onto the latest DB
 * row, so edits to different sections never clobber each other. A live "someone else
 * edited — reload" nudge is intentionally deferred (see spec §7 / non-goals); a user sees
 * others' changes on next load.
 */
export function useAutosave(id: string) {
  const save = useSaveKickoff(id);
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingKey = useRef<string | null>(null);
  const pendingPayload = useRef<SavePayload | null>(null);

  const flush = useCallback(async (payload: SavePayload) => {
    setState("saving");
    try {
      await save.mutateAsync(payload);
      setState("saved");
    } catch {
      setState("error");
    }
  }, [save]);

  const queue = useCallback((payload: SavePayload) => {
    const key = "section" in payload ? `s${payload.section}` : "deliverables";
    if (timer.current) {
      clearTimeout(timer.current);
      // target switched before the pending save fired — flush it so it isn't dropped
      if (pendingKey.current && pendingKey.current !== key && pendingPayload.current) {
        void flush(pendingPayload.current);
      }
    }
    pendingKey.current = key;
    pendingPayload.current = payload;
    timer.current = setTimeout(() => {
      timer.current = null; pendingKey.current = null; pendingPayload.current = null;
      void flush(payload);
    }, 800);
  }, [flush]);

  // Flush nothing extra on unmount; just clear the timer.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { queue, flush, state };
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → Expected: no errors.
```bash
git add src/components/project-kickoff/use-autosave.ts
git commit -m "feat(kickoff): add debounced autosave hook"
```

---

# Phase 5 — UI components

> The repo does not unit-test React components (only lib + API). These tasks ship complete component code and are verified end-to-end in Phase 7. Typecheck (`npx tsc --noEmit`) after each.

### Task 14: Save indicator

**Files:**
- Create: `src/components/project-kickoff/save-indicator.tsx`

- [ ] **Step 1: Write it**

```tsx
"use client";
import { Check, Loader2, AlertCircle } from "lucide-react";
import type { SaveState } from "./use-autosave";

export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const map = {
    saving: { icon: Loader2, text: "Saving…", cls: "text-muted-foreground", spin: true },
    saved: { icon: Check, text: "Saved", cls: "text-emerald-600", spin: false },
    error: { icon: AlertCircle, text: "Couldn’t save — retry", cls: "text-rose-600", spin: false },
  }[state];
  const Icon = map.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${map.cls}`}>
      <Icon className={`h-3.5 w-3.5 ${map.spin ? "animate-spin" : ""}`} />
      {map.text}
    </span>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → no errors.
```bash
git add src/components/project-kickoff/save-indicator.tsx
git commit -m "feat(kickoff): add save indicator"
```

---

### Task 15: Field input

**Files:**
- Create: `src/components/project-kickoff/field-input.tsx`

- [ ] **Step 1: Write it**

```tsx
"use client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { FieldDef } from "@/lib/project-kickoff/types";

interface Props {
  field: FieldDef;
  value: string;
  readOnly: boolean;
  missing?: boolean;
  onChange: (value: string) => void;
}

export function FieldInput({ field, value, readOnly, missing, onChange }: Props) {
  const id = `ck-${field.key}`;
  const ring = missing ? "ring-2 ring-rose-400" : "";
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">
        {field.label}{field.required && <span className="ml-1 text-rose-500">*</span>}
      </Label>
      {field.type === "textarea" ? (
        <Textarea id={id} value={value} disabled={readOnly} className={ring}
          onChange={(e) => onChange(e.target.value)} rows={3} />
      ) : (
        <Input id={id} value={value} disabled={readOnly} className={ring}
          onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → no errors.
```bash
git add src/components/project-kickoff/field-input.tsx
git commit -m "feat(kickoff): add field input"
```

---

### Task 16: Approval control (Yes/No/Partial + notes)

**Files:**
- Create: `src/components/project-kickoff/approval-control.tsx`

- [ ] **Step 1: Write it**

```tsx
"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApprovalValue } from "@/lib/project-kickoff/types";

const OPTIONS: { value: Exclude<ApprovalValue, null>; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "partial", label: "Partial" },
];

interface Props {
  approval: ApprovalValue;
  notes: string;
  readOnly: boolean;
  onApproval: (v: ApprovalValue) => void;
  onNotes: (v: string) => void;
}

export function ApprovalControl({ approval, notes, readOnly, onApproval, onNotes }: Props) {
  return (
    <div className="rounded-xl bg-amber-50 p-4 dark:bg-amber-950/20 space-y-3">
      <div className="space-y-1.5">
        <Label className="text-sm">Client approval required?</Label>
        <div className="flex gap-2">
          {OPTIONS.map((o) => {
            const active = approval === o.value;
            return (
              <button key={o.value} type="button" disabled={readOnly}
                onClick={() => onApproval(active ? null : o.value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-amber-500 text-white" : "bg-white text-foreground hover:bg-amber-100 dark:bg-background"
                } disabled:opacity-60`}>
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ck-approval-notes" className="text-sm">Approval contact / notes</Label>
        <Input id="ck-approval-notes" value={notes} disabled={readOnly}
          onChange={(e) => onNotes(e.target.value)} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → no errors.
```bash
git add src/components/project-kickoff/approval-control.tsx
git commit -m "feat(kickoff): add approval control"
```

---

### Task 17: Deliverable bar

**Files:**
- Create: `src/components/project-kickoff/deliverable-bar.tsx`

- [ ] **Step 1: Write it**

```tsx
"use client";
import { FileText, Share2, Award } from "lucide-react";
import type { Deliverables, DeliverableKey } from "@/lib/project-kickoff/types";

const PILLS: { key: DeliverableKey; label: string; icon: typeof FileText }[] = [
  { key: "case_study", label: "Case Study", icon: FileText },
  { key: "social", label: "Social Posts", icon: Share2 },
  { key: "award", label: "Award Submission", icon: Award },
];

interface Props {
  deliverables: Deliverables;
  readOnly: boolean;
  onToggle: (key: DeliverableKey, next: boolean) => void;
}

export function DeliverableBar({ deliverables, readOnly, onToggle }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {PILLS.map(({ key, label, icon: Icon }) => {
        const on = deliverables[key];
        return (
          <button key={key} type="button" disabled={readOnly}
            onClick={() => onToggle(key, !on)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              on ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
            } disabled:opacity-60`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → no errors.
```bash
git add src/components/project-kickoff/deliverable-bar.tsx
git commit -m "feat(kickoff): add deliverable toggle bar"
```

---

### Task 18: Status rail

**Files:**
- Create: `src/components/project-kickoff/status-rail.tsx`

- [ ] **Step 1: Write it**

```tsx
"use client";
import type { SectionDef, Sections } from "@/lib/project-kickoff/types";

const DOT: Record<string, string> = {
  done: "bg-emerald-500",
  in_progress: "bg-amber-500",
  not_started: "bg-muted-foreground/30",
};

interface Props {
  sections: SectionDef[];
  data: Sections;
  activeId: number;
  onJump: (id: number) => void;
}

export function StatusRail({ sections, data, activeId, onJump }: Props) {
  return (
    <nav className="space-y-1">
      {sections.map((s) => {
        const sd = data[String(s.id)];
        const status = sd?.section_status ?? "not_started";
        return (
          <button key={s.id} type="button" onClick={() => onJump(s.id)}
            className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              activeId === s.id ? "bg-accent" : "hover:bg-accent/50"
            }`}>
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[status]}`} />
            <span className="min-w-0">
              <span className="block truncate font-medium">§{s.id} {s.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {status.replace("_", " ")}{sd?.owner ? ` · ${sd.owner}` : ""}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → no errors.
```bash
git add src/components/project-kickoff/status-rail.tsx
git commit -m "feat(kickoff): add status rail"
```

---

### Task 19: Section card

**Files:**
- Create: `src/components/project-kickoff/section-card.tsx`

- [ ] **Step 1: Write it**

```tsx
"use client";
import { ChevronDown } from "lucide-react";
import { FieldInput } from "./field-input";
import { ApprovalControl } from "./approval-control";
import type { SectionDef, SectionData, ApprovalValue, SectionStatus } from "@/lib/project-kickoff/types";
import type { SectionPatch } from "@/lib/project-kickoff/merge";

const STATUS_OPTIONS: { value: SectionStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

interface Props {
  section: SectionDef;
  data: SectionData;
  open: boolean;
  readOnly: boolean;
  missingKeys: Set<string>;
  onToggleOpen: () => void;
  onPatch: (patch: SectionPatch) => void;
}

export function SectionCard({ section, data, open, readOnly, missingKeys, onToggleOpen, onPatch }: Props) {
  return (
    <section id={`ck-section-${section.id}`} className="overflow-hidden rounded-2xl bg-card shadow-sm">
      <button type="button" onClick={onToggleOpen}
        className="flex w-full items-center justify-between px-6 py-4 text-left">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Section {section.id} / 7
          </div>
          <h3 className="font-headline text-lg font-bold">{section.title}</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {data.last_edited_by ? `edited · ${data.last_edited_by}` : "—"}
          </span>
          <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="space-y-5 px-6 pb-6">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={data.section_status} disabled={readOnly}
              onChange={(e) => onPatch({ section_status: e.target.value as SectionStatus })}
              className="rounded-lg border bg-background px-2 py-1 text-sm disabled:opacity-60">
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input
              type="text" placeholder="Owner (e.g. Strategy)" defaultValue={data.owner ?? ""}
              disabled={readOnly}
              onBlur={(e) => onPatch({ owner: e.target.value.trim() || null })}
              className="rounded-lg border bg-background px-2 py-1 text-sm disabled:opacity-60" />
          </div>

          {section.fields.map((f) => (
            <FieldInput key={f.key} field={f} readOnly={readOnly}
              value={data.answers[f.key] ?? ""} missing={missingKeys.has(f.key)}
              onChange={(v) => onPatch({ answers: { [f.key]: v } })} />
          ))}

          <ApprovalControl
            approval={data.approval} notes={data.approval_notes} readOnly={readOnly}
            onApproval={(v: ApprovalValue) => onPatch({ approval: v })}
            onNotes={(v) => onPatch({ approval_notes: v })} />
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → no errors.
```bash
git add src/components/project-kickoff/section-card.tsx
git commit -m "feat(kickoff): add collapsible section card"
```

---

### Task 20: Kickoff editor (composition + autosave wiring)

**Files:**
- Create: `src/components/project-kickoff/kickoff-editor.tsx`

- [ ] **Step 1: Write it**

```tsx
"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeliverableBar } from "./deliverable-bar";
import { StatusRail } from "./status-rail";
import { SectionCard } from "./section-card";
import { SaveIndicator } from "./save-indicator";
import { useAutosave } from "./use-autosave";
import { useTransition } from "@/lib/project-kickoff/queries";
import { activeSections, missingRequired } from "@/lib/project-kickoff/validation";
import { mergeSection, type SectionPatch } from "@/lib/project-kickoff/merge";
import type { Kickoff, DeliverableKey, Deliverables } from "@/lib/project-kickoff/types";

const STATUS_LABEL: Record<Kickoff["status"], string> = {
  draft: "Draft", under_review: "Under review", approved: "Approved",
};

export function KickoffEditor(
  { initial, currentUserId, isApprover }:
  { initial: Kickoff; currentUserId: string; isApprover: boolean }
) {
  const router = useRouter();
  const [kickoff, setKickoff] = useState<Kickoff>(initial);
  const sections = useMemo(() => activeSections(kickoff.deliverables), [kickoff.deliverables]);
  const [openId, setOpenId] = useState<number>(sections[0]?.id ?? 1);
  const [showMissing, setShowMissing] = useState(false);
  const autosave = useAutosave(kickoff.id);
  const transition = useTransition(kickoff.id);
  const readOnly = kickoff.locked;

  const missing = useMemo(() => missingRequired(kickoff.deliverables, kickoff.sections), [kickoff]);
  const missingBySection = useMemo(() => {
    const m: Record<number, Set<string>> = {};
    if (showMissing) for (const x of missing) (m[x.section] ??= new Set()).add(x.key);
    return m;
  }, [missing, showMissing]);

  function patchSection(sectionId: number, patch: SectionPatch) {
    const now = new Date().toISOString();
    const merged = mergeSection(kickoff.sections, sectionId, patch, currentUserId, now);
    setKickoff((k) => ({ ...k, sections: mergeSection(k.sections, sectionId, patch, currentUserId, now) }));
    // Queue the FULL section slice (not just this field's delta) so debounced
    // coalescing can never drop an earlier edit to the same section.
    const full = merged[String(sectionId)];
    autosave.queue({
      section: sectionId,
      patch: {
        answers: full.answers,
        approval: full.approval,
        approval_notes: full.approval_notes,
        owner: full.owner,
        section_status: full.section_status,
      },
    });
  }

  function toggleDeliverable(key: DeliverableKey, next: boolean) {
    const deliverables: Deliverables = { ...kickoff.deliverables, [key]: next };
    setKickoff((k) => ({ ...k, deliverables }));
    autosave.queue({ deliverables });
  }

  async function doTransition(action: "submit" | "approve" | "reopen") {
    try {
      const updated = await transition.mutateAsync(action);
      setKickoff(updated);
      toast.success(
        action === "submit" ? "Submitted for review" :
        action === "approve" ? "Approved" : "Reopened for editing"
      );
    } catch (e) {
      const err = e as { status?: number };
      if (action === "submit" && err.status === 422) {
        setShowMissing(true);
        toast.error("Fill the required fields highlighted below");
        const first = missing[0];
        if (first) { setOpenId(first.section); document.getElementById(`ck-section-${first.section}`)?.scrollIntoView({ behavior: "smooth" }); }
      } else if (err.status === 403) {
        toast.error("You don’t have permission for that");
      } else {
        toast.error("Something went wrong");
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-headline text-2xl font-extrabold tracking-tight">{kickoff.title}</h1>
          <Badge variant="secondary">{STATUS_LABEL[kickoff.status]}</Badge>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={autosave.state} />
          <Button variant="ghost" onClick={() => router.push("/dashboard/strategist/project-kickoff")}>Back to list</Button>
        </div>
      </div>

      <DeliverableBar deliverables={kickoff.deliverables} readOnly={readOnly} onToggle={toggleDeliverable} />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <StatusRail sections={sections} data={kickoff.sections} activeId={openId}
            onJump={(id) => { setOpenId(id); document.getElementById(`ck-section-${id}`)?.scrollIntoView({ behavior: "smooth" }); }} />
        </aside>

        <div className="space-y-4">
          {sections.map((s) => (
            <SectionCard key={s.id} section={s} data={kickoff.sections[String(s.id)] ?? {
              answers: {}, approval: null, approval_notes: "", owner: null,
              section_status: "not_started", last_edited_by: null, last_edited_at: null,
            }}
              open={openId === s.id} readOnly={readOnly}
              missingKeys={missingBySection[s.id] ?? new Set()}
              onToggleOpen={() => setOpenId(openId === s.id ? -1 : s.id)}
              onPatch={(p) => patchSection(s.id, p)} />
          ))}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {kickoff.status === "draft" && (
              <Button onClick={() => doTransition("submit")} disabled={transition.isPending}>Submit for review</Button>
            )}
            {kickoff.status === "under_review" && (
              <Button variant="outline" onClick={() => doTransition("reopen")} disabled={transition.isPending}>Reopen / unlock</Button>
            )}
            {kickoff.status === "under_review" && isApprover && (
              <Button onClick={() => doTransition("approve")} disabled={transition.isPending}>Approve</Button>
            )}
            {kickoff.status === "approved" && isApprover && (
              <Button variant="outline" onClick={() => doTransition("reopen")} disabled={transition.isPending}>Reopen</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → no errors.
```bash
git add src/components/project-kickoff/kickoff-editor.tsx
git commit -m "feat(kickoff): add editor composition + autosave wiring"
```

---

### Task 21: Kickoff list

**Files:**
- Create: `src/components/project-kickoff/kickoff-list.tsx`

- [ ] **Step 1: Write it**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useKickoffList, useCreateKickoff } from "@/lib/project-kickoff/queries";
import type { Deliverables, KickoffStatus } from "@/lib/project-kickoff/types";

const STATUS_LABEL: Record<KickoffStatus, string> = {
  draft: "Draft", under_review: "Under review", approved: "Approved",
};
const DLABEL: Record<keyof Deliverables, string> = { case_study: "CS", social: "Social", award: "Award" };

function deliverableChips(d: Deliverables) {
  return (Object.keys(d) as (keyof Deliverables)[]).filter((k) => d[k]).map((k) => DLABEL[k]).join(" · ") || "—";
}

export function KickoffList() {
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "approved">("active");
  const { data, isLoading } = useKickoffList(tab);
  const create = useCreateKickoff();

  async function newBrief() {
    const id = await create.mutateAsync();
    router.push(`/dashboard/strategist/project-kickoff/${id}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight">Creative Kickoff Brief</h1>
          <p className="mt-1.5 text-muted-foreground">Capture, hand off, and approve project kickoff briefs.</p>
        </div>
        <Button onClick={newBrief} disabled={create.isPending}><Plus className="h-4 w-4" /> New brief</Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "approved")}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
      ) : !data?.length ? (
        <div className="rounded-2xl bg-card p-10 text-center text-muted-foreground">
          {tab === "active" ? "No active briefs yet. Create one to get started." : "No approved briefs yet."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
          {data.map((k) => (
            <button key={k.id} onClick={() => router.push(`/dashboard/strategist/project-kickoff/${k.id}`)}
              className="flex w-full items-center gap-4 border-b px-6 py-4 text-left last:border-0 hover:bg-accent/50">
              <span className="flex-1 truncate font-medium">{k.title}</span>
              <Badge variant="secondary">{STATUS_LABEL[k.status]}</Badge>
              <span className="hidden w-28 truncate text-sm text-muted-foreground sm:block">{deliverableChips(k.deliverables)}</span>
              <span className="w-12 text-right text-sm text-muted-foreground">{k.progress.done}/{k.progress.total}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → no errors.
```bash
git add src/components/project-kickoff/kickoff-list.tsx
git commit -m "feat(kickoff): add projects list with Active/Approved tabs"
```

---

# Phase 6 — Routes + registration

### Task 22: List + editor pages

**Files:**
- Create: `src/app/dashboard/strategist/project-kickoff/page.tsx`
- Create: `src/app/dashboard/strategist/project-kickoff/[id]/page.tsx`

- [ ] **Step 1: Write the list page**

```tsx
import { KickoffList } from "@/components/project-kickoff/kickoff-list";
export default function Page() { return <KickoffList />; }
```

- [ ] **Step 2: Write the editor page** (server component fetches the user id + initial row, then hands to the client editor)

```tsx
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase/client";
import { makeSupabaseKickoffRepository } from "@/lib/project-kickoff/repository.supabase";
import { canApprove } from "@/lib/project-kickoff/config";
import { KickoffEditor } from "@/components/project-kickoff/kickoff-editor";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/");
  const { id } = await params;
  const token = await getToken({ template: "supabase" });
  const repo = makeSupabaseKickoffRepository(createSupabaseClient(token ?? undefined));
  const kickoff = await repo.get(id);
  if (!kickoff) notFound();
  // isApprover is computed on the server — KICKOFF_APPROVER_IDS is not a NEXT_PUBLIC var,
  // so the client cannot read it. Server passes the boolean down for UI gating; the
  // transition route re-checks it server-side as the source of truth.
  return <KickoffEditor initial={kickoff} currentUserId={userId} isApprover={canApprove(userId)} />;
}
```

- [ ] **Step 3: Verify routing compiles**

Run: `npx tsc --noEmit` → no errors. Then `npm run build` → Expected: build succeeds, the two new routes appear in the route list.

- [ ] **Step 4: Commit**

```bash
git add "src/app/dashboard/strategist/project-kickoff"
git commit -m "feat(kickoff): add list + editor pages"
```

---

### Task 23: Register the tool (Strategist + dashboard)

**Files:**
- Modify: `src/app/dashboard/strategist/page.tsx`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Add the Strategist tool card**

In `src/app/dashboard/strategist/page.tsx`, add `ClipboardList` to the `lucide-react` import, and append to the `tools` array:

```ts
  {
    href: "/dashboard/strategist/project-kickoff",
    label: "Creative Kickoff Brief",
    description: "Capture, hand off, and approve project kickoff briefs with autosave",
    icon: ClipboardList,
  },
```

- [ ] **Step 2: Add to dashboard search + featured workflows**

In `src/app/dashboard/page.tsx`, add `ClipboardList` to the `lucide-react` import. Append to `allTools`:

```ts
  { href: "/dashboard/strategist/project-kickoff", label: "Creative Kickoff Brief", description: "Capture, hand off, and approve project kickoff briefs", icon: ClipboardList, section: "Strategist", sectionColor: "text-orange-500", iconBg: "bg-orange-500/12", iconText: "text-orange-600" },
```

Append to `featuredWorkflows`:

```ts
  {
    href: "/dashboard/strategist/project-kickoff",
    label: "Creative Kickoff Brief",
    description: "Fill a multi-section kickoff brief together — hand sections off across departments, then route it through review and approval.",
    icon: ClipboardList,
    iconBg: "bg-orange-500/12",
    iconText: "text-orange-600",
    headerGradient: "from-orange-500/20 via-orange-500/8 to-transparent",
    chipBg: "bg-orange-500/10",
    chipText: "text-orange-700",
    btnGradient: "from-orange-600 to-orange-400",
    steps: ["Draft + hand off", "Submit for review", "Approve"],
  },
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint` → Expected: no errors. (`npm run lint` catches `react/no-unescaped-entities` — the descriptions above use a plain apostrophe-free wording, so they pass.)

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/strategist/page.tsx src/app/dashboard/page.tsx
git commit -m "feat(kickoff): register tool in Strategist + dashboard featured"
```

---

# Phase 7 — Verification

### Task 24: Full suite + manual E2E

- [ ] **Step 1: Run the whole test suite**

Run: `npm test` → Expected: all tests pass (core + adapter + 3 API routes).

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build` → Expected: clean.

- [ ] **Step 3: Manual end-to-end** (`npm run dev`, sign in)

Verify each, in order:
- [ ] Dashboard shows the **Creative Kickoff Brief** featured card; Strategist page shows the tool card; Cmd+K search finds it.
- [ ] Tool landing lists briefs with **Active**/**Approved** tabs; **New brief** creates one and navigates to the editor.
- [ ] Typing in a §1 field shows **Saving… → Saved**; reload the page — the text persists (autosave + DB).
- [ ] Editing the **Campaign / project name** updates the brief's title in the list.
- [ ] Toggling **Case Study / Social / Award** reveals/hides §4/§5/§6 (and the rail updates).
- [ ] Setting a section's status to **Done** / assigning an owner shows in the status rail.
- [ ] **Submit for review** with required fields empty → blocked, missing fields highlighted, section expands + scrolls.
- [ ] Fill all required fields → **Submit for review** → status becomes **Under review**, the form is **read-only**.
- [ ] As a non-approver, **Approve** is not shown; **Reopen / unlock** returns it to editable Draft.
- [ ] Set your Clerk id in `KICKOFF_APPROVER_IDS`, restart dev, **Approve** an under-review brief → it moves to the **Approved** tab and is read-only.
- [ ] Open in a second browser/profile, edit a different section → first window's reload shows the other user's changes (multi-user handoff).

- [ ] **Step 4: Final commit (if any manual-fix tweaks were needed)**

```bash
git add -A && git commit -m "test(kickoff): verification pass fixes"
```

---

## Done

All spec requirements implemented: portable core behind a repository seam, hybrid JSONB persistence with brands-style RLS, soft per-section ownership, draft→under_review→approved workflow with config-driven approver + locking, debounced autosave, and the Active/Approved list. Merge the `creative-kickoff-brief` branch when verification passes (use `superpowers:finishing-a-development-branch`).
