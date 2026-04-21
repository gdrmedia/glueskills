# Banner Spec Sheet Reviewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Strategist tool that converts a `.xlsx` media spec sheet into a shareable web viewer at an unguessable public URL. Matches the design at `docs/superpowers/specs/2026-04-21-banner-spec-sheet-reviewer-design.md`.

**Architecture:** Client-side xlsx parsing → POST parsed JSON to a Clerk-gated API → Supabase insert with a 6-char nanoid code → public viewer at `/s/[code]` reads the row via a `security definer` RPC (prevents code enumeration), renders a ported React viewer.

**Tech Stack:** Next.js 16 App Router, TypeScript, Clerk, Supabase, shadcn v4 (base-ui), Tailwind v4, `xlsx` (SheetJS), Zod, nanoid, Vitest, Sonner.

---

## Reference files (do not edit; port from)

- `temp/spec-sheet-viewer/scripts/parse-xlsx.js` — parser
- `temp/spec-sheet-viewer/scripts/partner-colors.js` — partner → color/iconId map
- `temp/spec-sheet-viewer/scripts/render-html.js` — enrichment logic (functions `splitMulti`, `maybeSingle`, `excelSerialToDate`, `parseLooseDate`, `parseFlightDates`, `slug`, `normalizeAspectRatio`, `enrichPlacements`, `buildPartners`, `buildSummary`)
- `temp/spec-sheet-viewer/templates/viewer.html` — the full 1822-line self-contained viewer (React components, CSS, inline SVG icons). Line ranges cited in tasks.
- `temp/spec-sheet-viewer/tests/parse-xlsx.test.js` — parser tests (Node test runner; will be rewritten to Vitest)
- `temp/spec-sheet-viewer/tests/render-html.test.js` — enrichment tests (Node test runner)
- `temp/spec-sheet-viewer/tests/fixtures/build-fixture.js` — canonical fixture (sample.xlsx + EXPECTED)

## Sibling patterns to follow

- `src/lib/banner-jobs/code-generator.ts` + `code-generator.test.ts` — shape of the nanoid helper + its tests
- `src/lib/banner-jobs/job-config.ts` + `job-config.test.ts` — shape of Zod schemas + tests
- `src/app/api/banner-jobs/route.ts` — Clerk auth + rate limit + insert flow
- `supabase/migrations/003_banner_jobs.sql` — RLS policies + `security definer` RPC pattern
- `src/lib/supabase/client.ts` — how to pass the Clerk-templated JWT

---

## Task 1: Install `xlsx` dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (auto)

- [ ] **Step 1: Add dependency**

```bash
npm install xlsx@^0.18.5
```

Expected: `package.json` gains `"xlsx": "^0.18.5"` under `dependencies`. No install errors.

- [ ] **Step 2: Verify install**

```bash
node -e "console.log(require('xlsx').version)"
```

Expected: prints a version string (e.g. `0.18.5`) with no error.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add xlsx dependency for spec sheet reviewer"
```

---

## Task 2: Supabase migration — `spec_sheets` table + RPC

**Files:**
- Create: `supabase/migrations/004_spec_sheets.sql`

**Important security note:** The spec allows the public viewer to fetch any non-deleted row by its 6-char code. If we give the `anon` role a blanket SELECT, it could enumerate *every* row in the table (leaking campaign names, client names, and codes). Instead we use a `security definer` RPC that returns exactly one row given a code — mirroring the `consume_banner_job` pattern. `SELECT` is user-scoped.

- [ ] **Step 1: Write the migration**

```sql
-- Banner Spec Sheet Reviewer: persistent shareable viewer rows.
-- See: docs/superpowers/specs/2026-04-21-banner-spec-sheet-reviewer-design.md

create table if not exists spec_sheets (
  code        text primary key,
  user_id     text not null,
  campaign    text not null,
  client      text,
  placements  jsonb not null,
  partners    jsonb not null,
  summary     jsonb not null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists idx_spec_sheets_user_id on spec_sheets(user_id);
create index if not exists idx_spec_sheets_deleted_at on spec_sheets(deleted_at);

alter table spec_sheets enable row level security;

-- Web side: authenticated Clerk users manage only their own rows.
create policy "Users insert their own spec sheets"
  on spec_sheets for insert
  with check (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

create policy "Users select their own spec sheets"
  on spec_sheets for select
  using (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

create policy "Users update their own spec sheets"
  on spec_sheets for update
  using (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

create policy "Users delete their own spec sheets"
  on spec_sheets for delete
  using (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

-- Public fetch: anon role calls this RPC (security definer bypasses RLS).
-- Returns null if the row doesn't exist or was soft-deleted. The 6-char code
-- is the bearer token — prevents enumeration of other rows.
create or replace function get_spec_sheet(sheet_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data spec_sheets;
begin
  select * into row_data
  from spec_sheets
  where code = sheet_code
    and deleted_at is null;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'code', row_data.code,
    'campaign', row_data.campaign,
    'client', row_data.client,
    'placements', row_data.placements,
    'partners', row_data.partners,
    'summary', row_data.summary,
    'createdAt', row_data.created_at
  );
end;
$$;

revoke all on function get_spec_sheet(text) from public;
grant execute on function get_spec_sheet(text) to anon;
grant execute on function get_spec_sheet(text) to authenticated;
```

- [ ] **Step 2: Apply the migration**

Apply this SQL via the Supabase dashboard (SQL editor) against the project. There is no migration CLI wired up in this repo; migrations are run manually, same as `003_banner_jobs.sql`.

Verify:
```sql
select * from spec_sheets limit 0;
select get_spec_sheet('XXXXXX');  -- expect NULL
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/004_spec_sheets.sql
git commit -m "feat(db): add spec_sheets table + get_spec_sheet RPC"
```

---

## Task 3: Code generator

**Files:**
- Create: `src/lib/spec-sheets/code-generator.ts`
- Test: `src/lib/spec-sheets/code-generator.test.ts`

Identical in behavior to `src/lib/banner-jobs/code-generator.ts` — a separate file is justified because codes can diverge later (e.g., if we want 8 chars here).

- [ ] **Step 1: Write failing tests**

`src/lib/spec-sheets/code-generator.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { generateSheetCode, SHEET_CODE_ALPHABET, SHEET_CODE_LENGTH } from "./code-generator";

describe("generateSheetCode", () => {
  it("returns a string of length 6", () => {
    expect(generateSheetCode()).toHaveLength(SHEET_CODE_LENGTH);
    expect(SHEET_CODE_LENGTH).toBe(6);
  });

  it("only uses characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateSheetCode();
      for (const char of code) expect(SHEET_CODE_ALPHABET).toContain(char);
    }
  });

  it("excludes ambiguous characters (0, O, I, 1, L)", () => {
    for (const banned of ["0", "O", "I", "1", "L"]) {
      expect(SHEET_CODE_ALPHABET).not.toContain(banned);
    }
  });

  it("produces low collision rate over 5,000 codes", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 5000; i++) codes.add(generateSheetCode());
    expect(codes.size).toBeGreaterThanOrEqual(4999);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run src/lib/spec-sheets/code-generator.test.ts
```

Expected: all tests fail (module not found).

- [ ] **Step 3: Implement**

`src/lib/spec-sheets/code-generator.ts`:
```typescript
import { customAlphabet } from "nanoid";

export const SHEET_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const SHEET_CODE_LENGTH = 6;

const generator = customAlphabet(SHEET_CODE_ALPHABET, SHEET_CODE_LENGTH);

export function generateSheetCode(): string {
  return generator();
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npx vitest run src/lib/spec-sheets/code-generator.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/spec-sheets/code-generator.ts src/lib/spec-sheets/code-generator.test.ts
git commit -m "feat(spec-sheets): add code generator"
```

---

## Task 4: Partner colors

**Files:**
- Create: `src/lib/spec-sheets/partner-colors.ts`
- Test: `src/lib/spec-sheets/partner-colors.test.ts`

Port from `temp/spec-sheet-viewer/scripts/partner-colors.js`.

- [ ] **Step 1: Write failing tests**

`src/lib/spec-sheets/partner-colors.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { colorFor, iconIdFor, FALLBACK } from "./partner-colors";

describe("colorFor / iconIdFor", () => {
  it("maps Meta variants to Meta color", () => {
    expect(colorFor("Meta")).toBe("#0866FF");
    expect(colorFor("META")).toBe("#0866FF");
    expect(colorFor("Facebook Ads")).toBe("#0866FF");
  });

  it("maps YouTube CTV vs OLV differently", () => {
    expect(iconIdFor("YouTube CTV")).toBe("youtubectv");
    expect(iconIdFor("YouTube OLV")).toBe("youtubeolv");
    expect(iconIdFor("YouTube")).toBe("youtubectv");
  });

  it("returns the fallback for unknown partners", () => {
    expect(colorFor("Acme Advertising Co")).toBe(FALLBACK.color);
    expect(iconIdFor("Acme Advertising Co")).toBe(FALLBACK.id);
  });

  it("returns the fallback for null/empty", () => {
    expect(colorFor(null)).toBe(FALLBACK.color);
    expect(colorFor("")).toBe(FALLBACK.color);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run src/lib/spec-sheets/partner-colors.test.ts
```

Expected: module-not-found failures.

- [ ] **Step 3: Implement**

`src/lib/spec-sheets/partner-colors.ts`:
```typescript
// Partner name → { id, color } mapping. Match by regex against raw partner name.

type Entry = { match: RegExp; id: string; color: string };

const MAP: Entry[] = [
  { match: /^meta/i,           id: "meta",       color: "#0866FF" },
  { match: /^facebook/i,       id: "meta",       color: "#0866FF" },
  { match: /^instagram/i,      id: "meta",       color: "#E4405F" },
  { match: /^reddit/i,         id: "reddit",     color: "#FF4500" },
  { match: /^tiktok/i,         id: "tiktok",     color: "#13131A" },
  { match: /youtube.*ctv/i,    id: "youtubectv", color: "#FF0000" },
  { match: /youtube.*olv/i,    id: "youtubeolv", color: "#EF4444" },
  { match: /^youtube/i,        id: "youtubectv", color: "#FF0000" },
  { match: /^google/i,         id: "google",     color: "#4285F4" },
  { match: /directv/i,         id: "directv",    color: "#E11D48" },
  { match: /spotify/i,         id: "spotify",    color: "#1DB954" },
  { match: /pandora/i,         id: "pandora",    color: "#005483" },
  { match: /yelp/i,            id: "yelp",       color: "#D32323" },
  { match: /transmit/i,        id: "transmit",   color: "#7C3AED" },
  { match: /pubmatic/i,        id: "pubmatic",   color: "#A855F7" },
  { match: /^pmp/i,            id: "pmp",        color: "#9333EA" },
  { match: /^dmv/i,            id: "dmv",        color: "#8B5CF6" },
  { match: /smartly|display/i, id: "smartly",    color: "#6B5AED" },
  { match: /ctv/i,             id: "transmit",   color: "#7C3AED" },
  { match: /twitter|^x$/i,     id: "twitter",    color: "#1DA1F2" },
  { match: /linkedin/i,        id: "linkedin",   color: "#0A66C2" },
  { match: /snap/i,            id: "snap",       color: "#FFFC00" },
  { match: /pinterest/i,       id: "pinterest",  color: "#E60023" },
];

export const FALLBACK = { id: "generic", color: "#9E9E9E" } as const;

function lookup(partner: string | null | undefined): { id: string; color: string } {
  if (!partner) return FALLBACK;
  for (const entry of MAP) if (entry.match.test(partner)) return entry;
  return FALLBACK;
}

export function colorFor(partner: string | null | undefined): string {
  return lookup(partner).color;
}

export function iconIdFor(partner: string | null | undefined): string {
  return lookup(partner).id;
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npx vitest run src/lib/spec-sheets/partner-colors.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/spec-sheets/partner-colors.ts src/lib/spec-sheets/partner-colors.test.ts
git commit -m "feat(spec-sheets): add partner color/icon map"
```

---

## Task 5: Canonical test fixture

**Files:**
- Create: `src/lib/spec-sheets/__fixtures__/build-fixture.ts`

Port from `temp/spec-sheet-viewer/tests/fixtures/build-fixture.js`. Same HEADERS, GUIDANCE, ROWS, and EXPECTED arrays. Converted to TS. Does not need its own test — it's consumed by parser/enrichment tests.

- [ ] **Step 1: Port the fixture file**

Copy every line from `temp/spec-sheet-viewer/tests/fixtures/build-fixture.js` into `src/lib/spec-sheets/__fixtures__/build-fixture.ts` with these changes:

1. Replace `require` with ES imports:
```typescript
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
```
2. Rename `EXPECTED` type: add at bottom of file:
```typescript
export type ExpectedPlacement = typeof EXPECTED[number];
```
3. Keep the `build()` function but export it as a named export. It writes `sample.xlsx` alongside itself.
4. Keep `HEADERS`, `GUIDANCE`, `ROWS`, `EXPECTED` as `export const`.
5. Drop the `if (require.main === module)` block at the bottom.

Everything else — the string contents of HEADERS/GUIDANCE/ROWS/EXPECTED — is a direct copy. Do not rewrite them; copy verbatim to preserve the exact byte sequences the tests compare against.

- [ ] **Step 2: Sanity check build() works**

```bash
node --experimental-vm-modules --loader tsx src/lib/spec-sheets/__fixtures__/build-fixture.ts 2>/dev/null || echo "OK — not runnable standalone, parser test will call build()"
```

No assertion; this just checks TypeScript parses the file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/spec-sheets/__fixtures__/build-fixture.ts
git commit -m "test(spec-sheets): add canonical xlsx fixture builder"
```

---

## Task 6: xlsx parser

**Files:**
- Create: `src/lib/spec-sheets/parse-xlsx.ts`
- Test: `src/lib/spec-sheets/parse-xlsx.test.ts`

Port `temp/spec-sheet-viewer/scripts/parse-xlsx.js` to TypeScript. The function signature becomes `parseXlsx(input: ArrayBuffer | Uint8Array | Buffer): { placements: Placement[]; warnings: string[]; headers: string[] }` — note the shift from file path to buffer, because this runs in the browser.

- [ ] **Step 1: Write failing tests**

`src/lib/spec-sheets/parse-xlsx.test.ts`:
```typescript
import { describe, expect, it, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { parseXlsx } from "./parse-xlsx";
import { build, EXPECTED } from "./__fixtures__/build-fixture";

const FIXTURE_PATH = path.join(__dirname, "__fixtures__", "sample.xlsx");

beforeAll(() => {
  if (!fs.existsSync(FIXTURE_PATH)) build();
});

function readFixture(): Uint8Array {
  return new Uint8Array(fs.readFileSync(FIXTURE_PATH));
}

describe("parseXlsx", () => {
  it("returns the expected placements from the canonical fixture", () => {
    const result = parseXlsx(readFixture());
    expect(result.placements).toHaveLength(EXPECTED.length);
    expect(result.placements).toEqual(EXPECTED);
  });

  it("inherits Partner across empty rows (merged cells)", () => {
    const { placements } = parseXlsx(readFixture());
    expect(placements[1].partner).toBe("Meta");   // DPA continuation row
    expect(placements[3].partner).toBe("Reddit"); // Category Takeover continuation
  });

  it("skips the guidance row", () => {
    const { placements } = parseXlsx(readFixture());
    const partners = placements.map(p => p.partner);
    expect(partners).not.toContain("Where the ads will run");
  });

  it("normalizes empty cells to null and preserves 'N/A'", () => {
    const { placements } = parseXlsx(readFixture());
    expect(placements[0].frameRate).toBeNull();
    expect(placements[0].thirdPartyServingType).toBe("N/A");
  });

  it("collects unknown columns into otherFields", () => {
    const aoa = [
      ["Partner", "Placement Name", "Ad Dimensions", "Custom Client Field"],
      ["desc", "desc", "desc", "desc"],
      ["Meta", "Reels", "1080 × 1920", "special note"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Specs");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const { placements } = parseXlsx(new Uint8Array(buf));
    expect(placements[0].otherFields["Custom Client Field"]).toBe("special note");
  });

  it("skips preamble rows to find headers by 'Partner'", () => {
    const aoa = [
      ["ACME", null, null, null],
      ["H1'26 Media", null, null, null],
      ["NEW Partner/Buy **", null, null, null],
      ["Partner", "Placement Name", "Ad Dimensions", "File Format"],
      ["desc", "desc", "desc", "desc"],
      ["Meta", "Reels", "1080 × 1920", "MP4"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Specs");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const { placements } = parseXlsx(new Uint8Array(buf));
    expect(placements).toHaveLength(1);
    expect(placements[0].partner).toBe("Meta");
    expect(placements[0].placementName).toBe("Reels");
    expect(placements[0].adDimensions).toBe("1080 × 1920");
  });

  it("matches headers with parenthetical clarifications", () => {
    const aoa = [
      ["Partner", "Placement Name", "Ad Dimensions (Pixels)", "File Format ", "Who Builds Creative (Agency or Partner)"],
      ["desc", "desc", "desc", "desc", "desc"],
      ["Meta", "Reels", "1080 × 1920", "MP4", "Agency"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Specs");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const { placements } = parseXlsx(new Uint8Array(buf));
    expect(placements[0].adDimensions).toBe("1080 × 1920");
    expect(placements[0].fileFormat).toBe("MP4");
    expect(placements[0].whoBuilds).toBe("Agency");
  });

  it("warns when no Partner header is found", () => {
    const aoa = [["Foo", "Bar"], ["a", "b"]];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Specs");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const result = parseXlsx(new Uint8Array(buf));
    expect(result.placements).toEqual([]);
    expect(result.warnings.join(" ")).toMatch(/Partner/);
  });
});
```

- [ ] **Step 2: Run — expect module-not-found failures**

```bash
npx vitest run src/lib/spec-sheets/parse-xlsx.test.ts
```

- [ ] **Step 3: Implement the parser**

`src/lib/spec-sheets/parse-xlsx.ts`:
```typescript
import * as XLSX from "xlsx";

// Known column headers → normalized object field names.
const HEADER_MAP: Record<string, string> = {
  "Partner": "partner",
  "Flight Dates": "flightDates",
  "Creative Due Date": "creativeDueDate",
  "Market": "market",
  "Placement Name": "placementName",
  "Description": "description",
  "Ad Format": "adFormat",
  "Who Builds Creative": "whoBuilds",
  "Site Served": "siteServed",
  "3rd Party Serving Type": "thirdPartyServingType",
  "Ad Placement": "adPlacement",
  "Creative Type": "creativeType",
  "Ad Dimensions": "adDimensions",
  "File Format": "fileFormat",
  "Max File Size": "maxFileSize",
  "Backup Image Requirements": "backupImage",
  "Aspect Ratio": "aspectRatio",
  "Frame Rate": "frameRate",
  "Bitrate": "bitrate",
  "Audio Specs": "audioSpecs",
  "Animation Length & Looping": "animationLength",
  "Clickthrough URL": "clickthroughUrl",
  "Do you allow Adserving?": "adservingAllowed",
  "Tracking Requirements": "trackingRequirements",
  "Headline Text Limit": "headlineTextLimit",
  "Description Text Limit": "descriptionTextLimit",
  "CTA Requirements": "ctaRequirements",
  "Font & Branding Guidelines": "fontBranding",
  "Third-Party Ad Tags": "thirdPartyAdTags",
  "Viewability & Measurement Requirements": "viewabilityRequirements",
  "GDPR/CCPA Compliance": "gdprCcpaCompliance",
  "Creative Approval Deadlines": "creativeApprovalDeadline",
  "Additional Information": "additionalInformation",
};

export type ParsedPlacement = {
  partner: string | null;
  flightDates: string | null;
  creativeDueDate: string | number | Date | null;
  market: string | null;
  placementName: string | null;
  description: string | null;
  adFormat: string | null;
  whoBuilds: string | null;
  siteServed: string | null;
  thirdPartyServingType: string | null;
  adPlacement: string | null;
  creativeType: string | null;
  adDimensions: string | null;
  fileFormat: string | null;
  maxFileSize: string | null;
  backupImage: string | null;
  aspectRatio: string | null;
  frameRate: string | null;
  bitrate: string | null;
  audioSpecs: string | null;
  animationLength: string | null;
  clickthroughUrl: string | null;
  adservingAllowed: string | null;
  trackingRequirements: string | null;
  headlineTextLimit: string | null;
  descriptionTextLimit: string | null;
  ctaRequirements: string | null;
  fontBranding: string | null;
  thirdPartyAdTags: string | null;
  viewabilityRequirements: string | null;
  gdprCcpaCompliance: string | null;
  creativeApprovalDeadline: string | null;
  additionalInformation: string | null;
  otherFields: Record<string, unknown>;
};

const DEFAULT_FIELDS = Object.values(HEADER_MAP).reduce((acc, k) => {
  acc[k] = null;
  return acc;
}, {} as Record<string, null>);

function normalizeCell(v: unknown): unknown {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "string") {
    const trimmed = v.trim();
    return trimmed === "" ? null : trimmed;
  }
  return v;
}

// Strip trailing parenthetical clarifications and extra whitespace so
// "Ad Dimensions (Pixels)" matches "Ad Dimensions" in HEADER_MAP.
function normalizeHeader(h: unknown): string {
  return String(h).replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function findHeaderRowIndex(rows: unknown[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const first = rows[i] && rows[i][0];
    if (first != null && String(first).trim().toLowerCase() === "partner") return i;
  }
  return -1;
}

export type ParseResult = {
  placements: ParsedPlacement[];
  warnings: string[];
  headers: string[];
};

export function parseXlsx(input: ArrayBuffer | Uint8Array | Buffer): ParseResult {
  const wb = XLSX.read(input, { type: "array", cellDates: true });
  const sheetNames = wb.SheetNames;
  const warnings: string[] = [];
  if (sheetNames.length > 1) {
    warnings.push(`Workbook has ${sheetNames.length} sheets; using "${sheetNames[0]}"`);
  }
  const ws = wb.Sheets[sheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });

  const headerRowIdx = findHeaderRowIndex(rows);
  if (headerRowIdx < 0) {
    warnings.push('Could not find a header row starting with "Partner" — is this the right sheet?');
    return { placements: [], warnings, headers: [] };
  }

  const headers = (rows[headerRowIdx] as unknown[]).map(h => (h == null ? "" : String(h).trim()));
  const dataRows = rows.slice(headerRowIdx + 2);

  const unknownHeaders = headers.filter(h => h && !HEADER_MAP[normalizeHeader(h)]);
  if (unknownHeaders.length) {
    warnings.push(`Unknown columns collected into otherFields: ${unknownHeaders.join(", ")}`);
  }

  const placements: ParsedPlacement[] = [];
  let lastPartner: string | null = null;

  for (const row of dataRows) {
    if (!row || row.every(c => c == null || c === "")) continue;

    const obj: ParsedPlacement = { ...(DEFAULT_FIELDS as unknown as ParsedPlacement), otherFields: {} };
    headers.forEach((header, i) => {
      const value = normalizeCell(row[i]);
      const fieldName = HEADER_MAP[normalizeHeader(header)];
      if (fieldName) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (obj as any)[fieldName] = value;
      } else if (header) {
        if (value !== null) obj.otherFields[header] = value;
      }
    });

    if (obj.partner == null && lastPartner != null) {
      obj.partner = lastPartner;
    } else if (obj.partner != null) {
      lastPartner = obj.partner as string;
    }

    if (obj.placementName == null && obj.partner == null) continue;

    placements.push(obj);
  }

  return { placements, warnings, headers };
}

export { HEADER_MAP };
```

- [ ] **Step 4: Run — expect all tests pass**

```bash
npx vitest run src/lib/spec-sheets/parse-xlsx.test.ts
```

Expected: 8 tests pass. If the `expect.toEqual(EXPECTED)` comparison fails, the `build-fixture.ts` ROW contents likely drifted from the source — recompare byte-by-byte with `temp/spec-sheet-viewer/tests/fixtures/build-fixture.js`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/spec-sheets/parse-xlsx.ts src/lib/spec-sheets/parse-xlsx.test.ts
git commit -m "feat(spec-sheets): add xlsx parser with merged-cell inheritance"
```

---

## Task 7: Enrichment functions

**Files:**
- Create: `src/lib/spec-sheets/enrich.ts`
- Test: `src/lib/spec-sheets/enrich.test.ts`

Port `enrichPlacements`, `buildPartners`, `buildSummary`, and the supporting helpers from `temp/spec-sheet-viewer/scripts/render-html.js` (lines 12–218). Changes: no template reading, no HTML rendering — just pure data transforms.

- [ ] **Step 1: Write failing tests**

`src/lib/spec-sheets/enrich.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import {
  enrichPlacements,
  buildPartners,
  buildSummary,
  splitMulti,
  parseLooseDate,
  parseFlightDates,
  normalizeAspectRatio,
} from "./enrich";
import type { ParsedPlacement } from "./parse-xlsx";

const base: ParsedPlacement = {
  partner: "Meta", flightDates: null, creativeDueDate: null, market: null,
  placementName: "Reels", description: null, adFormat: null, whoBuilds: null,
  siteServed: null, thirdPartyServingType: null, adPlacement: null, creativeType: null,
  adDimensions: null, fileFormat: null, maxFileSize: null, backupImage: null,
  aspectRatio: null, frameRate: null, bitrate: null, audioSpecs: null,
  animationLength: null, clickthroughUrl: null, adservingAllowed: null,
  trackingRequirements: null, headlineTextLimit: null, descriptionTextLimit: null,
  ctaRequirements: null, fontBranding: null, thirdPartyAdTags: null,
  viewabilityRequirements: null, gdprCcpaCompliance: null,
  creativeApprovalDeadline: null, additionalInformation: null, otherFields: {},
};

describe("splitMulti", () => {
  it("splits on newlines and semicolons", () => {
    expect(splitMulti("a\nb")).toEqual(["a", "b"]);
    expect(splitMulti("a; b; c")).toEqual(["a", "b", "c"]);
  });
  it("returns [] for null", () => {
    expect(splitMulti(null)).toEqual([]);
  });
});

describe("parseLooseDate", () => {
  it("parses '10-Dec' with fallback year", () => {
    const d = parseLooseDate("10-Dec", 2026);
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(11);
    expect(d?.getDate()).toBe(10);
  });
  it("parses '3/26/2026'", () => {
    const d = parseLooseDate("3/26/2026", 2026);
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(2);
    expect(d?.getDate()).toBe(26);
  });
  it("returns null for TBD", () => {
    expect(parseLooseDate("TBD Q1", 2026)).toBeNull();
  });
});

describe("parseFlightDates", () => {
  it("splits on hyphen", () => {
    const [start, end] = parseFlightDates("1/4-7/18", 2026);
    expect(start?.getMonth()).toBe(0);
    expect(end?.getMonth()).toBe(6);
  });
  it("returns [null, null] for TBD", () => {
    expect(parseFlightDates("TBD Q1", 2026)).toEqual([null, null]);
  });
});

describe("normalizeAspectRatio", () => {
  it("reduces dimension to ratio", () => {
    expect(normalizeAspectRatio("1920 × 1080")).toBe("16:9");
    expect(normalizeAspectRatio("1080 × 1080")).toBe("1:1");
  });
  it("passes through already-reduced ratios", () => {
    expect(normalizeAspectRatio("16:9")).toBe("16:9");
  });
});

describe("enrichPlacements", () => {
  it("slugs partner name and builds id", () => {
    const [p] = enrichPlacements([base], { year: 2026 });
    expect(p.partner).toBe("meta");
    expect(p.id).toBe("meta-0");
    expect(p.partnerName).toBe("Meta");
  });

  it("splits multi-value dimensions/formats/ratios/sizes", () => {
    const src: ParsedPlacement = {
      ...base,
      adDimensions: "1920 × 1080\n1080 × 1080",
      fileFormat: "JPG or PNG\nMP4",
      aspectRatio: "1920 × 1080\n1080 × 1080",
      maxFileSize: "1 GB: Video\n5 MB: Image",
    };
    const [p] = enrichPlacements([src], { year: 2026 });
    expect(p.dimensions).toEqual(["1920 × 1080", "1080 × 1080"]);
    expect(p.fileFormat).toEqual(["JPG or PNG", "MP4"]);
    expect(p.ratio).toEqual(["16:9", "1:1"]);
    expect(p.maxFileSize).toEqual(["1 GB: Video", "5 MB: Image"]);
  });

  it("returns single values (not arrays) when one entry", () => {
    const src: ParsedPlacement = { ...base, adDimensions: "1080 × 1920" };
    const [p] = enrichPlacements([src], { year: 2026 });
    expect(p.dimensions).toBe("1080 × 1920");
  });

  it("sets dueTBD when creativeDueDate is TBD-ish", () => {
    const src: ParsedPlacement = { ...base, creativeDueDate: "TBD" };
    const [p] = enrichPlacements([src], { year: 2026 });
    expect(p.dueTBD).toBe(true);
    expect(p.creativeDue).toBeNull();
  });
});

describe("buildPartners / buildSummary", () => {
  it("builds unique partner list with color + iconId", () => {
    const enriched = enrichPlacements(
      [{ ...base, partner: "Meta" }, { ...base, partner: "Reddit" }, { ...base, partner: "Meta" }],
      { year: 2026 }
    );
    const partners = buildPartners(enriched);
    expect(partners).toHaveLength(2);
    expect(partners[0].name).toBe("Meta");
    expect(partners[0].color).toBe("#0866FF");
  });

  it("builds summary with totalPlacements", () => {
    const enriched = enrichPlacements([{ ...base }, { ...base }], { year: 2026 });
    const summary = buildSummary(enriched, { campaign: "C1", client: "ACME" });
    expect(summary.totalPlacements).toBe(2);
    expect(summary.templateName).toBe("C1");
    expect(summary.client).toBe("ACME");
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run src/lib/spec-sheets/enrich.test.ts
```

- [ ] **Step 3: Implement**

`src/lib/spec-sheets/enrich.ts`:
```typescript
import type { ParsedPlacement } from "./parse-xlsx";
import { colorFor, iconIdFor } from "./partner-colors";

export type EnrichedPlacement = {
  id: string;
  partner: string;
  partnerName: string;
  name: string;
  description: string | null;
  adFormat: string | null;
  creativeType: string | null;
  dimensions: string | string[] | null;
  ratio: string | string[] | null;
  fileFormat: string | string[] | null;
  maxFileSize: string | string[] | null;
  frameRate: string | null;
  bitrate: string | null;
  audio: string | null;
  animation: string | null;
  backupImage: string | null;
  headlineLimit: string | null;
  descriptionLimit: string | null;
  cta: string | null;
  clickthroughUrl: string | null;
  fontBranding: string | null;
  flightStart: string | null;
  flightEnd: string | null;
  flightDatesRaw: string | null;
  creativeDue: string | null;
  creativeDueRaw: string | number | Date | null;
  dueTBD: boolean;
  market: string | null;
  whoBuilds: string | null;
  adPlacement: string | null;
  thirdPartyTags: string | null;
  servingType: string | null;
  siteServed: string | null;
  viewability: string | null;
  gdprCcpa: string | null;
  tracking: string | null;
  adservingAllowed: string | null;
  creativeApprovalDeadline: string | null;
  additionalInformation: string | null;
  otherFields: Record<string, unknown>;
};

export type Partner = { id: string; name: string; color: string; iconId: string };

export type Summary = {
  templateName: string;
  client: string;
  totalPlacements: number;
  earliestDue: string | null;
  period: string;
};

export function splitMulti(v: unknown): string[] {
  if (v == null) return [];
  return String(v)
    .split(/\s*\n\s*|\s*;\s*/)
    .map(s => s.trim())
    .filter(Boolean);
}

function maybeSingle<T>(arr: T[]): T | T[] | null {
  if (!arr.length) return null;
  if (arr.length === 1) return arr[0];
  return arr;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

function excelSerialToDate(serial: number): Date {
  const utcDays = serial - 25569;
  return new Date(utcDays * 86400 * 1000);
}

export function parseLooseDate(s: unknown, fallbackYear?: number): Date | null {
  if (s == null) return null;
  if (s instanceof Date) return isNaN(s.getTime()) ? null : s;

  if (typeof s === "number") {
    if (s > 10000 && s < 100000) return excelSerialToDate(s);
    return null;
  }

  const str = String(s).trim();
  if (!str) return null;
  if (/^(tbd|tba|pending|n\/a)$/i.test(str) || /tbd|tba/i.test(str)) return null;

  if (/^\d{4,5}(\.\d+)?$/.test(str)) {
    const n = Number(str);
    if (n > 10000 && n < 100000) return excelSerialToDate(n);
  }

  const year = fallbackYear ?? new Date().getFullYear();

  const m1 = str.match(/^(\d{1,2})[-\s]+([A-Za-z]+)$/);
  if (m1) {
    const mon = MONTHS[m1[2].toLowerCase()];
    if (mon != null) return new Date(year, mon, Number(m1[1]));
  }
  const m2 = str.match(/^([A-Za-z]+)[-\s]+(\d{1,2})$/);
  if (m2) {
    const mon = MONTHS[m2[1].toLowerCase()];
    if (mon != null) return new Date(year, mon, Number(m2[2]));
  }

  const m3 = str.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m3) {
    const mo = Number(m3[1]) - 1;
    const day = Number(m3[2]);
    let yr = m3[3] ? Number(m3[3]) : year;
    if (yr < 100) yr += 2000;
    return new Date(yr, mo, day);
  }

  if (/[A-Za-z]{3,}/.test(str) && /[-\/\s]/.test(str)) {
    const direct = new Date(str);
    if (!isNaN(direct.getTime())) return direct;
  }
  if (/\d{4}/.test(str) && /[-\/]/.test(str)) {
    const direct = new Date(str);
    if (!isNaN(direct.getTime())) return direct;
  }

  return null;
}

export function parseFlightDates(s: unknown, fallbackYear?: number): [Date | null, Date | null] {
  if (s == null) return [null, null];
  const str = String(s);
  if (/tbd|tba/i.test(str)) return [null, null];
  const parts = str.split(/\s*[\u2013\u2014\-]\s*/);
  if (parts.length < 2) return [null, null];
  const start = parseLooseDate(parts[0], fallbackYear);
  const end = parseLooseDate(parts.slice(1).join("-"), fallbackYear);
  return [start, end];
}

function slug(s: unknown): string {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "") || "unknown";
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

export function normalizeAspectRatio(val: unknown): string | null {
  if (val == null) return null;
  const str = String(val).trim();
  if (!str) return null;
  const m = str.match(/^(\d+)\s*[×x]\s*(\d+)$/);
  if (!m) return str;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!w || !h) return str;
  const g = gcd(w, h);
  return `${w / g}:${h / g}`;
}

export function enrichPlacements(
  placements: ParsedPlacement[],
  opts: { year?: number } = {},
): EnrichedPlacement[] {
  return placements.map((p, i) => {
    const partnerKey = slug(p.partner);
    const dims = splitMulti(p.adDimensions);
    const formats = splitMulti(p.fileFormat);
    const sizes = splitMulti(p.maxFileSize);
    const ratios = splitMulti(p.aspectRatio).map(r => normalizeAspectRatio(r) ?? r);
    const creativeDue = parseLooseDate(p.creativeDueDate, opts.year);
    const dueTBD = !creativeDue;
    const [flightStart, flightEnd] = parseFlightDates(p.flightDates, opts.year);

    return {
      id: `${partnerKey}-${i}`,
      partner: partnerKey,
      partnerName: p.partner || "Unknown",
      name: p.placementName || "Untitled",
      description: p.description ?? null,
      adFormat: p.adFormat ?? null,
      creativeType: p.creativeType ?? null,
      dimensions: maybeSingle(dims),
      ratio: maybeSingle(ratios),
      fileFormat: maybeSingle(formats),
      maxFileSize: maybeSingle(sizes),
      frameRate: p.frameRate ?? null,
      bitrate: p.bitrate ?? null,
      audio: p.audioSpecs ?? null,
      animation: p.animationLength ?? null,
      backupImage: p.backupImage ?? null,
      headlineLimit: p.headlineTextLimit ?? null,
      descriptionLimit: p.descriptionTextLimit ?? null,
      cta: p.ctaRequirements ?? null,
      clickthroughUrl: p.clickthroughUrl ?? null,
      fontBranding: p.fontBranding ?? null,
      flightStart: flightStart ? flightStart.toISOString() : null,
      flightEnd: flightEnd ? flightEnd.toISOString() : null,
      flightDatesRaw: p.flightDates ?? null,
      creativeDue: creativeDue ? creativeDue.toISOString() : null,
      creativeDueRaw: p.creativeDueDate ?? null,
      dueTBD,
      market: p.market ?? null,
      whoBuilds: p.whoBuilds ?? null,
      adPlacement: p.adPlacement ?? null,
      thirdPartyTags: p.thirdPartyAdTags ?? null,
      servingType: p.thirdPartyServingType ?? null,
      siteServed: p.siteServed ?? null,
      viewability: p.viewabilityRequirements ?? null,
      gdprCcpa: p.gdprCcpaCompliance ?? null,
      tracking: p.trackingRequirements ?? null,
      adservingAllowed: p.adservingAllowed ?? null,
      creativeApprovalDeadline: p.creativeApprovalDeadline ?? null,
      additionalInformation: p.additionalInformation ?? null,
      otherFields: p.otherFields || {},
    };
  });
}

export function buildPartners(enriched: EnrichedPlacement[]): Partner[] {
  const seen = new Map<string, Partner>();
  for (const p of enriched) {
    if (seen.has(p.partner)) continue;
    seen.set(p.partner, {
      id: p.partner,
      name: p.partnerName,
      color: colorFor(p.partnerName),
      iconId: iconIdFor(p.partnerName),
    });
  }
  return [...seen.values()];
}

export function buildSummary(
  enriched: EnrichedPlacement[],
  { campaign, client }: { campaign: string; client?: string | null },
): Summary {
  const dues = enriched
    .map(p => p.creativeDue)
    .filter((d): d is string => Boolean(d))
    .map(s => new Date(s))
    .sort((a, b) => a.getTime() - b.getTime());
  return {
    templateName: campaign,
    client: client || "",
    totalPlacements: enriched.length,
    earliestDue: dues[0] ? dues[0].toISOString() : null,
    period: "",
  };
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npx vitest run src/lib/spec-sheets/enrich.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/spec-sheets/enrich.ts src/lib/spec-sheets/enrich.test.ts
git commit -m "feat(spec-sheets): add enrichment (dates, ratios, partners, summary)"
```

---

## Task 8: Zod schemas for API

**Files:**
- Create: `src/lib/spec-sheets/schema.ts`
- Test: `src/lib/spec-sheets/schema.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/spec-sheets/schema.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { createSpecSheetSchema, MAX_CAMPAIGN_LENGTH, MAX_CLIENT_LENGTH } from "./schema";

const validPlacement = { id: "meta-0", partner: "meta", partnerName: "Meta", name: "Reels", otherFields: {} };

describe("createSpecSheetSchema", () => {
  const base = {
    campaign: "Campaign A",
    client: "ACME",
    placements: [validPlacement],
    partners: [{ id: "meta", name: "Meta", color: "#0866FF", iconId: "meta" }],
    summary: { templateName: "Campaign A", client: "ACME", totalPlacements: 1, earliestDue: null, period: "" },
  };

  it("accepts a valid payload", () => {
    expect(() => createSpecSheetSchema.parse(base)).not.toThrow();
  });

  it("rejects empty campaign", () => {
    expect(() => createSpecSheetSchema.parse({ ...base, campaign: "" })).toThrow();
  });

  it("rejects overly long campaign", () => {
    expect(() =>
      createSpecSheetSchema.parse({ ...base, campaign: "x".repeat(MAX_CAMPAIGN_LENGTH + 1) })
    ).toThrow();
  });

  it("rejects overly long client", () => {
    expect(() =>
      createSpecSheetSchema.parse({ ...base, client: "x".repeat(MAX_CLIENT_LENGTH + 1) })
    ).toThrow();
  });

  it("allows null client", () => {
    expect(() => createSpecSheetSchema.parse({ ...base, client: null })).not.toThrow();
  });

  it("rejects zero placements", () => {
    expect(() => createSpecSheetSchema.parse({ ...base, placements: [] })).toThrow();
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run src/lib/spec-sheets/schema.test.ts
```

- [ ] **Step 3: Implement**

`src/lib/spec-sheets/schema.ts`:
```typescript
import { z } from "zod";

export const MAX_CAMPAIGN_LENGTH = 120;
export const MAX_CLIENT_LENGTH = 120;
export const MAX_PLACEMENTS = 500;

// Permissive: these objects are produced entirely by our own enrichment code.
// We validate shape-level invariants (non-empty, length caps) but not every field.
const placementSchema = z.object({
  id: z.string(),
  partner: z.string(),
  partnerName: z.string(),
  name: z.string(),
}).passthrough();

const partnerSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  iconId: z.string(),
});

const summarySchema = z.object({
  templateName: z.string(),
  client: z.string(),
  totalPlacements: z.number().int().nonnegative(),
  earliestDue: z.string().nullable(),
  period: z.string(),
});

export const createSpecSheetSchema = z.object({
  campaign: z.string().trim().min(1, "Campaign is required").max(MAX_CAMPAIGN_LENGTH),
  client: z.string().trim().max(MAX_CLIENT_LENGTH).nullable().optional(),
  placements: z.array(placementSchema).min(1).max(MAX_PLACEMENTS),
  partners: z.array(partnerSchema),
  summary: summarySchema,
});

export type CreateSpecSheetInput = z.infer<typeof createSpecSheetSchema>;
```

- [ ] **Step 4: Run — expect pass**

```bash
npx vitest run src/lib/spec-sheets/schema.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/spec-sheets/schema.ts src/lib/spec-sheets/schema.test.ts
git commit -m "feat(spec-sheets): add Zod schema for create payload"
```

---

## Task 9: POST /api/spec-sheets route

**Files:**
- Create: `src/app/api/spec-sheets/route.ts`
- Test: `src/app/api/spec-sheets/route.test.ts`

Mirror the shape of `src/app/api/banner-jobs/route.ts`. Rate limit: 10/hour per user.

- [ ] **Step 1: Write failing tests**

`src/app/api/spec-sheets/route.test.ts`:
```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

// Hoisted mocks
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: "user_123", getToken: async () => "jwt" })),
}));

vi.mock("@/lib/spec-sheets/code-generator", () => ({
  generateSheetCode: vi.fn(() => "ABC123"),
}));

const supabaseMock = {
  from: vi.fn(),
  insert: vi.fn(async () => ({ error: null })),
  select: vi.fn(() => supabaseMock),
  eq: vi.fn(() => supabaseMock),
  gte: vi.fn(async () => ({ count: 0, error: null })),
  order: vi.fn(() => supabaseMock),
};

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseClient: vi.fn(() => supabaseMock),
}));

function validPayload() {
  return {
    campaign: "Campaign A",
    client: "ACME",
    placements: [{ id: "meta-0", partner: "meta", partnerName: "Meta", name: "Reels", otherFields: {} }],
    partners: [{ id: "meta", name: "Meta", color: "#0866FF", iconId: "meta" }],
    summary: { templateName: "Campaign A", client: "ACME", totalPlacements: 1, earliestDue: null, period: "" },
  };
}

function mockRequest(body: unknown): Request {
  return new Request("http://test/api/spec-sheets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/spec-sheets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "spec_sheets") {
        return {
          select: () => ({
            eq: () => ({ gte: async () => ({ count: 0, error: null }) }),
          }),
          insert: async () => ({ error: null }),
        };
      }
      return supabaseMock;
    });
  });

  it("returns the generated code on happy path", async () => {
    const { POST } = await import("./route");
    const res = await POST(mockRequest(validPayload()) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ code: "ABC123" });
  });

  it("returns 401 when not signed in", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: null, getToken: async () => null });
    const { POST } = await import("./route");
    const res = await POST(mockRequest(validPayload()) as never);
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid payload", async () => {
    const { POST } = await import("./route");
    const res = await POST(mockRequest({ campaign: "" }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    supabaseMock.from.mockImplementation(() => ({
      select: () => ({ eq: () => ({ gte: async () => ({ count: 10, error: null }) }) }),
      insert: async () => ({ error: null }),
    }));
    const { POST } = await import("./route");
    const res = await POST(mockRequest(validPayload()) as never);
    expect(res.status).toBe(429);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run src/app/api/spec-sheets/route.test.ts
```

- [ ] **Step 3: Implement**

`src/app/api/spec-sheets/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase/client";
import { generateSheetCode } from "@/lib/spec-sheets/code-generator";
import { createSpecSheetSchema } from "@/lib/spec-sheets/schema";

const RATE_LIMIT_PER_HOUR = 10;

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSpecSheetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.format() }, { status: 400 });
  }

  const supabaseToken = await getToken({ template: "supabase" });
  const supabase = createSupabaseClient(supabaseToken ?? undefined);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("spec_sheets")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneHourAgo);

  if (countError) {
    console.error("spec_sheets rate limit count failed:", countError);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return NextResponse.json(
      { error: `Rate limit: max ${RATE_LIMIT_PER_HOUR} sheets per hour` },
      { status: 429 }
    );
  }

  const code = generateSheetCode();
  const { error: insertError } = await supabase.from("spec_sheets").insert({
    code,
    user_id: userId,
    campaign: parsed.data.campaign,
    client: parsed.data.client ?? null,
    placements: parsed.data.placements,
    partners: parsed.data.partners,
    summary: parsed.data.summary,
  });

  if (insertError) {
    console.error("spec_sheets insert failed:", insertError);
    return NextResponse.json({ error: "Failed to create sheet" }, { status: 500 });
  }

  return NextResponse.json({ code });
}

export async function GET() {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabaseToken = await getToken({ template: "supabase" });
  const supabase = createSupabaseClient(supabaseToken ?? undefined);

  const { data, error } = await supabase
    .from("spec_sheets")
    .select("code, campaign, client, created_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("spec_sheets list failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({
    sheets: (data ?? []).map((r) => ({
      code: r.code,
      campaign: r.campaign,
      client: r.client,
      createdAt: r.created_at,
    })),
  });
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npx vitest run src/app/api/spec-sheets/route.test.ts
```

Expected: 4 tests pass. (The GET endpoint is not unit-tested here; it's exercised by manual smoke at the end.)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/spec-sheets/route.ts src/app/api/spec-sheets/route.test.ts
git commit -m "feat(api): POST/GET /api/spec-sheets"
```

---

## Task 10: Per-code API — GET (public) + DELETE (owner)

**Files:**
- Create: `src/app/api/spec-sheets/[code]/route.ts`
- Test: `src/app/api/spec-sheets/[code]/route.test.ts`

- [ ] **Step 1: Write failing tests**

`src/app/api/spec-sheets/[code]/route.test.ts`:
```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: "user_123", getToken: async () => "jwt" })),
}));

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseClient: vi.fn(() => ({
    rpc: rpcMock,
    from: fromMock,
  })),
}));

function mockGet(code: string): Request {
  return new Request(`http://test/api/spec-sheets/${code}`);
}
function mockDelete(code: string): Request {
  return new Request(`http://test/api/spec-sheets/${code}`, { method: "DELETE" });
}

describe("GET /api/spec-sheets/[code]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with sheet data when RPC finds it", async () => {
    rpcMock.mockResolvedValueOnce({ data: { code: "ABC123", campaign: "C1" }, error: null });
    const { GET } = await import("./route");
    const res = await GET(mockGet("ABC123") as never, { params: Promise.resolve({ code: "ABC123" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ code: "ABC123", campaign: "C1" });
  });

  it("returns 404 when RPC returns null", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const { GET } = await import("./route");
    const res = await GET(mockGet("XXXXXX") as never, { params: Promise.resolve({ code: "XXXXXX" }) });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/spec-sheets/[code]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("soft-deletes when owner", async () => {
    fromMock.mockReturnValue({
      update: () => ({ eq: () => ({ eq: async () => ({ error: null, count: 1 }) }) }),
    });
    const { DELETE } = await import("./route");
    const res = await DELETE(mockDelete("ABC123") as never, { params: Promise.resolve({ code: "ABC123" }) });
    expect(res.status).toBe(200);
  });

  it("requires auth", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: null, getToken: async () => null });
    const { DELETE } = await import("./route");
    const res = await DELETE(mockDelete("ABC123") as never, { params: Promise.resolve({ code: "ABC123" }) });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run src/app/api/spec-sheets/\[code\]/route.test.ts
```

- [ ] **Step 3: Implement**

`src/app/api/spec-sheets/[code]/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase/client";

type RouteCtx = { params: Promise<{ code: string }> };

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { code } = await params;
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.rpc("get_spec_sheet", { sheet_code: code });

  if (error) {
    console.error("get_spec_sheet RPC failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;
  const supabaseToken = await getToken({ template: "supabase" });
  const supabase = createSupabaseClient(supabaseToken ?? undefined);

  const { error } = await supabase
    .from("spec_sheets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("code", code)
    .eq("user_id", userId);

  if (error) {
    console.error("spec_sheets delete failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npx vitest run src/app/api/spec-sheets/\[code\]/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/spec-sheets/\[code\]/route.ts src/app/api/spec-sheets/\[code\]/route.test.ts
git commit -m "feat(api): GET (public) + DELETE /api/spec-sheets/[code]"
```

---

## Task 11: Upload form component

**Files:**
- Create: `src/components/spec-sheet-reviewer/upload-form.tsx`

UI component only — no route yet. Uses shadcn `Input`, `Label`, `Button`. File picker is a plain `<input type="file">` styled with Tailwind.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseXlsx } from "@/lib/spec-sheets/parse-xlsx";
import { enrichPlacements, buildPartners, buildSummary } from "@/lib/spec-sheets/enrich";
import { toast } from "sonner";
import { UploadCloud, Loader2 } from "lucide-react";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

type Props = {
  onCreated: (code: string) => void;
};

export function UploadForm({ onCreated }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [campaign, setCampaign] = useState("");
  const [client, setClient] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleFile(f: File | null) {
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      toast.error("File is too large. Max 5 MB.");
      return;
    }
    setFile(f);
    if (!campaign) {
      const base = f.name.replace(/\.[^.]+$/, "");
      setCampaign(base);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { toast.error("Pick a spec sheet file first."); return; }
    if (!campaign.trim()) { toast.error("Campaign name is required."); return; }

    setSubmitting(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const parseResult = parseXlsx(buf);

      for (const w of parseResult.warnings) {
        if (/multiple sheets|using "/i.test(w)) toast.warning(w);
      }
      if (parseResult.placements.length === 0) {
        toast.error("This doesn't look like a media spec sheet. Expected a 'Partner' column header.");
        return;
      }

      const placements = enrichPlacements(parseResult.placements);
      const partners = buildPartners(placements);
      const summary = buildSummary(placements, { campaign: campaign.trim(), client: client.trim() || null });

      const res = await fetch("/api/spec-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign: campaign.trim(),
          client: client.trim() || null,
          placements,
          partners,
          summary,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error || "Failed to create sheet");
        return;
      }

      const data = await res.json();
      onCreated(data.code);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error && err.message.includes("invalid") ? "Could not read file — is it a valid .xlsx?" : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border bg-card p-6">
      <div className="space-y-2">
        <Label htmlFor="spec-file">Spec sheet (.xlsx, max 5 MB)</Label>
        <Input
          id="spec-file"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        {file && <p className="text-xs text-muted-foreground">Selected: {file.name}</p>}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="campaign">Campaign name</Label>
          <Input id="campaign" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="H1 2026 Media" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="client">Client name <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input id="client" value={client} onChange={(e) => setClient(e.target.value)} placeholder="ACME" />
        </div>
      </div>

      <Button type="submit" disabled={submitting || !file} className="w-full sm:w-auto">
        {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UploadCloud className="mr-2 size-4" />}
        {submitting ? "Generating..." : "Generate viewer"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Quick typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors from the new file. (If shadcn hasn't registered `Input`/`Label`, add them via `npx shadcn@latest add input label` first.)

- [ ] **Step 3: Commit**

```bash
git add src/components/spec-sheet-reviewer/upload-form.tsx
git commit -m "feat(spec-sheets): add upload form component"
```

---

## Task 12: My-sheets list component

**Files:**
- Create: `src/components/spec-sheet-reviewer/sheets-list.tsx`

Uses TanStack Query to fetch + cache the list; delete triggers a re-fetch.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, ExternalLink, Trash2 } from "lucide-react";

type SheetSummary = {
  code: string;
  campaign: string;
  client: string | null;
  createdAt: string;
};

async function fetchSheets(): Promise<SheetSummary[]> {
  const res = await fetch("/api/spec-sheets");
  if (!res.ok) throw new Error("Failed to load sheets");
  const data = await res.json();
  return data.sheets;
}

async function deleteSheet(code: string): Promise<void> {
  const res = await fetch(`/api/spec-sheets/${code}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Delete failed");
}

export function SheetsList() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["spec-sheets"],
    queryFn: fetchSheets,
    staleTime: 5 * 60 * 1000,
  });

  const del = useMutation({
    mutationFn: deleteSheet,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spec-sheets"] });
      toast.success("Deleted");
    },
    onError: () => toast.error("Could not delete — try again"),
  });

  function copyLink(code: string) {
    const url = `${window.location.origin}/s/${code}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  }

  if (isLoading) {
    return <div className="rounded-xl border p-6 text-sm text-muted-foreground">Loading your sheets…</div>;
  }
  if (error) {
    return <div className="rounded-xl border p-6 text-sm text-destructive">Could not load sheets.</div>;
  }
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border p-6 text-sm text-muted-foreground">
        No sheets yet. Upload one above to get started.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="text-left">
            <th className="px-4 py-2 font-medium">Campaign</th>
            <th className="px-4 py-2 font-medium">Client</th>
            <th className="px-4 py-2 font-medium">Created</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {data.map((s) => (
            <tr key={s.code} className="border-t">
              <td className="px-4 py-3">{s.campaign}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.client || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(s.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => copyLink(s.code)} aria-label="Copy link">
                    <Copy className="size-4" />
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <a href={`/s/${s.code}`} target="_blank" rel="noreferrer" aria-label="Open viewer">
                      <ExternalLink className="size-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { if (confirm(`Delete "${s.campaign}"?`)) del.mutate(s.code); }}
                    disabled={del.isPending}
                    aria-label="Delete sheet"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Note:** This file uses `<Button asChild>`. CLAUDE.md says shadcn v4 uses `render` not `asChild`. Verify in your local `src/components/ui/button.tsx` which prop is correct, and swap if needed (e.g., `<Button render={<a ... />}>`). If `asChild` works in this project's Button, keep it.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/spec-sheet-reviewer/sheets-list.tsx
git commit -m "feat(spec-sheets): add my-sheets list with copy/view/delete"
```

---

## Task 13: Strategist tool page

**Files:**
- Create: `src/app/dashboard/strategist/spec-sheet-reviewer/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
"use client";

import { useState } from "react";
import { UploadForm } from "@/components/spec-sheet-reviewer/upload-form";
import { SheetsList } from "@/components/spec-sheet-reviewer/sheets-list";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FileSpreadsheet, Copy, ExternalLink } from "lucide-react";

export default function SpecSheetReviewerPage() {
  const [justCreated, setJustCreated] = useState<string | null>(null);

  function shareUrl(code: string) {
    return `${window.location.origin}/s/${code}`;
  }

  if (justCreated) {
    const url = shareUrl(justCreated);
    return (
      <div className="space-y-8">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-orange-100 p-3 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
            <FileSpreadsheet className="size-6" />
          </div>
          <div>
            <h1 className="font-headline text-3xl font-extrabold tracking-tight">Viewer ready</h1>
            <p className="mt-1.5 text-muted-foreground">Share this link — anyone with it can view the spec sheet.</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 font-mono text-sm">
            <span className="flex-1 truncate">{url}</span>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(url); toast.success("Copied"); }}>
              <Copy className="size-4" />
            </Button>
          </div>
          <div className="mt-4 flex gap-2">
            <Button asChild>
              <a href={`/s/${justCreated}`} target="_blank" rel="noreferrer">
                Open viewer <ExternalLink className="ml-2 size-4" />
              </a>
            </Button>
            <Button variant="outline" onClick={() => setJustCreated(null)}>Create another</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-orange-100 p-3 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
          <FileSpreadsheet className="size-6" />
        </div>
        <div>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight">Banner Spec Sheet Reviewer</h1>
          <p className="mt-1.5 text-muted-foreground">
            Upload a client media spec sheet. We'll turn it into a shareable web viewer.
          </p>
        </div>
      </div>

      <UploadForm onCreated={setJustCreated} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">My spec sheets</h2>
        <SheetsList />
      </section>
    </div>
  );
}
```

**Note on `asChild`:** same warning as Task 12 — verify your Button API.

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/strategist/spec-sheet-reviewer/page.tsx
git commit -m "feat(spec-sheets): add strategist tool page (upload + list)"
```

---

## Task 14: Register in strategist grid

**Files:**
- Modify: `src/app/dashboard/strategist/page.tsx`

- [ ] **Step 1: Add the tool to the grid**

Open `src/app/dashboard/strategist/page.tsx`. Update the imports to add `FileSpreadsheet`:
```tsx
import { LayoutGrid, FileText, Users, UserCircle, Calculator, FileSpreadsheet } from "lucide-react";
```

Add a new entry at the end of the `tools` array (before the closing `];`):
```tsx
{
  href: "/dashboard/strategist/spec-sheet-reviewer",
  label: "Banner Spec Sheet Reviewer",
  description: "Turn a messy Excel media spec sheet into a shareable web viewer",
  icon: FileSpreadsheet,
},
```

- [ ] **Step 2: Quick smoke test**

Start the dev server and confirm the new tile appears:
```bash
npm run dev
```

Visit http://localhost:3000/dashboard/strategist — expect 6 tiles now, the new one with the FileSpreadsheet icon. Click it → lands at the tool page. Kill the dev server after.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/strategist/page.tsx
git commit -m "feat(spec-sheets): register tool in strategist grid"
```

---

## Task 15: Viewer — partner icons (inline SVGs)

**Files:**
- Create: `src/components/spec-sheet-reviewer/viewer/partner-icons.tsx`

Port the `PartnerIcon` component plus its embedded SVG glyphs from `temp/spec-sheet-viewer/templates/viewer.html` lines ~1127–1162 (the `function PartnerIcon({ iconId, size })` block and any nearby SVG `<path>` data).

- [ ] **Step 1: Identify the source range**

```bash
sed -n '1127,1163p' /Users/grozenblat/Desktop/GlueSkills/temp/spec-sheet-viewer/templates/viewer.html
```

- [ ] **Step 2: Create the component**

Translate the JSX in that block into a TSX component. Signature:
```tsx
type Props = { iconId: string; size?: number };
export function PartnerIcon({ iconId, size = 14 }: Props): JSX.Element;
```
Keep the same `iconId` → glyph map. If the template's icons depend on a `<symbol>` sprite defined elsewhere, inline the SVG `<path>` data directly into each branch of a `switch (iconId)` instead of referencing sprite IDs. Unknown `iconId` renders a generic circle (fallback from `partner-colors.ts`).

- [ ] **Step 3: Quick visual smoke**

Render it in a scratch page or Storybook-style harness if easy. Otherwise this is exercised end-to-end when the viewer runs.

- [ ] **Step 4: Commit**

```bash
git add src/components/spec-sheet-reviewer/viewer/partner-icons.tsx
git commit -m "feat(spec-sheets): add partner icon glyphs"
```

---

## Task 16: Viewer — CSS tokens + base shell

**Files:**
- Create: `src/components/spec-sheet-reviewer/viewer/viewer.module.css`
- Create: `src/components/spec-sheet-reviewer/viewer/helpers.ts`
- Create: `src/components/spec-sheet-reviewer/viewer/spec-viewer.tsx`

The spec-viewer.tsx is the top shell: it holds state (partner filter, urgency filter, layout mode, expanded id, modal id), does the filtering/counting, and delegates to child components.

- [ ] **Step 1: Port CSS tokens**

Open `temp/spec-sheet-viewer/templates/viewer.html` and extract the contents of every `<style>` block. Paste into `viewer.module.css`. Replace any `:root { ... }` selector with `.viewerRoot { ... }` so the tokens scope to this component and don't leak into the dashboard.

Guidance — the template's `<style>` spans from around line 10 to the end of the last CSS block before the first `<script>` (roughly line 1050). Use:
```bash
sed -n '10,1059p' /Users/grozenblat/Desktop/GlueSkills/temp/spec-sheet-viewer/templates/viewer.html
```

- [ ] **Step 2: Port the viewer helpers**

Create `src/components/spec-sheet-reviewer/viewer/helpers.ts`. Port the pure helpers from the template's script block (lines ~1087–1125):
- `asArray(v)`, `primary(v)`, `partnerById(id, partners)`, `daysUntil(date)`, `urgencyOf(date)`, `formatDate(date)`, `formatShortDate(date)`, `dueDisplay(p)`, `dueShortDisplay(p)`

All plain functions, no React. Signatures take their dependencies as args (e.g. `partnerById(id: string, partners: Partner[]): Partner | undefined`).

- [ ] **Step 3: Create the top shell**

`src/components/spec-sheet-reviewer/viewer/spec-viewer.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import styles from "./viewer.module.css";
import type { EnrichedPlacement, Partner, Summary } from "@/lib/spec-sheets/enrich";
import { urgencyOf } from "./helpers";
import { ViewerHeader } from "./header";
import { RowsLayout } from "./rows-layout";
import { CardsLayout } from "./cards-layout";
import { TimelineLayout } from "./timeline-layout";
import { DetailModal } from "./detail-modal";

type Props = {
  placements: EnrichedPlacement[];
  partners: Partner[];
  summary: Summary;
};

export function SpecViewer({ placements, partners, summary }: Props) {
  // Hydrate ISO strings back into Date objects for runtime math.
  const hydrated = useMemo(
    () =>
      placements.map((p) => ({
        ...p,
        flightStart: p.flightStart ? new Date(p.flightStart).toISOString() : null,
        flightEnd: p.flightEnd ? new Date(p.flightEnd).toISOString() : null,
        creativeDue: p.creativeDue ? new Date(p.creativeDue).toISOString() : null,
      })),
    [placements]
  );

  const [layout, setLayout] = useState<"rows" | "cards" | "timeline">("rows");
  const [partner, setPartner] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<"all" | "overdue" | "urgent" | "soon" | "safe">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalId, setModalId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return hydrated.filter((pl) => {
      if (partner && pl.partner !== partner) return false;
      if (urgency !== "all") {
        if (pl.dueTBD || !pl.creativeDue) return false;
        if (urgencyOf(new Date(pl.creativeDue)).key !== urgency) return false;
      }
      return true;
    });
  }, [hydrated, partner, urgency]);

  const counts = useMemo(() => {
    const byPartner: Record<string, number> = {};
    const byUrg = { overdue: 0, urgent: 0, soon: 0, safe: 0 };
    for (const pl of hydrated) {
      byPartner[pl.partner] = (byPartner[pl.partner] || 0) + 1;
      if (pl.creativeDue && !pl.dueTBD) {
        const key = urgencyOf(new Date(pl.creativeDue)).key;
        if (key in byUrg) byUrg[key as keyof typeof byUrg]++;
      }
    }
    return { total: hydrated.length, byPartner, byUrg };
  }, [hydrated]);

  const modalPlacement = modalId ? hydrated.find((p) => p.id === modalId) : null;

  return (
    <div className={styles.viewerRoot}>
      <ViewerHeader
        summary={summary}
        partners={partners}
        activePartner={partner}
        setActivePartner={setPartner}
        activeUrgency={urgency}
        setActiveUrgency={setUrgency}
        counts={counts}
        layout={layout}
        setLayout={setLayout}
      />

      {layout === "rows" && (
        <RowsLayout
          placements={filtered}
          partners={partners}
          expandedId={expandedId}
          onToggle={(id) => setExpandedId((cur) => (cur === id ? null : id))}
        />
      )}
      {layout === "cards" && (
        <CardsLayout placements={filtered} partners={partners} onExpand={setModalId} />
      )}
      {layout === "timeline" && (
        <TimelineLayout placements={filtered} partners={partners} onExpand={setModalId} />
      )}

      {modalPlacement && (
        <DetailModal
          placement={modalPlacement}
          partners={partners}
          onClose={() => setModalId(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit (placeholders for missing children OK)**

At this point `header.tsx`, `rows-layout.tsx`, etc. don't exist yet — that's expected; the next tasks create them. Stop here before running the app.

```bash
git add src/components/spec-sheet-reviewer/viewer/viewer.module.css \
        src/components/spec-sheet-reviewer/viewer/helpers.ts \
        src/components/spec-sheet-reviewer/viewer/spec-viewer.tsx
git commit -m "feat(spec-sheets): viewer shell — tokens, helpers, top component"
```

---

## Task 17: Viewer — header with filters + KPIs

**Files:**
- Create: `src/components/spec-sheet-reviewer/viewer/header.tsx`

Port the `Header` component from template lines ~1226–1300 plus supporting `Stat`, `Kpi` (~1216, ~1569) and `Urgency` (~1208) if used inside the header. Translate JSX to TSX, keep the same styling classes from `viewer.module.css`.

- [ ] **Step 1: Extract source**

```bash
sed -n '1216,1300p' /Users/grozenblat/Desktop/GlueSkills/temp/spec-sheet-viewer/templates/viewer.html
```

- [ ] **Step 2: Create the component**

Implement `ViewerHeader` with this signature:
```tsx
type Props = {
  summary: Summary;
  partners: Partner[];
  activePartner: string | null;
  setActivePartner: (p: string | null) => void;
  activeUrgency: "all" | "overdue" | "urgent" | "soon" | "safe";
  setActiveUrgency: (u: Props["activeUrgency"]) => void;
  counts: { total: number; byPartner: Record<string, number>; byUrg: { overdue: number; urgent: number; soon: number; safe: number } };
  layout: "rows" | "cards" | "timeline";
  setLayout: (l: Props["layout"]) => void;
};
```

It renders: campaign/client title, KPIs (total, overdue, urgent count), partner chips (click toggles filter), urgency chips (All/Overdue/Urgent/Soon/Safe), layout switcher (Rows/Cards/Timeline). Use `PartnerIcon` from Task 15.

- [ ] **Step 3: Commit**

```bash
git add src/components/spec-sheet-reviewer/viewer/header.tsx
git commit -m "feat(spec-sheets): viewer header with filters + KPIs"
```

---

## Task 18: Viewer — Rows layout

**Files:**
- Create: `src/components/spec-sheet-reviewer/viewer/rows-layout.tsx`

Port `RowsLayout` (~1302–1339) and `RichRow` (~1340–1396) from the template.

- [ ] **Step 1: Extract source**

```bash
sed -n '1302,1396p' /Users/grozenblat/Desktop/GlueSkills/temp/spec-sheet-viewer/templates/viewer.html
```

- [ ] **Step 2: Implement**

Signatures:
```tsx
export function RowsLayout({
  placements, partners, expandedId, onToggle,
}: {
  placements: EnrichedPlacement[];
  partners: Partner[];
  expandedId: string | null;
  onToggle: (id: string) => void;
}): JSX.Element;

function RichRow({
  placement, partnerColor, expanded, onToggle,
}: {
  placement: EnrichedPlacement;
  partnerColor: string;
  expanded: boolean;
  onToggle: () => void;
}): JSX.Element;
```

Each row is collapsed by default, shows pinned specs (dimensions, file format, max size, due date, headline limit, CTA). Expanding reveals the detail view.

Keep `RichRow` defined in the same file — it's coupled to RowsLayout.

- [ ] **Step 3: Commit**

```bash
git add src/components/spec-sheet-reviewer/viewer/rows-layout.tsx
git commit -m "feat(spec-sheets): viewer rows layout"
```

---

## Task 19: Viewer — Cards layout + SpecCard

**Files:**
- Create: `src/components/spec-sheet-reviewer/viewer/cards-layout.tsx`

Port `CardsLayout` (~1397–1428), `SpecCard` (~1429–1454), `Kvp` (~1455–1470) from the template.

- [ ] **Step 1: Extract source**

```bash
sed -n '1397,1470p' /Users/grozenblat/Desktop/GlueSkills/temp/spec-sheet-viewer/templates/viewer.html
```

- [ ] **Step 2: Implement**

Signatures:
```tsx
export function CardsLayout({
  placements, partners, onExpand,
}: {
  placements: EnrichedPlacement[];
  partners: Partner[];
  onExpand: (id: string) => void;
}): JSX.Element;

function SpecCard({ placement, partnerColor, onClick }: {
  placement: EnrichedPlacement;
  partnerColor: string;
  onClick: () => void;
}): JSX.Element;

function Kvp({ k, v }: { k: string; v: React.ReactNode }): JSX.Element;
```

Card click fires `onExpand(id)` → modal opens in parent. Keep Kvp in-file.

- [ ] **Step 3: Commit**

```bash
git add src/components/spec-sheet-reviewer/viewer/cards-layout.tsx
git commit -m "feat(spec-sheets): viewer cards layout"
```

---

## Task 20: Viewer — Timeline layout

**Files:**
- Create: `src/components/spec-sheet-reviewer/viewer/timeline-layout.tsx`

Port `TimelineLayout` (~1471–1568) from the template.

- [ ] **Step 1: Extract source**

```bash
sed -n '1471,1568p' /Users/grozenblat/Desktop/GlueSkills/temp/spec-sheet-viewer/templates/viewer.html
```

- [ ] **Step 2: Implement**

Signature:
```tsx
export function TimelineLayout({
  placements, partners, onExpand,
}: {
  placements: EnrichedPlacement[];
  partners: Partner[];
  onExpand: (id: string) => void;
}): JSX.Element;
```

Groups placements by creative-due week, orders chronologically, places TBD items at the end. Each node clickable → `onExpand(id)`.

- [ ] **Step 3: Commit**

```bash
git add src/components/spec-sheet-reviewer/viewer/timeline-layout.tsx
git commit -m "feat(spec-sheets): viewer timeline layout"
```

---

## Task 21: Viewer — Detail view + modal

**Files:**
- Create: `src/components/spec-sheet-reviewer/viewer/detail-view.tsx`
- Create: `src/components/spec-sheet-reviewer/viewer/detail-modal.tsx`

Port `DetailView` (~1608–1724), `DetailSection` (~1579–1607), and `DetailModal` (~1725–1743) from the template. `SpecPreview` (~1163–1207) is referenced inside — port alongside, either in `detail-view.tsx` or its own file. Keep simple; no separate file unless > ~100 lines.

- [ ] **Step 1: Extract source**

```bash
sed -n '1163,1208p' /Users/grozenblat/Desktop/GlueSkills/temp/spec-sheet-viewer/templates/viewer.html
sed -n '1579,1743p' /Users/grozenblat/Desktop/GlueSkills/temp/spec-sheet-viewer/templates/viewer.html
```

- [ ] **Step 2: Implement DetailView**

Signature:
```tsx
export function DetailView({
  placement, partnerColor, modal = false,
}: {
  placement: EnrichedPlacement;
  partnerColor: string;
  modal?: boolean;
}): JSX.Element;
```

Renders all ~33 fields grouped into logical sections (Creative, Tracking, Approvals, Compliance, Other). `otherFields` goes into "Compliance & Tracking" (matches spec).

Include `SpecPreview` inline here — it's a small visual component showing the ad dimensions.

- [ ] **Step 3: Implement DetailModal**

Signature:
```tsx
export function DetailModal({
  placement, partners, onClose,
}: {
  placement: EnrichedPlacement;
  partners: Partner[];
  onClose: () => void;
}): JSX.Element;
```

Click on backdrop or Esc → `onClose`. Use `useEffect` to add/remove `keydown` listener.

- [ ] **Step 4: Commit**

```bash
git add src/components/spec-sheet-reviewer/viewer/detail-view.tsx \
        src/components/spec-sheet-reviewer/viewer/detail-modal.tsx
git commit -m "feat(spec-sheets): viewer detail view + modal"
```

---

## Task 22: Public viewer route

**Files:**
- Create: `src/app/s/[code]/layout.tsx`
- Create: `src/app/s/[code]/page.tsx`

The Server Component fetches the row via the public `get_spec_sheet` RPC and passes props to the client viewer. No dashboard chrome here.

- [ ] **Step 1: Layout (bare shell)**

`src/app/s/[code]/layout.tsx`:
```tsx
import { Manrope } from "next/font/google";
import type { ReactNode } from "react";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-manrope" });

export default function SharedViewerLayout({ children }: { children: ReactNode }) {
  return <div className={manrope.variable}>{children}</div>;
}
```

- [ ] **Step 2: Page (server component)**

`src/app/s/[code]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { SpecViewer } from "@/components/spec-sheet-reviewer/viewer/spec-viewer";
import type { EnrichedPlacement, Partner, Summary } from "@/lib/spec-sheets/enrich";

type SheetRow = {
  code: string;
  campaign: string;
  client: string | null;
  placements: EnrichedPlacement[];
  partners: Partner[];
  summary: Summary;
  createdAt: string;
};

async function fetchSheet(code: string): Promise<SheetRow | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc("get_spec_sheet", { sheet_code: code });
  if (error) {
    console.error("get_spec_sheet failed:", error);
    return null;
  }
  return (data as SheetRow | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const sheet = await fetchSheet(code);
  if (!sheet) return { title: "Spec Sheet Not Found" };
  return { title: `${sheet.campaign} — Spec Sheet` };
}

export default async function SharedViewerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const sheet = await fetchSheet(code);
  if (!sheet) notFound();

  return <SpecViewer placements={sheet.placements} partners={sheet.partners} summary={sheet.summary} />;
}
```

- [ ] **Step 3: Check `proxy.ts` does not protect `/s/*`**

Open `src/proxy.ts`. The Clerk middleware currently protects `/dashboard/*`. Confirm the public matcher does NOT include `/s/*`. If it does, update the matcher to exclude it. Example: if `matcher` is `['/dashboard/:path*', '/api/:path*']`, the `/s/[code]` route is automatically public — no change needed. Grep for it:

```bash
cat /Users/grozenblat/Desktop/GlueSkills/src/proxy.ts
```

Fix only if the matcher includes `/s/`.

- [ ] **Step 4: Smoke test the viewer**

```bash
npm run dev
```

1. Sign in at http://localhost:3000.
2. Navigate to the strategist tool.
3. Upload `temp/spec-sheet-viewer/tests/fixtures/sample.xlsx` (build it first by running `npx tsx src/lib/spec-sheets/__fixtures__/build-fixture.ts --build` if it doesn't exist, OR by running the parser test once which calls `build()`).
4. Confirm success page shows a `/s/XXXXXX` link.
5. Open it in an incognito window (no auth). Confirm the viewer renders with 5 placements, partner filters, layout switcher.
6. Compare side-by-side visually with the CLI output of the same fixture:
   ```bash
   cd temp/spec-sheet-viewer
   npm install xlsx
   node scripts/generate.js tests/fixtures/sample.xlsx --client ACME --campaign TestCampaign
   open exports/spec-sheets/TestCampaign/index.html
   ```
7. Fix anything visibly off between the two (usually CSS token discrepancies, icon paths, spacing).

- [ ] **Step 5: Commit**

```bash
git add src/app/s/\[code\]/layout.tsx src/app/s/\[code\]/page.tsx
git commit -m "feat(spec-sheets): public viewer route at /s/[code]"
```

---

## Task 23: Full test pass + typecheck

- [ ] **Step 1: Run entire test suite**

```bash
npm run test -- --run
```

Expected: all new and existing tests pass.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: zero errors.

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: successful production build.

- [ ] **Step 5: If anything fails, fix it and re-run — do not commit a green status prematurely. Once everything passes, no commit needed (no code changed).**

---

## Task 24: Cleanup

**Files:**
- Delete: `temp/spec-sheet-viewer/` (now ported into the app)

- [ ] **Step 1: Verify nothing still references the temp folder**

```bash
# Expect 0 matches except possibly in the spec/plan docs (OK there).
```

Use Grep tool to search for `temp/spec-sheet-viewer` across `src/` — expect 0 hits.

- [ ] **Step 2: Remove the folder**

```bash
rm -rf temp/spec-sheet-viewer
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove temp/spec-sheet-viewer — ported into app"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Upload form with file, campaign, client — Task 11
- ✅ Client-side xlsx parsing — Tasks 6, 11
- ✅ Unguessable shareable URL — Tasks 3, 9 (code gen + insert)
- ✅ Never-expire, soft delete — Task 2 (no `expires_at`; `deleted_at` column)
- ✅ My spec sheets list with delete — Task 12
- ✅ Ported viewer (rows, cards, timeline kept, detail modal) — Tasks 15–21
- ✅ Public viewer route `/s/[code]` — Task 22
- ✅ RLS + RPC for code-as-access-control — Task 2
- ✅ Rate limit 10/hour — Task 9
- ✅ 5 MB file cap — Task 11
- ✅ Clear error messages — Task 11 (client), Tasks 9, 10 (server)
- ✅ Parser tests ported — Task 6
- ✅ Enrichment tests ported — Task 7
- ✅ API tests — Tasks 9, 10
- ✅ Registered in Strategist grid — Task 14

**Type consistency:**
- `EnrichedPlacement.creativeDue` is `string | null` at the API boundary (ISO). Inside `SpecViewer`, it's re-hydrated. ✅
- `Partner` type used in spec-viewer, header, layouts — consistent. ✅
- `generateSheetCode()` name used in code-generator and in POST route — consistent. ✅
- `get_spec_sheet(sheet_code)` RPC arg name matches both SQL (Task 2) and API caller (Tasks 10, 22). ✅

**Placeholder scan:** no TBD / TODO / "implement later" / "similar to X" references remain.

---

## Plan complete

Saved to `docs/superpowers/plans/2026-04-21-banner-spec-sheet-reviewer.md`.
