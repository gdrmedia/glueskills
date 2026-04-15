# Banner Resizer — Design Spec

**Status:** Approved for implementation
**Date:** 2026-04-15
**Branch:** `banner-resize`
**Owner:** guillermo.rozenblat@glueiq.com

## 1. Problem & Goal

Designers building HTML5 display campaigns hand-design four banners covering the major aspect ratio buckets (square-ish, leaderboard, skyscraper, billboard), then spend hours producing the long-tail size variations the campaign requires. Most of that work is mechanical: clone, resize, nudge elements back into place, repeat for ten more sizes.

**Goal:** Cut that long-tail work from hours to minutes by generating the variations automatically inside the same Figma file the designer is already working in. Set honest expectations — the tool produces a reviewable starting point, not a finished deliverable.

**Non-goals:**
- Replacing designer judgment on the four hand-crafted source designs
- Generating finished, ship-ready banners with no human review
- Working on files outside Figma (no Sketch, no XD, no PSD)
- Animating banners or producing HTML/JS export

## 2. Architectural Decisions

The biggest constraint shaping this spec: **Figma's REST API and the official Dev Mode MCP are read-only**. The `.fig` file format is proprietary and not parseable. The only way to programmatically create or modify frames in a Figma file is a Figma Plugin running inside the Figma app itself.

Decisions locked in during brainstorming:

| # | Decision | Rationale |
|---|---|---|
| 1 | **Hybrid: web app + Figma plugin** | Web hosts the configuration UX (where the GlueSkills brand experience lives); plugin executes inside Figma where the work has to happen. |
| 2 | **Hybrid auto-mapping with override** | Plugin auto-matches each target size to the nearest-aspect-ratio source frame. Surfaces the mapping in the plugin UI so designers can override before generating. Builds trust + saves clicks. |
| 3 | **Constraint passthrough + lightweight role detection (no AI in v1)** | Layered algorithm: native Figma constraint resize first, then heuristic role-based micro-adjustments. AI polish is reserved for v2 to keep v1 scope sane. |
| 4 | **IAB Standard preset catalog + custom size input** | 14 IAB sizes cover the 80% case; custom escape hatch handles oddball publisher requirements. |
| 5 | **Web does sizes, plugin does mapping (6-char code handoff)** | Avoids Figma OAuth (saves weeks). Web wizard stays focused on universal config; plugin handles file-specific mapping. Code is the bearer token. |
| 6 | **Selection-first source detection with scan fallback** | If user has frames selected when plugin opens, use those; otherwise scan the current page and let user tick. Matches good Figma plugin idioms. |
| 7 | **New page in Figma file as default placement** | Each run lands on a dedicated page (`Generated – [Job name]`), keeping the source page clean. Override toggle for designers who want everything inline. |

## 3. High-Level Architecture

Three pieces, talking through Supabase:

```
┌──────────────────────┐         ┌──────────────────────┐
│  GlueSkills Web App  │         │  Figma Plugin        │
│  (Next.js 16)        │         │  (TypeScript)        │
│                      │         │                      │
│  • Size picker       │         │  • Code entry        │
│  • Job naming        │         │  • Frame scan        │
│  • Options toggles   │         │  • Auto + override   │
│  • Generate code     │         │    mapping UI        │
│  • Show code         │         │  • Run job           │
└──────────┬───────────┘         └──────────┬───────────┘
           │                                │
           │   POST /api/banner-jobs        │   GET via Supabase
           │                                │   anon key + RLS
           └────────► Supabase ◄────────────┘
                  ┌──────────────────┐
                  │ banner_jobs      │
                  │  • code (PK)     │
                  │  • config JSONB  │
                  │  • user_id       │
                  │  • created_at    │
                  │  • consumed_at   │
                  │  • expires_at    │
                  └──────────────────┘
```

**Web tool location:** `/dashboard/designer/banner-resizer` — adds a 9th tile to the Designer category in the existing dashboard shell.

**Plugin distribution:** Figma Community public plugin, free, submitted under the GlueSkills Figma org.

> **Shipping note:** Figma Community review takes ~1–3 weeks for first-time submissions. Ship the web wizard separately and submit the plugin in parallel so they're not blocking each other. During plugin review, install it as a development plugin in the GlueSkills team workspace for internal testing.

**Job code format:** 6 alphanumeric chars (excluding ambiguous `0`, `O`, `I`, `1`), case-insensitive lookup, single-use (consumed when the plugin successfully fetches), 24-hour TTL, with a 5-minute idempotency window for plugin retries.

**Auth model:**
- **Web side:** existing Clerk auth — codes are tied to the signed-in user via `user_id`.
- **Plugin side:** no auth. The 6-char code IS the bearer token. Acceptable because the config payload contains no sensitive data — just a list of sizes and naming preferences.

## 4. User Flow

### 4.1 Web Wizard

Single-page form (not a multi-step modal):

1. **Job name** — required text, 1–80 chars. Used as the new Figma page name (`Generated – [Job name]`) and shown in the plugin so the designer knows which job they're running. Example: `Q2 Spring Campaign — Coral CTA`.

2. **Target sizes** — IAB Standard preset list as checkboxes, organized into collapsible groups:
   - **Desktop:** 300×250, 336×280, 728×90, 970×90, 970×250, 300×600, 160×600, 120×600
   - **Mobile:** 320×50, 320×100, 300×50, 468×60
   - **Square:** 250×250, 200×200

   Below the presets: an inline `Width × Height [Add]` form for custom sizes. Custom sizes appear as removable chips. Custom dimensions validated against the limits in §8 (50–4000 px each side).

   A live counter (`X of 20 sizes selected`) appears below the form. Adding the 21st checkbox or custom size disables further additions and shows a helper line: "Maximum 20 sizes per job."

3. **Generation options:**
   - **Place on new page** — toggle, default ON. When OFF, generated frames append to the current page in a horizontal row below the bottommost existing frame, with 80px gap between frames and 120px gap above the row.
   - **Frame naming pattern** — dropdown:
     - `728x90`
     - `728x90 — [Job name]` *(default)*
     - `728x90 — [Source frame name]`
   - **AI polish** — *reserved for v2*, locked/grayed-out with a "Coming soon" badge.

4. **Generate** — POSTs to `/api/banner-jobs`, redirects to a confirmation screen showing:
   - The 6-char code in large monospaced text
   - Copy-to-clipboard button
   - QR code (small, secondary — convenience for cross-device users)
   - Inline 3-step instructions: open file → run plugin → paste code
   - 24-hour countdown to expiry
   - Plugin install link (Figma Community URL once published; dev install instructions during plugin review)

### 4.2 Plugin Flow

Single-panel UI, no multi-step modal:

1. Plugin opens → code input field.
2. Designer pastes the 6-char code, hits Enter.
3. Plugin fetches the job config from Supabase (and marks it consumed). Panel header now shows the job name.
4. **Source frame picker:**
   - If the user had frames selected when opening the plugin → those are the source list.
   - Otherwise → scrollable list of all top-level frames on the current page with checkboxes.
5. **Mapping preview** — once sources are chosen, plugin auto-maps each target size to its closest-aspect-ratio source. List view:
   ```
   300x250 ◄── Hero v3 (300x250)        [change ▾]
   336x280 ◄── Hero v3 (300x250)        [change ▾]
   728x90  ◄── Leaderboard v3 (728x90)  [change ▾]
   160x600 ◄── Skyscraper v3 (160x600)  [change ▾]
   ...
   ```
   Each `[change ▾]` opens a dropdown of all selected source frames.
6. **Generate** button → algorithm runs, progress bar updates (`Generating 14 frames... 7/14`), then a success toast linking to the new page.

Both UIs use the existing Digital Atelier design system established in the `banner-resize` parent commits.

## 5. Data Model

One new Supabase table:

```sql
create table banner_jobs (
  code           text primary key,
  user_id        text not null,
  name           text not null,
  config         jsonb not null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default (now() + interval '24 hours'),
  consumed_at    timestamptz
);

create index banner_jobs_user_id_idx on banner_jobs(user_id);
create index banner_jobs_expires_at_idx on banner_jobs(expires_at);
```

**Config JSONB shape:**
```ts
type BannerJobConfig = {
  version: 1;
  targets: Array<{
    width: number;
    height: number;
    label?: string;       // "Medium Rectangle" — for IAB presets
    isCustom: boolean;
  }>;
  options: {
    placeOnNewPage: boolean;
    namingPattern: "size" | "size-job" | "size-source";
  };
};
```

**Consumption semantics:**
- Plugin GET sets `consumed_at = now()` atomically.
- A consumed code can be re-fetched by the same plugin instance within **5 minutes** (idempotency for retries) — checked by comparing `consumed_at` to `now() - interval '5 minutes'` rather than `is null`.
- After 5 min OR if a different request hits a consumed code, plugin shows: "This code has already been used."

**RLS policies:**
- `select`: anyone can read by code (the code IS the auth — no `auth.uid()` check needed).
- `insert`: only the signed-in Clerk user (`auth.uid() = user_id`).
- `update`/`delete`: only the owning user.

**Cleanup:** A Vercel cron at `/api/banner-jobs/cleanup` runs hourly and deletes rows where `expires_at < now()` OR `consumed_at < now() - interval '7 days'` (keeping consumed rows for ~a week gives breathing room for usage analytics if we add them later).

**Why JSONB instead of normalized tables:** Configs are write-once, read-once, and small (~1 KB). Normalizing into `banner_job_targets` adds joins for zero benefit. JSONB also lets us evolve the schema (`version: 1`) without migrations.

## 6. Resize Algorithm

The technical heart of the feature. Runs entirely inside the plugin against Figma's scene graph API. For each `(source frame, target size)` pair, the algorithm runs in three layered passes.

### Pass 1 — Clone & resize the container

1. `clone = sourceFrame.clone()`
2. `clone.resize(targetWidth, targetHeight)` — Figma natively respects existing constraints (top/bottom/left/right/center anchors, "scale" mode) during resize. This gets us a baseline that's better than nothing for any frame using constraints.
3. Position the clone in the destination (new page or below sources).

### Pass 2 — Lightweight role detection & micro-adjust

Walk the clone's children. For each node, classify by name + type + position using these rules (in priority order):

| Role | Detection | Adjustment |
|---|---|---|
| **Logo** | name matches `/logo\|brand\|wordmark/i` OR is an SVG/component imported from a "Logo" library | Preserve aspect ratio. Pin to top-left or top-right based on source position quadrant. Cap at 25% of new frame's shortest dimension. |
| **CTA button** | name matches `/cta\|button\|btn/i` OR is a frame with auto-layout containing a single text node with `<5 words` | Preserve aspect, keep visible (force into bounds), pin to bottom-right or bottom-center. |
| **Background** | name matches `/bg\|background/i` OR is the largest fill-only rectangle behind everything | Stretch to fill new frame edge-to-edge. |
| **Headline** | text node, font size ≥ 24px in source, OR name matches `/headline\|title\|h1/i` | Re-fit text — shrink font size proportionally to new frame area (`sqrt(newArea/sourceArea)`), then iteratively shrink 1pt at a time until `node.height` fits available space. |
| **Body / supporting text** | text node, font size < 24px | Same shrink-to-fit logic. If still overflows after shrinking 30% from original, **hide the node** rather than show truncated text. |
| **Image** | image fill or imported image | Preserve aspect ratio. Position based on source quadrant (which third of source did its center occupy → which third of target). |
| **Other** | anything else | Leave Figma's constraint-based resize alone. |

### Pass 3 — Validate & flag

After all adjustments, walk the clone once more and check for problems:
- Any node positioned outside the frame bounds? Flag it.
- Any text node still overflowing its container? Flag it.
- Any node smaller than 4×4 px? Flag it.
- All non-background nodes hidden? Flag it ("All content hidden — frame too small").

Flagged frames get a small red badge placed **above and outside** the frame (16px above its top edge, left-aligned to it) so it doesn't overlap the design itself. The badge is a tiny frame with red fill and white `⚠ Review` text. Designers can delete the badge with one click; deleting it doesn't affect the generated frame.

### Explicitly NOT in v1

- Wholesale layout re-arrangement (e.g. swapping vertical→horizontal layout for tall vs wide targets). This is what AI polish is for in v2.
- Re-ranking element importance to drop secondary elements. v2 with AI.
- Smart copy rewriting (shorter headlines for smaller sizes). Out of scope, possibly forever — copy is the copywriter's job.

### Honest expectation framing

Plugin success message:
> "Generated 14 banners on page Generated – Q2 Spring Campaign. 3 frames flagged for review."

Web wizard and dashboard tile copy echo the same framing: this tool gives designers a strong starting point, not a finished deliverable.

## 7. Code Organization

### Web side — extends the existing Next.js app

```
src/
├── app/
│   ├── api/
│   │   └── banner-jobs/
│   │       ├── route.ts                    # POST: create job, returns code
│   │       └── cleanup/route.ts            # GET: cron-triggered TTL cleanup
│   └── dashboard/designer/
│       └── banner-resizer/
│           ├── page.tsx                    # the wizard
│           └── confirmation.tsx            # post-submit code display
├── components/
│   └── banner-resizer/
│       ├── size-picker.tsx                 # IAB checkbox grid + custom size form
│       ├── job-name-input.tsx
│       ├── options-form.tsx                # placement + naming + (locked) AI polish
│       └── code-display.tsx                # 6-char display + copy + QR + countdown
└── lib/
    └── banner-jobs/
        ├── iab-sizes.ts                    # the preset size catalog
        ├── code-generator.ts               # nanoid with custom alphabet (no 0/O/I/1)
        └── job-config.ts                   # zod schema + types
```

Add tile to `src/app/dashboard/designer/page.tsx`:
```ts
{
  href: "/dashboard/designer/banner-resizer",
  label: "Banner Resizer",
  description: "Generate IAB banner size variants from your Figma source frames",
  icon: LayoutPanelLeft,
}
```

### Plugin side — new repository

```
glueskills-banner-resizer-plugin/
├── manifest.json                    # Figma plugin manifest
├── src/
│   ├── code.ts                      # plugin sandbox entry — scene graph access
│   ├── ui/
│   │   ├── ui.html                  # iframe entry
│   │   ├── ui.tsx                   # React UI
│   │   ├── code-entry.tsx
│   │   ├── source-picker.tsx
│   │   ├── mapping-list.tsx
│   │   └── progress.tsx
│   ├── algorithm/
│   │   ├── pass-1-resize.ts         # clone + native resize
│   │   ├── pass-2-roles.ts          # role detection + adjustments
│   │   ├── pass-3-validate.ts       # bounds/overflow checks + flag badges
│   │   └── role-detectors.ts        # the regex/heuristic rules
│   ├── api/
│   │   └── jobs.ts                  # fetch from Supabase via REST + anon key
│   └── shared/
│       └── types.ts                 # shared with web — copy of BannerJobConfig
├── webpack.config.js                # Figma plugin standard bundling
└── package.json
```

**Plugin → Supabase auth:** Plugin uses Supabase's anon key (public, embedded in plugin bundle — fine because RLS allows anon `select` by code). No service role key in plugin.

**Type sharing:** `BannerJobConfig` is duplicated in both repos rather than published as an npm package — small enough that drift is easy to catch in code review, and avoids a publish step. Document the contract in a comment on both copies.

**Plugin sandbox ↔ UI iframe communication:** Standard Figma pattern — `figma.ui.postMessage()` from sandbox, `parent.postMessage()` from UI iframe, message handlers on both sides.

**Vercel cron config:** `/api/banner-jobs/cleanup` requires a `vercel.json` entry at the repo root:

```json
{
  "crons": [
    { "path": "/api/banner-jobs/cleanup", "schedule": "0 * * * *" }
  ]
}
```

Cron route checks `Authorization: Bearer ${process.env.CRON_SECRET}` header (Vercel auto-injects this when invoking the cron) and rejects any request without it. Add `CRON_SECRET` to the project's environment variables.

## 8. Error Handling, Limits & Edge Cases

### Limits

- Max **20 target sizes per job** (web wizard caps the total checkbox + custom count). Above this, plugin generation gets slow and the file gets unwieldy.
- Max custom size dimensions: **4000×4000 px** (Figma frame size limits).
- Min custom size dimensions: **50×50 px** (anything smaller is meaningless for ad use).
- Job name: 1–80 chars (Figma page name length).
- Max **10 jobs created per user per hour** (loose cap to prevent runaway costs in pathological cases).

### Web error states

- POST `/api/banner-jobs` failure → toast with retry, no redirect.
- Cleanup cron failure → silent (next run picks up the slack); logged to Vercel.
- Rate limit exceeded → 429 response, toast: "You've created 10 jobs this hour. Try again later."

### Plugin error states

Each gets a clear in-panel error UI, never a Figma `figma.notify()` alert (those disappear too quickly to read).

| Scenario | Behavior |
|---|---|
| Code not found | "We couldn't find that code. Generate a new one in the web app." + link |
| Code expired | "This code expired. Generate a new one." + link |
| Code already used (>5 min ago) | "This code has already been used. Generate a new one." + link |
| Network failure on fetch | "Couldn't reach GlueSkills. Check your connection and try again." + retry button |
| User selected zero source frames | Disable Generate button + helper text "Select at least one source frame." |
| Source frame failed to clone (rare — Figma API exception) | Skip that target, log to plugin console, continue rest. Final summary: "Generated X of Y. Z frames couldn't be created — see console." |
| Generated frame is fully empty (all elements hidden as overflow) | Add the ⚠ Review badge with text "All content hidden — frame too small" |
| Plugin closed mid-generation | Cleanup: any partially-created frames get deleted via `figma.on("close")` handler |

### Idempotency

The 5-minute re-fetch window for consumed codes covers the case where the plugin crashes after fetching but before generating. User can re-paste the same code.

## 9. Testing Strategy

### Web

- **Unit:** `code-generator.ts` (alphabet correctness, collision behavior), `iab-sizes.ts` (catalog completeness vs IAB spec), `job-config.ts` (zod schema accept/reject cases).
- **API:** `banner-jobs/route.ts` integration tests against a test Supabase instance — POST creates row, GET marks consumed, expired codes return 410, rate limit returns 429.
- **Component:** size picker (checkbox toggling, custom add/remove, max-20 enforcement), code-display (countdown ticks, copy button calls clipboard).
- **No E2E** — the web side is too tightly coupled to Figma for E2E to be valuable. Manual smoke before each release.

### Plugin

- **Unit:** Each algorithm pass tested against fixture scene-graph JSON. Role detectors tested against ~30 sample layer names (golden set covering common naming patterns).
- **Snapshot:** For ~5 representative source frames (300×250 with logo+headline+CTA, 728×90 with image+headline, etc.), snapshot the resulting layouts at 5 target sizes. Run on every PR to catch algorithm regressions.
- **Manual:** A test Figma file in the GlueSkills team workspace with a "test bench" — known-good source frames + expected outputs. Run before publishing each plugin version.

### Backend cleanup cron

Tested manually + Vercel logs. Not worth automated tests.

## 10. Out of Scope for v1 / v2 Roadmap

### Explicitly v2

- **AI polish toggle** — Pass 4: send the generated frame snapshot + target spec to Claude vision, get back layout adjustments, apply them. Wizard toggle is reserved/grayed-out in v1.
- **Social platform size catalog** — Meta (1080×1080, 1200×628, 1080×1920 Story), LinkedIn (1200×627, 1080×1080), X (1600×900), YouTube (1280×720, 2560×1440 channel art). Separate tab in the size picker.
- **Saved presets** — "My usual campaign sizes" stored in Supabase, loadable with one click.
- **Job history page** — see past jobs, re-run with one click.

### Explicitly out of scope, possibly forever

- Smart copy rewriting (shorter headlines for smaller sizes).
- Multi-page Figma file generation (output is always frames, not pages-of-frames).
- Animated/HTML5 banner export (`.zip` with HTML/JS) — different feature, different tool.
- Brand kit enforcement (font/color override). The plugin trusts the source design.
- Support for non-Figma design tools (Sketch, XD, PSD).
