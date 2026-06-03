# Creative Kickoff Brief — GlueSkills Tool Design

**Date:** 2026-06-02
**Status:** Design approved, pending implementation plan
**Section:** Strategist (also surfaced as a Featured tool on the dashboard)

---

## 1. Overview

Re-platform the existing **Creative Kickoff Brief** — today a Webflow form at
`glueiq.com/creative-kickoff` that pipes submissions to Airtable (via Zapier) + email — into a
native GlueSkills tool backed by Supabase.

The re-platforming preserves the form content 1:1 and adds the behaviors the Webflow version
can't do:

- **Autosave drafts** — state persists continuously, not just at submit.
- **Multi-user section handoff** — different departments fill different sections; the form shows
  who owns each section and whether it's done ("pick up at certain steps").
- **In-app status workflow** — Draft → Under review → Approved, with locking and a designated
  approver.
- **Projects list** — all kickoffs with status; approved ones move to an Approved/Archive tab.

### Portability constraint (important)

This tool is **likely to be migrated to another platform** with a similar-but-different
architecture. The design therefore isolates a **portable core** (plain TS + JSON: form schema,
validation, status rules, autosave-merge) from thin platform adapters (Supabase, Next.js, React).
Migrating means rewriting the adapters; the core ports unchanged. The data shape is JSONB — i.e.
plain JSON — which is portable to any backend.

---

## 2. Goals / Non-goals

**Goals**
- Faithful port of the 7-section Creative Kickoff Brief (all fields, deliverable toggles, per-section
  approval radios).
- Continuous autosave; nothing lost on navigation.
- Visible per-section ownership + status to coordinate the department handoff (soft, not enforced).
- Draft → Under review → Approved lifecycle with locking and an approver gate.
- Projects list with Active and Approved/Archive views.
- Code structured for a future platform migration.

**Non-goals (v1 — YAGNI)**
- Real-time co-editing (live cursors / live sync). Autosave + last-write-wins + a soft reload nudge
  is enough; Realtime can be added later behind the same repository seam.
- A roles/permissions system. The only privileged role is the approver, handled via config.
- Hard section locking / per-section edit permissions. Editing is open (collaborative); ownership is
  advisory.
- Re-implementing the Airtable/Zapier pipe. (Optional later: an export from this tool to the existing
  Airtable base for reporting.)

---

## 3. Architecture & portability

Three layers. **Hard rule: the core never imports Next.js or Supabase.**

```
src/lib/project-kickoff/                  ← PORTABLE CORE (pure TS + JSON, no framework)
  form-schema.ts     – the 7 sections + every field, as DATA (single source of truth)
  types.ts           – Kickoff, Section, Status, Deliverables domain types
  validation.ts      – required-field + submit-gate logic (pure functions)
  status-machine.ts  – allowed transitions + who-can-do-each (pure)
  merge.ts           – autosave section-merge (pure)
  config.ts          – approver allowlist (config-driven)

  repository.ts            ← PORT: a KickoffRepository interface (the persistence seam)
  repository.supabase.ts   ← ADAPTER: the Supabase implementation of that interface

src/app/api/kickoffs/**            ← Next.js adapter — thin HTTP shell over core + repo
src/app/dashboard/strategist/project-kickoff/**   ← UI (React) — routes
src/components/project-kickoff/**                  ← UI components (accordion, status rail, list)
supabase/migrations/006_project_kickoffs.sql       ← schema
```

> Note: internal folder/route slug is `project-kickoff` (stable identifier); the user-facing tool
> name is **Creative Kickoff Brief**.

**Why:** the valuable logic (form definition, validation, status rules, merge) is pure functions over
plain data and ports verbatim. All DB access goes through the single `KickoffRepository` interface; to
move platforms you write one new adapter and re-skin the API/UI shell. No Supabase calls in
components — UI → API routes → repository interface.

---

## 4. Data model

Migration `006_project_kickoffs.sql`, following `brands` / `spec_sheets` conventions (RLS on,
reusing the `set_updated_at()` trigger from migration 005).

```sql
create table project_kickoffs (
  id            uuid primary key default gen_random_uuid(),
  title         text not null default 'Untitled brief',  -- mirrors campaign_name; see note below
  status        text not null default 'draft', -- draft | under_review | approved
  locked        boolean not null default false,
  deliverables  jsonb not null default '{"case_study":false,"social":false,"award":false}',
  sections      jsonb not null default '{}',   -- per-section answers + approval + meta (below)
  created_by    text not null,                 -- Clerk user id
  submitted_by  text, submitted_at timestamptz,
  approved_by   text, approved_at  timestamptz,
  deleted_at    timestamptz,                   -- soft delete (drafts)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()  -- trigger-maintained
);
create index idx_project_kickoffs_status     on project_kickoffs(status);
create index idx_project_kickoffs_deleted_at on project_kickoffs(deleted_at);
```

**`sections` JSONB shape** (keys `"1"`–`"7"`):

```jsonc
"3": {
  "answers": { "business_result": "...", "audience_result": "...", "...": "..." },
  "approval": "partial",            // the form's Yes/No/Partial radio (optional)
  "approval_notes": "...",
  "owner": "user_2ab...",           // assigned department/person (advisory)
  "section_status": "in_progress",  // not_started | in_progress | done
  "last_edited_by": "user_2ab...",
  "last_edited_at": "2026-06-02T18:20:00Z"
}
```

**Title handling** — `POST` creates a draft titled `"Untitled brief"`. On autosave, whenever the §1
`campaign_name` answer changes, PATCH mirrors it into the top-level `title` column (used purely for the
list view's display/sort). The answer in `sections` remains the source of truth; `title` is a
denormalized convenience copy.

**RLS posture** — brands-style: **any authenticated Clerk user can read/insert/update/delete**. The
handoff model needs cross-user access (dept B edits a draft dept A started), so owner-only RLS won't
work. RLS stays coarse (= "authenticated"); the fine rules (who can approve, lock gating, soft-delete
draft-only) live in the **core status-machine**, not in SQL — so they survive the migration.

---

## 5. Form-as-data (single source of truth)

`form-schema.ts` is one typed array that drives rendering, validation, and the JSONB shape. Adding or
renaming a field is a one-line data edit.

```ts
export const KICKOFF_FORM: Section[] = [
  { id: 1, title: "Campaign Overview", always: true, fields: [
      { key: "client_brand",     label: "Client / brand name",     type: "text",     required: true },
      { key: "campaign_name",    label: "Campaign / project name",  type: "text",     required: true },
      // ...
    ] },
  { id: 4, title: "Case Study Specifics", deliverable: "case_study", fields: [ /* ... */ ] },
  // §1–§3, §7 always; §4/§5/§6 gated by deliverable
];
```

The required-field rules and the deliverable→section mapping both read from this array — no duplicated
truth. The exact field inventory is in §12.

---

## 6. Status workflow & permissions

Portable `status-machine.ts` + `config.ts`.

```
  create → DRAFT ⇄ UNDER_REVIEW → APPROVED
             ▲   submit    │  approve     │
             │   reopen ───┘   reopen ────┘ (approver only)
```

| Action | From → To | Who | Gate / effect |
|---|---|---|---|
| Create | — → **draft** | any user | sets `created_by` |
| Edit (answers, owner, section status, deliverables) | draft | any user | autosaves |
| **Submit for review** | draft → **under_review** | any user | required fields in *active* sections complete; sets `locked=true`, `submitted_by/at` |
| **Approve** | under_review → **approved** | **approver only** | sets `approved_by/at`; stays read-only; moves to Approved tab |
| **Reopen / unlock** | under_review → **draft** | any user | clears `locked` → editable again |
| **Reopen approved** | approved → **draft** | **approver only** | un-archives; clears `locked` |
| Delete (soft) | draft only | any user | `deleted_at` set; hidden from lists |

**Lock semantics** — `locked` is the single source of editability: `true` in `under_review` and
`approved` (form renders read-only), `false` in `draft`. "Unlock" returns it to `draft`.

**Validation gate (submit)** — `validation.ts` requires every `required: true` field in the **active**
sections (always-on §1–§3, §7 + any deliverable-checked §4/§5/§6). Per-section Yes/No/Partial approval
radios stay optional, matching the live form. On failure, submit is blocked, the offending sections
expand, and the empty fields are flagged (mirrors the Webflow `creativekickoffvalidate` behavior).

**Approver config** — `config.ts` reads `KICKOFF_APPROVER_IDS` (comma-separated env var of Clerk user
IDs) into a `string[]`; `canApprove(userId)` checks membership. One ID now, changeable without a code
edit, shaped as a list so it grows without a refactor. This rule lives in the core, not RLS.

**Enforcement** — two places: the API route rejects unauthorized transitions (server-side truth) and
the UI hides/disables actions the user can't take (e.g. Approve shows only for the approver).

---

## 7. Autosave & concurrency

`merge.ts` (core) + TanStack Query (already used in the app).

- Debounced **section-level PATCH** (~800ms after last keystroke, and on blur). Each save merges just
  that section's slice — small payloads; two people in different sections never collide.
- **Last-write-wins**, optimistic UI. Header **save indicator**: `Saving… / Saved ✓ / Couldn't save —
  retry`. On failure the input stays in form state and retries; nothing is lost.
- Per-section **"edited by X · 2m ago."**
- **Soft conflict nudge** (no Realtime): the client remembers the `updated_at` it loaded; if a save
  returns a newer server `updated_at` from someone else, show a "updated since you opened it — reload"
  banner. Live co-editing can be added later behind the repository seam.

---

## 8. UI surfaces

**1. List view** — `/dashboard/strategist/project-kickoff`
```
┌─ Creative Kickoff Brief ─────────────────────── [+ New brief] ┐
│  [ Active ]  Approved                                          │
├───────────────────────────────────────────────────────────────┤
│  Campaign            Status        Deliverables  Progress  Edited│
│  Acme Spring Launch  ● Under review  CS · Award   7/7      2m · Gui│
│  Nimbus Rebrand      ○ Draft         CS           3/5      1h · Ana│
└───────────────────────────────────────────────────────────────┘
```
Tabs: **Active** (draft + under_review) and **Approved** (archive). Progress = sections done / active
sections.

**2. Editor** — `/dashboard/strategist/project-kickoff/[id]` — accordion + status rail (deliverable
toggles up top, save indicator, status-aware actions). Renders read-only when `locked`.
```
┌──────────────────────────────────────────── Saved ✓ ──────┐
│  Acme Spring Launch                       [● Under review]  │
│  Deliverables: [✓ Case Study] [ Social] [✓ Award]          │
├───────────────┬────────────────────────────────────────────┤
│ ● §1 Overview │  ▼ §1 Campaign Overview          Gui · Done │
│   Done · Gui  │     Client / brand name [________________]  │
│ ◐ §2 The Work │     ...                                     │
│ ○ §3 Results  │  ▷ §2 The Work                  Ana · In prog│
│ ✓ §4 Case St. │                  [Reopen / unlock] [Approve]│
└───────────────┴────────────────────────────────────────────┘
```
The rail lets an owner jump straight to their section (the handoff entry point).

**3. Featured dashboard card** — a card in the dashboard Featured Workflows section linking into the
tool, with a small "N under review" count.

---

## 9. API surface

Thin Next.js route handlers over the repository, mirroring the `brands` pattern (Clerk `auth()` → Zod
validate → repo → structured JSON).

| Route | Purpose |
|---|---|
| `GET /api/kickoffs?tab=active\|approved` | list summaries |
| `POST /api/kickoffs` | create a draft → returns `id` |
| `GET /api/kickoffs/[id]` | fetch full record |
| `PATCH /api/kickoffs/[id]` | autosave — merge a section slice / deliverables / title |
| `POST /api/kickoffs/[id]/transition` | `{ action: "submit" \| "approve" \| "reopen" }` — the one place transitions happen |
| `DELETE /api/kickoffs/[id]` | soft-delete (draft only) |

All transitions behind one endpoint ⇒ the status-machine is enforced in exactly one spot.

---

## 10. Error handling

- `401` not signed in · `403` forbidden transition or editing a locked row (non-unlock) · `404`
  missing/soft-deleted.
- `400` malformed payload (Zod issues returned).
- `422` on **submit** when required fields missing — body carries `[{section, field}]` so the UI
  expands those sections and flags them.
- **Conflicts**: no hard `409` — PATCH returns the fresh `updated_at`; client detects drift → soft
  "reload?" nudge. Last-write-wins by design.
- `500` on DB errors — logged server-side (`console.error`), generic client message (brands posture).

---

## 11. Testing strategy

vitest, TDD, following `route.test.ts` / lib-test precedent. The **core tests survive the migration**.

- **Core (pure, highest value):** `validation` (required gate across active + deliverable sections) ·
  `status-machine` (every allowed/forbidden transition, approver gating, lock) · `merge` (slice merge
  preserves siblings, stamps `last_edited`) · `form-schema` (unique keys, deliverable→section map).
- **Repository adapter:** CRUD + soft-delete against Supabase (or a fake).
- **API routes:** 401 / 403 / 400 / 422 / happy-path per endpoint.

---

## 12. Field inventory (ported 1:1 from the live form)

Each section also ends with: **Client approval required?** (radio: Yes/No/Partial, optional) +
**Approval contact / notes** (text, optional). `*` = required (blocks submit).

**§1 Campaign Overview** *(always)*
- Client / brand name * (text)
- Campaign / project name * (text)
- Industry / category * (text)
- In one sentence, what did this campaign do? * (textarea)
- What was the business problem or opportunity? * (textarea)

**§2 The Work** *(always)*
- What was the creative idea / big concept? * (textarea)
- What channels / formats did the campaign run across? (textarea)
- What made this work different or unexpected? (textarea)
- Are there any craft / production details worth highlighting? (textarea)

**§3 Results & Proof** *(always)*
- Business result * (textarea)
- Audience / engagement result * (textarea)
- Brand / perception result (textarea)
- Any other noteworthy numbers, earned media, or cultural signals? (textarea)
- What are the result-sharing restrictions, if any? (textarea)

**§4 Case Study Specifics** *(deliverable: case_study)*
- What's the narrative arc? (textarea)
- Who is the case study written for? (textarea)
- What quotes or client testimonials are available? (textarea)
- What visual assets are available for the case study? (textarea)

**§5 Social Post Specifics** *(deliverable: social)*
- Which platforms are we posting on? * (textarea)
- Whose account(s)? * (textarea)
- What's the tone / voice for social? (textarea)
- What do we want people to feel or do after seeing the post? (textarea)
- Are there any credits, tags, or handles to include? (textarea)
- Any post timing, campaign tie-ins, or industry events to align with? (textarea)

**§6 Award Submission Specifics** *(deliverable: award)*
- Which award show(s) are we entering? * (textarea)
- Which category / categories? (textarea)
- What level of ambition are we setting? (textarea)
- What is the single most award-worthy thing about this work? (textarea)
- Are there competitive or industry benchmarks to reference? (textarea)
- What is the entry word / character limit? (textarea)

**§7 Approvals & Assets** *(always)*
- Who is the internal approver? * (text)
- Does the client need to approve? * (text)
- Where are the final assets housed? (textarea)
- Are there any legal, IP, talent, or music clearances to be aware of? (textarea)
- Is there anything that must NOT be included in any of the deliverables? (textarea)

> Note on the §1–§7 trailing "Client approval required?" radios: these are **form content** (does the
> client need to approve this section's work), distinct from the **project status** (draft / under
> review / approved) which is the workflow state. Keep them separate.

---

## 13. Source references

- Webflow form + Airtable/Zapier pipe (the thing being re-platformed):
  `glue-work/misc/creative-kickoff-form/CONTEXT.md` (in the `gui.claude` repo) — has all field names,
  the Airtable schema (base `appWAOQchRTSS2awK`, table `tblT374JVvag3dIJ0`, 52 cols + 5 operational),
  and the Zapier label map.
- Existing GlueSkills data-table precedents: `supabase/migrations/004_spec_sheets.sql`,
  `005_brands.sql`; API pattern: `src/app/api/brands/route.ts`.

---

## 14. Future / optional (not in v1)

- Real-time co-editing (Supabase Realtime) behind the existing repository seam.
- Export approved briefs to the existing Airtable base for reporting (closes the loop with the current
  workflow).
- Field-level reporting/search via JSONB queries.
- Per-section hard locking if the team wants enforced ownership.
