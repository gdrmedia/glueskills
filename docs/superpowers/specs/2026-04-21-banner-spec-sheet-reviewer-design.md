# Banner Spec Sheet Reviewer — Design

**Date:** 2026-04-21
**Section:** Strategist
**Route:** `/dashboard/strategist/spec-sheet-reviewer`

## Summary

A Strategist tool that converts a messy Excel media spec sheet (`.xlsx`) into a clean, shareable, self-contained web viewer. The user uploads a file; the browser parses it; a shareable unguessable URL is returned. Anyone with the URL can view the rendered viewer — no login required. Uploaders can see a list of all sheets they've generated and delete any of them.

Ports an existing CLI workflow (`temp/spec-sheet-viewer/`) into the GlueSkills dashboard.

## Goals

- One-shot upload → shareable link flow, under 5 seconds end-to-end for a typical sheet.
- Viewer URL is shareable with anyone (including non-team members) without login friction.
- Uploaders get a durable "My spec sheets" list they can revisit months later.
- Viewer styling matches the polish of the existing `viewer.html` template (pink accents, partner color coding, search + filters + role switcher + timeline).

## Non-goals

- Editing placements in the viewer. It is read-only.
- Expiring links. Shared URLs live until the uploader deletes them.
- Re-parsing or re-uploading into an existing sheet. Each upload generates a new code.
- Server-side xlsx parsing. Parsing happens entirely in the browser.

## User flow

### 1. Tool page (`/dashboard/strategist/spec-sheet-reviewer`)

- Heading + description.
- **Upload form**:
  - File picker (drag-and-drop friendly), accepts `.xlsx`, max 5 MB
  - Campaign name input (auto-filled from filename, user-editable)
  - Client name input (optional)
  - "Generate viewer" button
- **"My spec sheets" list** below the form — columns: campaign, client, created date, copy-link, view link, delete. Empty state: "No sheets yet. Upload one above to get started."

### 2. On submit

1. Browser reads the file via `FileReader`.
2. `lib/spec-sheets/parse-xlsx.ts` parses it into the same shape as the CLI parser. Warnings and fatal errors surface inline.
3. `lib/spec-sheets/enrich.ts` produces the final placements/partners/summary payload.
4. POST `{ campaign, client, placements, partners, summary }` to `/api/spec-sheets`.
5. Server validates, rate-limits, inserts, returns `{ code }`.
6. UI flips to a success view: the full shareable URL, a Copy button, and an "Open viewer" link. "Create another" resets the form.

### 3. Shared viewer (`/s/[code]`)

- Public route (no auth required).
- Full-screen, no dashboard chrome.
- Server Component fetches the row via a Supabase anon-key query and passes placements as props to the client viewer.
- 404 on invalid/deleted code (Next.js `notFound()`), with a friendly message.

## Architecture

### Data model — Supabase `spec_sheets` table

| Column | Type | Notes |
|---|---|---|
| `code` | `text` (PK) | 6-char nanoid, alphabet matches `banner-jobs` |
| `user_id` | `text` | Clerk user id, indexed |
| `campaign` | `text` | |
| `client` | `text` | nullable |
| `placements` | `jsonb` | enriched placement array |
| `partners` | `jsonb` | derived partner list with color + iconId |
| `summary` | `jsonb` | `{ totalPlacements, earliestDue, ... }` |
| `created_at` | `timestamptz` | default `now()` |
| `deleted_at` | `timestamptz` | nullable (soft delete) |

**RLS policies:**
- `SELECT`: allowed for anyone when `deleted_at IS NULL`. The code is the access control (unguessable 6-char token).
- `INSERT` / `UPDATE` / `DELETE`: only when `user_id = auth.jwt() ->> 'sub'`. Matches the `banner-jobs` pattern.

**Rate limit on `INSERT`:** 10 per hour per user, enforced in the API route by counting recent rows.

### API routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/spec-sheets` | Clerk required | Create a sheet. Validates + rate-limits + inserts. Returns `{ code }`. |
| `GET` | `/api/spec-sheets` | Clerk required | List the current user's non-deleted sheets, newest first. |
| `DELETE` | `/api/spec-sheets/[code]` | Clerk required | Soft-delete (sets `deleted_at`). Owner only (enforced by RLS). |
| `GET` | `/api/spec-sheets/[code]` | Public | Fetch a single sheet by code for the public viewer. 404 if deleted. |

### File layout

```
src/
├─ app/
│  ├─ dashboard/strategist/spec-sheet-reviewer/
│  │  └─ page.tsx                        # Upload form + My Sheets list
│  ├─ s/[code]/
│  │  ├─ layout.tsx                      # Full-screen, no dashboard chrome
│  │  └─ page.tsx                        # Public viewer (fetches & renders)
│  └─ api/spec-sheets/
│     ├─ route.ts                        # POST (create), GET (list for user)
│     └─ [code]/route.ts                 # DELETE (soft), GET (public fetch)
├─ components/spec-sheet-reviewer/
│  ├─ upload-form.tsx                    # File picker + campaign/client inputs
│  ├─ sheets-list.tsx                    # "My spec sheets" table
│  └─ viewer/
│     ├─ spec-viewer.tsx                 # Top-level viewer shell
│     ├─ placement-card.tsx              # Collapsed/expanded card
│     ├─ filters-bar.tsx                 # Search + partner/format/due/market filters
│     ├─ role-switcher.tsx               # Designer/PM/Trafficking toggle
│     ├─ timeline-layout.tsx             # Timeline grouping by due date
│     ├─ detail-modal.tsx                # Expanded placement modal
│     └─ partner-icons.tsx               # Inline SVG icon components
└─ lib/spec-sheets/
   ├─ parse-xlsx.ts                      # Ported from scripts/parse-xlsx.js
   ├─ enrich.ts                          # Ported enrichment fns (dates, ratios, splitMulti)
   ├─ partner-colors.ts                  # Ported partner-colors.js
   ├─ schema.ts                          # Zod schemas for API payloads
   └─ code-generator.ts                  # 6-char nanoid
```

### Parsing location — client-side

The `xlsx` library works in browsers. Parsing in the client:
- Matches CLAUDE.md's "prefer client-side" principle.
- Avoids multipart upload handling on the server.
- Gives instant feedback on malformed sheets.
- The raw xlsx never leaves the user's machine — only the parsed JSON.

### Viewer porting strategy

The existing `templates/viewer.html` is a 1822-line self-contained HTML file with embedded React-from-CDN, inline CSS tokens, and a `{{DATA}}` placeholder. Ported to native Next.js as follows:

- **CSS tokens** — extract `:root` variables into a scoped CSS module (or a Tailwind `@theme` extension) applied only under `/s/[code]`, so the viewer's pink/ink palette does not bleed into dashboard routes.
- **Typography** — add Manrope via `next/font/google` alongside the existing Inter font. JetBrains Mono stays as-is for the rest of the app.
- **Components** — translate the inline JSX from the template into the `components/spec-sheet-reviewer/viewer/` files. No behavior changes: search, filters, role switcher, card expansion, partner accents, **timeline grouping retained**, detail modal.
- **Icons** — inline SVGs from the template become React components in `partner-icons.tsx`, keyed by `iconId`.
- **Data injection** — instead of `{{DATA}}` string substitution, `app/s/[code]/page.tsx` as a Server Component fetches the row and passes `placements`, `partners`, `summary` as props to the client viewer.
- **Visual parity check** — render the canonical test fixture through both the original template and the ported viewer, eyeball side by side during implementation to catch lost details.

## Error handling

### Client-side parse errors
- No "Partner" header row: "This doesn't look like a media spec sheet. Expected a 'Partner' column header."
- Zero placement rows: same message.
- File is not valid xlsx: "Could not read file — is it a valid .xlsx?"
- Multi-sheet workbook: warning toast "Using first sheet: '<name>'. Other sheets ignored."
- Unknown columns: silent; they flow into `otherFields` and appear under the viewer's Compliance & Tracking section (matches current CLI behavior).

### Server errors
- Standard JSON `{ error }` responses mapped to Sonner toasts on the tool page.

### Viewer page
- Invalid/deleted code → Next.js `notFound()` → friendly 404 ("This spec sheet doesn't exist or was deleted").

### File size cap
- 5 MB enforced client-side before parsing.

## Registration

- Add to the tool list in `src/app/dashboard/strategist/page.tsx`.
- Icon: `FileSpreadsheet` from lucide.
- Color: orange (Strategist section default).
- No sidebar change (tools live only inside section grids).

## Testing

| Target | Strategy |
|---|---|
| `lib/spec-sheets/parse-xlsx.ts` | Port the existing parser tests from `temp/spec-sheet-viewer/tests/parse-xlsx.test.js` to Vitest. Highest-value tests — these cover the merged-cell inheritance, header detection, and unknown-column handling. |
| `lib/spec-sheets/enrich.ts` | Port the enrichment tests (`render-html.test.js` covers most of this already — date parsing, flight-date ranges, aspect ratio normalization, splitMulti). |
| `lib/spec-sheets/partner-colors.ts` | Trivial tests: known partners map correctly, unknowns fall back. |
| `lib/spec-sheets/code-generator.ts` | Format + no collisions across a small sample. |
| `/api/spec-sheets` routes | `route.test.ts` per route, mirroring `banner-jobs` test shape: auth, rate-limit, happy path, not-found, ownership-on-delete. |
| Viewer components | Smoke test: render viewer with canonical fixture, assert no console errors and that key strings appear (campaign, a partner name, a placement name). |

Test fixture: port `temp/spec-sheet-viewer/tests/fixtures/build-fixture.js` to `src/lib/spec-sheets/__fixtures__/build-fixture.ts` so parser + enrichment tests share one canonical input.

## Open questions

None at design time. All decisions confirmed in brainstorming:
- Access control: public URL with unguessable code
- Expiration: never
- Implementation: port the viewer to native Next.js (keep timeline layout)
- My Sheets list: full list with delete
- Parsing: client-side
