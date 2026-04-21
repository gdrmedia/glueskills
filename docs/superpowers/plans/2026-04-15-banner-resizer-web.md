# Banner Resizer Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the GlueSkills web side of the Banner Resizer feature — a wizard at `/dashboard/designer/banner-resizer` that lets a designer pick target IAB banner sizes, generates a 6-character pickup code, and stores the job config in Supabase for the Figma plugin to consume.

**Architecture:** Single-page Next.js wizard backed by one Supabase table (`banner_jobs`) with a Postgres RPC for atomic plugin consumption. Authenticated user creates a job via `POST /api/banner-jobs`; an hourly Vercel cron at `GET /api/banner-jobs/cleanup` deletes expired/old rows. Plugin reads via `consume_banner_job(text)` RPC (later — separate plan).

**Tech Stack:** Next.js 16 App Router, TypeScript, Clerk auth, Supabase (`@supabase/supabase-js` already installed), Tailwind v4, shadcn v4 (base-ui). New deps: `vitest`, `@vitest/ui`, `zod`, `nanoid`, `qrcode.react`. Existing: feedback API and scrape API are reference patterns for `auth()` + `NextRequest`/`NextResponse`.

**Spec:** `docs/superpowers/specs/2026-04-15-banner-resizer-design.md`

---

## File Structure

**Created:**
- `supabase/migrations/003_banner_jobs.sql` — table, indexes, RLS, RPC
- `vercel.json` — cron config
- `vitest.config.ts` — test runner
- `src/lib/banner-jobs/iab-sizes.ts` — IAB preset catalog + `IabSize` type
- `src/lib/banner-jobs/iab-sizes.test.ts`
- `src/lib/banner-jobs/code-generator.ts` — `generateJobCode()`
- `src/lib/banner-jobs/code-generator.test.ts`
- `src/lib/banner-jobs/job-config.ts` — `BannerJobConfig` zod schema + `validateConfig()`
- `src/lib/banner-jobs/job-config.test.ts`
- `src/lib/banner-jobs/format-countdown.ts` — `formatCountdown()` for the expiry timer
- `src/lib/banner-jobs/format-countdown.test.ts`
- `src/app/api/banner-jobs/route.ts` — POST create
- `src/app/api/banner-jobs/route.test.ts`
- `src/app/api/banner-jobs/cleanup/route.ts` — GET cron
- `src/components/banner-resizer/size-picker.tsx`
- `src/components/banner-resizer/job-name-input.tsx`
- `src/components/banner-resizer/options-form.tsx`
- `src/components/banner-resizer/code-display.tsx`
- `src/app/dashboard/designer/banner-resizer/page.tsx` — wizard
- `src/app/dashboard/designer/banner-resizer/confirmation.tsx` — post-submit screen

**Modified:**
- `package.json` — add deps + test scripts
- `src/lib/supabase/types.ts` — append `BannerJob` type
- `src/app/dashboard/designer/page.tsx` — add the 9th tile

---

## Task 1: Add testing framework (Vitest)

The repo has no test runner. Vitest is the natural choice for Vite-style TS projects and works fine alongside Next.js for unit + lib tests.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest @vitest/ui
```

Expected: vitest packages added to `devDependencies`, no errors.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: Add test scripts to `package.json`**

In the `scripts` block, add (preserving the existing scripts):

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify Vitest runs (with no tests yet)**

Run: `npm test`
Expected: Vitest reports "No test files found" and exits with code 1. That's expected — confirms it ran.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "test: add Vitest as the test runner"
```

---

## Task 2: Add feature dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime deps**

```bash
npm install zod nanoid qrcode.react
```

Expected: three packages added to `dependencies`, no errors.

- [ ] **Step 2: Verify TypeScript types resolve**

Run: `npx tsc --noEmit`
Expected: no errors related to the new packages (`zod`, `nanoid`, `qrcode.react` all ship their own types).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add zod, nanoid, qrcode.react for banner resizer"
```

---

## Task 3: Supabase migration — `banner_jobs` table + RPC

This adds the data layer. The RPC `consume_banner_job(text)` is what the Figma plugin will call (atomically marks a job consumed and returns its config).

**Files:**
- Create: `supabase/migrations/003_banner_jobs.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Banner Resizer: job storage table + plugin-consumption RPC
-- See: docs/superpowers/specs/2026-04-15-banner-resizer-design.md

create table if not exists banner_jobs (
  code           text primary key,
  user_id        text not null,
  name           text not null,
  config         jsonb not null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default (now() + interval '24 hours'),
  consumed_at    timestamptz
);

create index if not exists idx_banner_jobs_user_id on banner_jobs(user_id);
create index if not exists idx_banner_jobs_expires_at on banner_jobs(expires_at);

alter table banner_jobs enable row level security;

-- Web side: authenticated Clerk users can manage their own rows
create policy "Users insert their own banner jobs"
  on banner_jobs for insert
  with check (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

create policy "Users select their own banner jobs"
  on banner_jobs for select
  using (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

create policy "Users update their own banner jobs"
  on banner_jobs for update
  using (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

create policy "Users delete their own banner jobs"
  on banner_jobs for delete
  using (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

-- Plugin side: anon role calls this RPC, which is security-definer so it bypasses RLS.
-- The 6-char code is the bearer token.
create or replace function consume_banner_job(job_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  job_row banner_jobs;
  upper_code text;
begin
  upper_code := upper(job_code);

  select * into job_row from banner_jobs where code = upper_code;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  if job_row.expires_at < now() then
    return jsonb_build_object('error', 'expired');
  end if;

  -- Idempotency: re-fetch within 5 min of first consumption is OK; after that, locked.
  if job_row.consumed_at is not null and job_row.consumed_at < now() - interval '5 minutes' then
    return jsonb_build_object('error', 'already_used');
  end if;

  update banner_jobs
    set consumed_at = coalesce(consumed_at, now())  -- preserve original timestamp
    where code = upper_code;

  return jsonb_build_object(
    'name', job_row.name,
    'config', job_row.config
  );
end;
$$;

revoke all on function consume_banner_job(text) from public;
grant execute on function consume_banner_job(text) to anon;
grant execute on function consume_banner_job(text) to authenticated;

-- Cleanup RPC for the hourly Vercel cron. Bypasses RLS so it can delete any
-- expired or stale-consumed row, regardless of which user owns it.
create or replace function cleanup_banner_jobs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count int;
  consumed_count int;
begin
  with del as (
    delete from banner_jobs where expires_at < now() returning 1
  )
  select count(*) into expired_count from del;

  with del as (
    delete from banner_jobs where consumed_at < now() - interval '7 days' returning 1
  )
  select count(*) into consumed_count from del;

  return jsonb_build_object(
    'deletedExpired', expired_count,
    'deletedConsumed', consumed_count
  );
end;
$$;

revoke all on function cleanup_banner_jobs() from public;
grant execute on function cleanup_banner_jobs() to anon;
grant execute on function cleanup_banner_jobs() to authenticated;
```

> **On security:** The RPC is granted to `anon` so the cleanup cron route (which uses the anon client) can call it. This means any HTTP caller could in theory invoke the RPC directly via Supabase's REST endpoint — but the only side effect is deleting *already-expired* rows. There's nothing to leak and no destructive surface beyond what the cron does on schedule. The `CRON_SECRET` on the Vercel route is the user-facing access gate; the public RPC is a deliberate trade-off for MVP simplicity over a separate service-role-key flow.

- [ ] **Step 2: Apply the migration in Supabase**

Open the Supabase project dashboard → SQL Editor → New query → paste the contents of `003_banner_jobs.sql` → Run.

Expected: "Success. No rows returned." Verify by running:
```sql
select code, name from banner_jobs limit 1;
```
Should return zero rows but no error.

- [ ] **Step 3: Smoke-test the RPC in the SQL editor**

```sql
-- Insert a fake job (bypasses RLS in SQL editor)
insert into banner_jobs (code, user_id, name, config) values
  ('TEST01', 'fake_user', 'Test Job', '{"version":1,"targets":[],"options":{"placeOnNewPage":true,"namingPattern":"size-job"}}'::jsonb);

-- Call the RPC
select consume_banner_job('test01');
-- Expected: {"name": "Test Job", "config": {...}}

-- Call again (within 5 min, should still work)
select consume_banner_job('TEST01');
-- Expected: same result

-- Cleanup
delete from banner_jobs where code = 'TEST01';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/003_banner_jobs.sql
git commit -m "feat: add banner_jobs table + consume RPC migration"
```

---

## Task 4: IAB sizes catalog

Pure data + types. The wizard imports this list to build the checkbox UI.

**Files:**
- Create: `src/lib/banner-jobs/iab-sizes.ts`
- Create: `src/lib/banner-jobs/iab-sizes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/banner-jobs/iab-sizes.test.ts
import { describe, expect, it } from "vitest";
import { IAB_SIZES, IAB_GROUPS } from "./iab-sizes";

describe("IAB_SIZES", () => {
  it("contains all 14 standard IAB sizes from the spec", () => {
    expect(IAB_SIZES).toHaveLength(14);
  });

  it("includes the Medium Rectangle (300x250)", () => {
    const mediumRect = IAB_SIZES.find((s) => s.width === 300 && s.height === 250);
    expect(mediumRect).toBeDefined();
    expect(mediumRect?.label).toBe("Medium Rectangle");
    expect(mediumRect?.group).toBe("desktop");
  });

  it("includes the Mobile Banner (320x50)", () => {
    const mobile = IAB_SIZES.find((s) => s.width === 320 && s.height === 50);
    expect(mobile?.group).toBe("mobile");
  });

  it("has all sizes with positive dimensions and a non-empty label", () => {
    for (const size of IAB_SIZES) {
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
      expect(size.label.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate sizes", () => {
    const keys = IAB_SIZES.map((s) => `${s.width}x${s.height}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("IAB_GROUPS", () => {
  it("has exactly the three groups: desktop, mobile, square", () => {
    expect(Object.keys(IAB_GROUPS).sort()).toEqual(["desktop", "mobile", "square"]);
  });
});
```

- [ ] **Step 2: Run the test (expect failure)**

Run: `npm test src/lib/banner-jobs/iab-sizes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the catalog**

```ts
// src/lib/banner-jobs/iab-sizes.ts
export type IabGroup = "desktop" | "mobile" | "square";

export type IabSize = {
  width: number;
  height: number;
  label: string;
  group: IabGroup;
};

export const IAB_GROUPS: Record<IabGroup, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  square: "Square",
};

export const IAB_SIZES: IabSize[] = [
  // Desktop (8)
  { width: 300, height: 250, label: "Medium Rectangle", group: "desktop" },
  { width: 336, height: 280, label: "Large Rectangle", group: "desktop" },
  { width: 728, height: 90, label: "Leaderboard", group: "desktop" },
  { width: 970, height: 90, label: "Large Leaderboard", group: "desktop" },
  { width: 970, height: 250, label: "Billboard", group: "desktop" },
  { width: 300, height: 600, label: "Half Page", group: "desktop" },
  { width: 160, height: 600, label: "Wide Skyscraper", group: "desktop" },
  { width: 120, height: 600, label: "Skyscraper", group: "desktop" },
  // Mobile (4)
  { width: 320, height: 50, label: "Mobile Banner", group: "mobile" },
  { width: 320, height: 100, label: "Large Mobile Banner", group: "mobile" },
  { width: 300, height: 50, label: "Mobile Leaderboard", group: "mobile" },
  { width: 468, height: 60, label: "Banner", group: "mobile" },
  // Square (2)
  { width: 250, height: 250, label: "Square", group: "square" },
  { width: 200, height: 200, label: "Small Square", group: "square" },
];
```

- [ ] **Step 4: Run the test (expect pass)**

Run: `npm test src/lib/banner-jobs/iab-sizes.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/banner-jobs/iab-sizes.ts src/lib/banner-jobs/iab-sizes.test.ts
git commit -m "feat: add IAB Standard banner size catalog"
```

---

## Task 5: Job code generator

Generates 6-char codes using a custom alphabet that excludes ambiguous chars (`0`, `O`, `I`, `1`).

**Files:**
- Create: `src/lib/banner-jobs/code-generator.ts`
- Create: `src/lib/banner-jobs/code-generator.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/banner-jobs/code-generator.test.ts
import { describe, expect, it } from "vitest";
import { generateJobCode, JOB_CODE_ALPHABET, JOB_CODE_LENGTH } from "./code-generator";

describe("generateJobCode", () => {
  it(`returns a string of length ${6}`, () => {
    const code = generateJobCode();
    expect(code).toHaveLength(JOB_CODE_LENGTH);
    expect(JOB_CODE_LENGTH).toBe(6);
  });

  it("only uses characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateJobCode();
      for (const char of code) {
        expect(JOB_CODE_ALPHABET).toContain(char);
      }
    }
  });

  it("never includes ambiguous characters (0, O, I, 1, l)", () => {
    for (const banned of ["0", "O", "I", "1", "L"]) {
      expect(JOB_CODE_ALPHABET).not.toContain(banned);
    }
  });

  it("returns uppercase only", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateJobCode();
      expect(code).toBe(code.toUpperCase());
    }
  });

  it("produces low collision rate over 5,000 codes", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      codes.add(generateJobCode());
    }
    // With 30^6 = ~729M possibilities, 5000 codes should have ~0 collisions
    expect(codes.size).toBeGreaterThanOrEqual(4999);
  });
});
```

- [ ] **Step 2: Run the test (expect failure)**

Run: `npm test src/lib/banner-jobs/code-generator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the generator**

```ts
// src/lib/banner-jobs/code-generator.ts
import { customAlphabet } from "nanoid";

// 30 chars: A-Z minus I, O, L  +  2-9 (no 0, no 1)
export const JOB_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const JOB_CODE_LENGTH = 6;

const generator = customAlphabet(JOB_CODE_ALPHABET, JOB_CODE_LENGTH);

export function generateJobCode(): string {
  return generator();
}
```

- [ ] **Step 4: Run the test (expect pass)**

Run: `npm test src/lib/banner-jobs/code-generator.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/banner-jobs/code-generator.ts src/lib/banner-jobs/code-generator.test.ts
git commit -m "feat: add job code generator with unambiguous alphabet"
```

---

## Task 6: Job config zod schema

Defines and validates the `BannerJobConfig` shape. This is the contract shared with the Figma plugin (mirrored as a TS type in the plugin repo).

**Files:**
- Create: `src/lib/banner-jobs/job-config.ts`
- Create: `src/lib/banner-jobs/job-config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/banner-jobs/job-config.test.ts
import { describe, expect, it } from "vitest";
import { bannerJobConfigSchema, jobNameSchema, MAX_TARGETS, MIN_DIMENSION, MAX_DIMENSION } from "./job-config";

describe("bannerJobConfigSchema", () => {
  const validConfig = {
    version: 1 as const,
    targets: [
      { width: 300, height: 250, label: "Medium Rectangle", isCustom: false },
      { width: 728, height: 90, isCustom: false },
    ],
    options: {
      placeOnNewPage: true,
      namingPattern: "size-job" as const,
    },
  };

  it("accepts a valid config", () => {
    expect(() => bannerJobConfigSchema.parse(validConfig)).not.toThrow();
  });

  it("rejects empty targets array", () => {
    expect(() => bannerJobConfigSchema.parse({ ...validConfig, targets: [] })).toThrow();
  });

  it(`rejects more than ${MAX_TARGETS} targets`, () => {
    const tooMany = Array.from({ length: MAX_TARGETS + 1 }, (_, i) => ({
      width: 100 + i,
      height: 100,
      isCustom: true,
    }));
    expect(() => bannerJobConfigSchema.parse({ ...validConfig, targets: tooMany })).toThrow();
  });

  it("rejects target dimensions below the minimum", () => {
    const tooSmall = { ...validConfig, targets: [{ width: MIN_DIMENSION - 1, height: 100, isCustom: true }] };
    expect(() => bannerJobConfigSchema.parse(tooSmall)).toThrow();
  });

  it("rejects target dimensions above the maximum", () => {
    const tooBig = { ...validConfig, targets: [{ width: MAX_DIMENSION + 1, height: 100, isCustom: true }] };
    expect(() => bannerJobConfigSchema.parse(tooBig)).toThrow();
  });

  it("rejects unknown namingPattern values", () => {
    const bad = { ...validConfig, options: { ...validConfig.options, namingPattern: "weird" } };
    expect(() => bannerJobConfigSchema.parse(bad)).toThrow();
  });

  it("rejects version != 1", () => {
    expect(() => bannerJobConfigSchema.parse({ ...validConfig, version: 2 })).toThrow();
  });

  it("rejects non-integer dimensions", () => {
    const fractional = { ...validConfig, targets: [{ width: 300.5, height: 250, isCustom: true }] };
    expect(() => bannerJobConfigSchema.parse(fractional)).toThrow();
  });
});

describe("jobNameSchema", () => {
  it("accepts a 1-80 char name", () => {
    expect(() => jobNameSchema.parse("Q2 Spring Campaign")).not.toThrow();
    expect(() => jobNameSchema.parse("X")).not.toThrow();
    expect(() => jobNameSchema.parse("X".repeat(80))).not.toThrow();
  });

  it("rejects empty / whitespace-only names", () => {
    expect(() => jobNameSchema.parse("")).toThrow();
    expect(() => jobNameSchema.parse("   ")).toThrow();
  });

  it("rejects names longer than 80 chars", () => {
    expect(() => jobNameSchema.parse("X".repeat(81))).toThrow();
  });
});
```

- [ ] **Step 2: Run the test (expect failure)**

Run: `npm test src/lib/banner-jobs/job-config.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the schema**

```ts
// src/lib/banner-jobs/job-config.ts
import { z } from "zod";

export const MAX_TARGETS = 20;
export const MIN_DIMENSION = 50;
export const MAX_DIMENSION = 4000;
export const MAX_JOB_NAME_LENGTH = 80;

export const jobNameSchema = z
  .string()
  .trim()
  .min(1, "Job name is required")
  .max(MAX_JOB_NAME_LENGTH, `Job name must be ${MAX_JOB_NAME_LENGTH} characters or fewer`);

const targetSchema = z.object({
  width: z.number().int().min(MIN_DIMENSION).max(MAX_DIMENSION),
  height: z.number().int().min(MIN_DIMENSION).max(MAX_DIMENSION),
  label: z.string().optional(),
  isCustom: z.boolean(),
});

const optionsSchema = z.object({
  placeOnNewPage: z.boolean(),
  namingPattern: z.enum(["size", "size-job", "size-source"]),
});

export const bannerJobConfigSchema = z.object({
  version: z.literal(1),
  targets: z.array(targetSchema).min(1).max(MAX_TARGETS),
  options: optionsSchema,
});

export type BannerJobConfig = z.infer<typeof bannerJobConfigSchema>;
export type BannerJobTarget = z.infer<typeof targetSchema>;
export type BannerJobOptions = z.infer<typeof optionsSchema>;
```

- [ ] **Step 4: Run the test (expect pass)**

Run: `npm test src/lib/banner-jobs/job-config.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Add `BannerJob` row type to shared Supabase types**

Open `src/lib/supabase/types.ts` and append:

```ts
export type BannerJob = {
  code: string;
  user_id: string;
  name: string;
  config: unknown;        // validated by zod at the boundary, kept loose here
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
};
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/banner-jobs/job-config.ts src/lib/banner-jobs/job-config.test.ts src/lib/supabase/types.ts
git commit -m "feat: add BannerJobConfig zod schema and types"
```

---

## Task 7: Countdown formatter

Pure helper used by the confirmation screen's expiry timer.

**Files:**
- Create: `src/lib/banner-jobs/format-countdown.ts`
- Create: `src/lib/banner-jobs/format-countdown.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/banner-jobs/format-countdown.test.ts
import { describe, expect, it } from "vitest";
import { formatCountdown } from "./format-countdown";

describe("formatCountdown", () => {
  it("formats hours and minutes when over an hour", () => {
    expect(formatCountdown(3 * 3600 * 1000 + 17 * 60 * 1000)).toBe("3h 17m");
  });

  it("formats minutes and seconds when under an hour", () => {
    expect(formatCountdown(45 * 60 * 1000 + 12 * 1000)).toBe("45m 12s");
  });

  it("formats just seconds when under a minute", () => {
    expect(formatCountdown(42 * 1000)).toBe("42s");
  });

  it("returns 'Expired' for zero or negative values", () => {
    expect(formatCountdown(0)).toBe("Expired");
    expect(formatCountdown(-1000)).toBe("Expired");
  });

  it("pads single-digit minutes/seconds when paired with a larger unit", () => {
    expect(formatCountdown(3600 * 1000 + 5 * 60 * 1000)).toBe("1h 05m");
    expect(formatCountdown(60 * 1000 + 7 * 1000)).toBe("1m 07s");
  });
});
```

- [ ] **Step 2: Run the test (expect failure)**

Run: `npm test src/lib/banner-jobs/format-countdown.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the formatter**

```ts
// src/lib/banner-jobs/format-countdown.ts
export function formatCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return "Expired";
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}
```

- [ ] **Step 4: Run the test (expect pass)**

Run: `npm test src/lib/banner-jobs/format-countdown.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/banner-jobs/format-countdown.ts src/lib/banner-jobs/format-countdown.test.ts
git commit -m "feat: add countdown formatter for banner job expiry"
```

---

## Task 8: POST `/api/banner-jobs` route

Creates a job, enforces rate limit, returns the code.

**Files:**
- Create: `src/app/api/banner-jobs/route.ts`
- Create: `src/app/api/banner-jobs/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/banner-jobs/route.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Mock Clerk auth
const mockGetToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

// Mock Supabase
const mockInsert = vi.fn();
const mockCount = vi.fn();
const mockFrom = vi.fn(() => ({
  insert: (...args: unknown[]) => mockInsert(...args),
  select: () => ({
    eq: () => ({
      gte: () => mockCount(),
    }),
  }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseClient: () => ({ from: mockFrom }),
}));

import { POST } from "./route";
import { auth } from "@clerk/nextjs/server";

const validBody = {
  name: "Test Campaign",
  config: {
    version: 1,
    targets: [{ width: 300, height: 250, label: "Medium Rectangle", isCustom: false }],
    options: { placeOnNewPage: true, namingPattern: "size-job" },
  },
};

function buildRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/banner-jobs", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetToken.mockResolvedValue("fake.jwt.token");
  vi.mocked(auth).mockResolvedValue({ userId: "user_123", getToken: mockGetToken } as never);
  mockCount.mockResolvedValue({ count: 0, error: null });
  mockInsert.mockResolvedValue({ error: null });
});

describe("POST /api/banner-jobs", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid config", async () => {
    const res = await POST(buildRequest({ name: "Test", config: { version: 1, targets: [], options: {} } }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid name", async () => {
    const res = await POST(buildRequest({ ...validBody, name: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 429 when user has 10+ jobs in the last hour", async () => {
    mockCount.mockResolvedValue({ count: 10, error: null });
    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(429);
  });

  it("returns 200 with a code on success", async () => {
    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(json.expiresAt).toBeTypeOf("string");
  });

  it("inserts the row with the user's Clerk ID", async () => {
    await POST(buildRequest(validBody));
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0][0];
    expect(inserted.user_id).toBe("user_123");
    expect(inserted.name).toBe("Test Campaign");
    expect(inserted.config).toEqual(validBody.config);
    expect(inserted.code).toMatch(/^[A-Z2-9]{6}$/);
  });

  it("returns 500 if Supabase insert fails", async () => {
    mockInsert.mockResolvedValue({ error: { message: "db down" } });
    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run the test (expect failure)**

Run: `npm test src/app/api/banner-jobs/route.test.ts`
Expected: FAIL — route not found.

- [ ] **Step 3: Implement the route**

```ts
// src/app/api/banner-jobs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase/client";
import { generateJobCode } from "@/lib/banner-jobs/code-generator";
import { bannerJobConfigSchema, jobNameSchema } from "@/lib/banner-jobs/job-config";

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

  const { name, config } = (body ?? {}) as { name?: unknown; config?: unknown };

  const nameResult = jobNameSchema.safeParse(name);
  if (!nameResult.success) {
    return NextResponse.json({ error: "Invalid name", issues: nameResult.error.format() }, { status: 400 });
  }
  const configResult = bannerJobConfigSchema.safeParse(config);
  if (!configResult.success) {
    return NextResponse.json({ error: "Invalid config", issues: configResult.error.format() }, { status: 400 });
  }

  // Use Clerk's Supabase JWT so RLS sees the user_id claim and allows the insert.
  const supabaseToken = await getToken({ template: "supabase" });
  const supabase = createSupabaseClient(supabaseToken ?? undefined);

  // Rate limit: 10 jobs per user per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("banner_jobs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneHourAgo);

  if (countError) {
    console.error("rate limit count failed:", countError);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return NextResponse.json(
      { error: `Rate limit: max ${RATE_LIMIT_PER_HOUR} jobs per hour` },
      { status: 429 }
    );
  }

  const code = generateJobCode();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error: insertError } = await supabase.from("banner_jobs").insert({
    code,
    user_id: userId,
    name: nameResult.data,
    config: configResult.data,
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error("banner_jobs insert failed:", insertError);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }

  return NextResponse.json({ code, expiresAt });
}
```

- [ ] **Step 4: Run the test (expect pass)**

Run: `npm test src/app/api/banner-jobs/route.test.ts`
Expected: PASS, 7 tests.

> **Note:** The route fetches a Clerk-issued Supabase JWT (`getToken({ template: "supabase" })`) and passes it to the Supabase client. This is the same pattern used client-side in `src/lib/supabase/use-supabase.ts`. The JWT carries the Clerk `userId` as the `sub` claim, which the RLS policies in Task 3 read via `current_setting('request.jwt.claims', true)::json->>'sub'`.
>
> **Prerequisite:** A "supabase" JWT template must exist in the Clerk dashboard (Configure → Sessions → JWT templates), with the signing algorithm and signing key matching what Supabase expects. The existing inspiration tool already relies on this template, so it should be configured. If the smoke test in Task 16 fails with RLS errors, verify the template exists.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/banner-jobs/route.ts src/app/api/banner-jobs/route.test.ts
git commit -m "feat: add POST /api/banner-jobs create route"
```

---

## Task 9: GET `/api/banner-jobs/cleanup` cron route + `vercel.json`

Hourly job that deletes expired and old-consumed rows.

**Files:**
- Create: `src/app/api/banner-jobs/cleanup/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Implement the cron route**

```ts
// src/app/api/banner-jobs/cleanup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/client";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The cleanup RPC is `security definer`, so it bypasses RLS and can purge
  // any user's expired rows. We call it via the anon client — the cron secret
  // above is what gates access, not Supabase auth.
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc("cleanup_banner_jobs");

  if (error) {
    console.error("cleanup_banner_jobs RPC failed:", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

> **Note:** The RPC `cleanup_banner_jobs()` was added in Task 3's migration and granted to the `anon` role so this route can call it via the anon client. See the security note in Task 3 for why this is acceptable for MVP.

- [ ] **Step 2: Create `vercel.json` with the cron config**

```json
{
  "crons": [
    { "path": "/api/banner-jobs/cleanup", "schedule": "0 * * * *" }
  ]
}
```

> **Note:** Vercel automatically attaches an `Authorization: Bearer ${CRON_SECRET}` header when invoking a cron, IF you set `CRON_SECRET` in the project's environment variables. Set it in the Vercel dashboard → Project Settings → Environment Variables (production + preview). Use a long random string (`openssl rand -base64 32`).

- [ ] **Step 3: Manual smoke test (locally with curl)**

Add `CRON_SECRET=local-dev-secret` to `.env.local`, then:

```bash
npm run dev
# in another terminal:
curl -i -H "Authorization: Bearer local-dev-secret" http://localhost:3000/api/banner-jobs/cleanup
```

Expected: `200 OK` with JSON `{"deletedExpired":0,"deletedConsumed":0}`.

Without the header:
```bash
curl -i http://localhost:3000/api/banner-jobs/cleanup
```
Expected: `401`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/banner-jobs/cleanup/route.ts vercel.json
git commit -m "feat: add hourly cleanup cron for expired banner jobs"
```

---

## Task 10: SizePicker component

Renders the IAB checkboxes grouped, plus the custom-size add form, plus the live counter / max-20 cap.

**Files:**
- Create: `src/components/banner-resizer/size-picker.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// src/components/banner-resizer/size-picker.tsx
"use client";

import { useState } from "react";
import { IAB_SIZES, IAB_GROUPS, type IabGroup, type IabSize } from "@/lib/banner-jobs/iab-sizes";
import { MAX_TARGETS, MIN_DIMENSION, MAX_DIMENSION, type BannerJobTarget } from "@/lib/banner-jobs/job-config";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

export type SizePickerProps = {
  selected: BannerJobTarget[];
  onChange: (next: BannerJobTarget[]) => void;
};

function targetKey(t: { width: number; height: number }): string {
  return `${t.width}x${t.height}`;
}

export function SizePicker({ selected, onChange }: SizePickerProps) {
  const [customW, setCustomW] = useState("");
  const [customH, setCustomH] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);

  const selectedKeys = new Set(selected.map(targetKey));
  const atMax = selected.length >= MAX_TARGETS;

  function togglePreset(size: IabSize) {
    const key = targetKey(size);
    if (selectedKeys.has(key)) {
      onChange(selected.filter((t) => targetKey(t) !== key));
    } else {
      if (atMax) return;
      onChange([
        ...selected,
        { width: size.width, height: size.height, label: size.label, isCustom: false },
      ]);
    }
  }

  function addCustom() {
    setCustomError(null);
    const w = Number(customW);
    const h = Number(customH);
    if (!Number.isInteger(w) || !Number.isInteger(h)) {
      setCustomError("Width and height must be whole numbers.");
      return;
    }
    if (w < MIN_DIMENSION || h < MIN_DIMENSION) {
      setCustomError(`Minimum ${MIN_DIMENSION}px per side.`);
      return;
    }
    if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
      setCustomError(`Maximum ${MAX_DIMENSION}px per side.`);
      return;
    }
    if (selectedKeys.has(targetKey({ width: w, height: h }))) {
      setCustomError("That size is already added.");
      return;
    }
    if (atMax) {
      setCustomError(`Maximum ${MAX_TARGETS} sizes per job.`);
      return;
    }
    onChange([...selected, { width: w, height: h, isCustom: true }]);
    setCustomW("");
    setCustomH("");
  }

  function removeTarget(t: BannerJobTarget) {
    onChange(selected.filter((s) => targetKey(s) !== targetKey(t)));
  }

  const groups = (Object.keys(IAB_GROUPS) as IabGroup[]).map((g) => ({
    group: g,
    label: IAB_GROUPS[g],
    sizes: IAB_SIZES.filter((s) => s.group === g),
  }));

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.group}>
          <h3 className="mb-3 text-sm font-semibold tracking-tight">{group.label}</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {group.sizes.map((s) => {
              const checked = selectedKeys.has(targetKey(s));
              const disabled = !checked && atMax;
              return (
                <label
                  key={`${s.width}x${s.height}`}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition ${
                    checked ? "border-purple-500 bg-purple-500/5" : "border-border bg-card"
                  } ${disabled ? "cursor-not-allowed opacity-50" : "hover:border-purple-400"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => togglePreset(s)}
                    className="h-4 w-4"
                  />
                  <span className="font-mono">{s.width}×{s.height}</span>
                  <span className="text-muted-foreground">{s.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-tight">Custom size</h3>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="custom-w" className="text-xs">Width</Label>
            <Input
              id="custom-w"
              type="number"
              inputMode="numeric"
              placeholder="e.g. 480"
              value={customW}
              onChange={(e) => setCustomW(e.target.value)}
              className="w-28"
            />
          </div>
          <div className="pb-2 text-muted-foreground">×</div>
          <div>
            <Label htmlFor="custom-h" className="text-xs">Height</Label>
            <Input
              id="custom-h"
              type="number"
              inputMode="numeric"
              placeholder="e.g. 200"
              value={customH}
              onChange={(e) => setCustomH(e.target.value)}
              className="w-28"
            />
          </div>
          <Button type="button" onClick={addCustom} disabled={atMax || !customW || !customH}>
            Add
          </Button>
        </div>
        {customError && <p className="mt-2 text-sm text-rose-600">{customError}</p>}

        {selected.filter((s) => s.isCustom).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {selected.filter((s) => s.isCustom).map((s) => (
              <span
                key={targetKey(s)}
                className="inline-flex items-center gap-2 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-700"
              >
                {s.width}×{s.height}
                <button
                  type="button"
                  onClick={() => removeTarget(s)}
                  className="hover:text-purple-900"
                  aria-label={`Remove ${s.width}x${s.height}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <p className={`text-sm ${atMax ? "text-rose-600 font-medium" : "text-muted-foreground"}`}>
        {selected.length} of {MAX_TARGETS} sizes selected
        {atMax && " — Maximum reached."}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/banner-resizer/size-picker.tsx
git commit -m "feat: add SizePicker for IAB + custom banner sizes"
```

---

## Task 11: JobNameInput component

Thin labeled input that surfaces the 80-char limit.

**Files:**
- Create: `src/components/banner-resizer/job-name-input.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// src/components/banner-resizer/job-name-input.tsx
"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_JOB_NAME_LENGTH } from "@/lib/banner-jobs/job-config";

export type JobNameInputProps = {
  value: string;
  onChange: (next: string) => void;
};

export function JobNameInput({ value, onChange }: JobNameInputProps) {
  const remaining = MAX_JOB_NAME_LENGTH - value.length;
  const overLimit = remaining < 0;

  return (
    <div>
      <Label htmlFor="job-name" className="mb-2 block text-sm font-semibold tracking-tight">
        Job name
      </Label>
      <Input
        id="job-name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Q2 Spring Campaign — Coral CTA"
        maxLength={MAX_JOB_NAME_LENGTH}
      />
      <p className="mt-1.5 text-xs text-muted-foreground">
        Becomes the new Figma page name. <span className={overLimit ? "text-rose-600" : ""}>{remaining} chars left</span>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/banner-resizer/job-name-input.tsx
git commit -m "feat: add JobNameInput component"
```

---

## Task 12: OptionsForm component

Toggle for new-page placement, dropdown for naming pattern, locked AI-polish row.

**Files:**
- Create: `src/components/banner-resizer/options-form.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// src/components/banner-resizer/options-form.tsx
"use client";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { BannerJobOptions } from "@/lib/banner-jobs/job-config";

export type OptionsFormProps = {
  value: BannerJobOptions;
  onChange: (next: BannerJobOptions) => void;
};

export function OptionsForm({ value, onChange }: OptionsFormProps) {
  return (
    <div className="space-y-5">
      {/* Placement toggle */}
      <div className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4">
        <div>
          <Label htmlFor="opt-new-page" className="text-sm font-semibold tracking-tight">
            Place on a new page
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            New frames go on a dedicated page named after the job. Off → appended below source frames on the current page.
          </p>
        </div>
        <input
          id="opt-new-page"
          type="checkbox"
          checked={value.placeOnNewPage}
          onChange={(e) => onChange({ ...value, placeOnNewPage: e.target.checked })}
          className="mt-1 h-4 w-4"
        />
      </div>

      {/* Naming pattern */}
      <div className="rounded-lg border bg-card p-4">
        <Label htmlFor="opt-naming" className="text-sm font-semibold tracking-tight">
          Frame naming pattern
        </Label>
        <select
          id="opt-naming"
          value={value.namingPattern}
          onChange={(e) =>
            onChange({ ...value, namingPattern: e.target.value as BannerJobOptions["namingPattern"] })
          }
          className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="size">728x90</option>
          <option value="size-job">728x90 — [Job name]</option>
          <option value="size-source">728x90 — [Source frame name]</option>
        </select>
      </div>

      {/* Locked: AI polish */}
      <div className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4 opacity-60">
        <div>
          <div className="flex items-center gap-2">
            <Label className="text-sm font-semibold tracking-tight">AI polish</Label>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Use vision AI to refine the auto-resize layout. Reserved for v2.
          </p>
        </div>
        <input type="checkbox" disabled className="mt-1 h-4 w-4" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/banner-resizer/options-form.tsx
git commit -m "feat: add OptionsForm with placement, naming, and locked AI polish"
```

---

## Task 13: CodeDisplay component

The post-submit screen's hero — code in big mono type, copy button, QR, countdown, instructions.

**Files:**
- Create: `src/components/banner-resizer/code-display.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// src/components/banner-resizer/code-display.tsx
"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import { formatCountdown } from "@/lib/banner-jobs/format-countdown";

export type CodeDisplayProps = {
  code: string;
  expiresAt: string; // ISO timestamp
};

export function CodeDisplay({ code, expiresAt }: CodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [remainingMs, setRemainingMs] = useState(() => Date.parse(expiresAt) - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setRemainingMs(Date.parse(expiresAt) - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Code copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the code manually");
    }
  }

  const expired = remainingMs <= 0;

  return (
    <div className="space-y-6">
      {/* Code + actions */}
      <div className="rounded-2xl border bg-card p-8 text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Pickup code</p>
        <div className="mt-3 font-mono text-5xl font-bold tracking-[0.2em]">{code}</div>
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button onClick={copyCode} variant="outline">
            {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
            {copied ? "Copied" : "Copy code"}
          </Button>
        </div>
        <p className={`mt-3 text-xs ${expired ? "text-rose-600 font-medium" : "text-muted-foreground"}`}>
          {expired ? "Expired — generate a new job" : `Expires in ${formatCountdown(remainingMs)}`}
        </p>
      </div>

      {/* Instructions + QR */}
      <div className="grid gap-6 md:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border bg-card p-6">
          <h3 className="text-sm font-semibold tracking-tight">How to use the code</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Open your Figma file with the source banners.</li>
            <li>
              Run the GlueSkills Banner Resizer plugin (Plugins menu → Development → GlueSkills Banner Resizer
              during preview, or Community → search "GlueSkills Banner Resizer" once published).
            </li>
            <li>Paste this code into the plugin and follow the prompts.</li>
          </ol>
        </div>
        <div className="flex items-center justify-center rounded-2xl border bg-card p-6">
          <div className="text-center">
            <QRCodeSVG value={code} size={120} />
            <p className="mt-2 text-xs text-muted-foreground">QR — scan to copy</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/banner-resizer/code-display.tsx
git commit -m "feat: add CodeDisplay with copy, QR, and live countdown"
```

---

## Task 14: Wizard page (`page.tsx`)

Composes the four components into a single-page form. Submits → POST → renders CodeDisplay below.

**Files:**
- Create: `src/app/dashboard/designer/banner-resizer/page.tsx`

- [ ] **Step 1: Implement the page**

```tsx
// src/app/dashboard/designer/banner-resizer/page.tsx
"use client";

import { useState } from "react";
import { JobNameInput } from "@/components/banner-resizer/job-name-input";
import { SizePicker } from "@/components/banner-resizer/size-picker";
import { OptionsForm } from "@/components/banner-resizer/options-form";
import { CodeDisplay } from "@/components/banner-resizer/code-display";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { jobNameSchema, bannerJobConfigSchema, type BannerJobConfig, type BannerJobTarget } from "@/lib/banner-jobs/job-config";
import { LayoutPanelLeft } from "lucide-react";

export default function BannerResizerPage() {
  const [name, setName] = useState("");
  const [targets, setTargets] = useState<BannerJobTarget[]>([]);
  const [options, setOptions] = useState<BannerJobConfig["options"]>({
    placeOnNewPage: true,
    namingPattern: "size-job",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ code: string; expiresAt: string } | null>(null);

  async function handleSubmit() {
    const nameResult = jobNameSchema.safeParse(name);
    if (!nameResult.success) {
      toast.error("Please enter a job name");
      return;
    }
    const configResult = bannerJobConfigSchema.safeParse({ version: 1, targets, options });
    if (!configResult.success) {
      toast.error(targets.length === 0 ? "Pick at least one size" : "Invalid configuration");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/banner-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameResult.data, config: configResult.data }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error || "Failed to create job");
        return;
      }
      const data = await res.json();
      setResult({ code: data.code, expiresAt: data.expiresAt });
    } catch (err) {
      console.error(err);
      toast.error("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  // Post-submit view
  if (result) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight">Job created</h1>
          <p className="mt-1.5 text-muted-foreground">
            Take this code to the GlueSkills Banner Resizer plugin in Figma.
          </p>
        </div>
        <CodeDisplay code={result.code} expiresAt={result.expiresAt} />
        <div>
          <Button variant="outline" onClick={() => { setResult(null); setName(""); setTargets([]); }}>
            Create another job
          </Button>
        </div>
      </div>
    );
  }

  // Wizard form view
  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/12 text-purple-600">
          <LayoutPanelLeft className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight">Banner Resizer</h1>
          <p className="mt-1.5 text-muted-foreground">
            Generate IAB banner size variants from your Figma source frames. Configure the job here, then run the GlueSkills Banner Resizer plugin in Figma to materialize the new frames.
          </p>
        </div>
      </div>

      <section>
        <JobNameInput value={name} onChange={setName} />
      </section>

      <section>
        <h2 className="mb-4 font-headline text-lg font-bold tracking-tight">Target sizes</h2>
        <SizePicker selected={targets} onChange={setTargets} />
      </section>

      <section>
        <h2 className="mb-4 font-headline text-lg font-bold tracking-tight">Generation options</h2>
        <OptionsForm value={options} onChange={setOptions} />
      </section>

      <div className="flex justify-end">
        <Button size="lg" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Creating..." : "Generate code"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Visual smoke test in dev**

```bash
npm run dev
```
Open `http://localhost:3000/dashboard/designer/banner-resizer` (sign in if prompted).

Verify:
- Page renders with title, subtitle, name input, all 14 IAB checkboxes in three groups, custom size form, options card, locked AI polish row, generate button.
- Selecting a checkbox bumps the counter.
- Adding 21st size disables further additions.
- Custom width 49 → error "Minimum 50px per side."
- Empty name + click Generate → toast error.

Don't commit until Task 16 — the tile addition is paired with the page so the link works.

---

## Task 15: Add tile to the Designer dashboard

**Files:**
- Modify: `src/app/dashboard/designer/page.tsx`

- [ ] **Step 1: Add the import + tile entry**

In the existing imports line, add `LayoutPanelLeft`:

```ts
import { ImageDown, Palette, RulerDimensionLine, Contrast, Blend, Type, Fingerprint, FileImage, LayoutPanelLeft } from "lucide-react";
```

Insert this entry as the second item in the `tools` array (right after Brand Extractor, before Image Resizer):

```ts
{
  href: "/dashboard/designer/banner-resizer",
  label: "Banner Resizer",
  description: "Generate IAB banner size variants from your Figma source frames — starting point, not a finished deliverable",
  icon: LayoutPanelLeft,
},
```

- [ ] **Step 2: Visual check**

Reload `http://localhost:3000/dashboard/designer` — the new tile should appear in position 2 with a layout-panel icon. Click it → wizard loads.

- [ ] **Step 3: Commit (page + tile together)**

```bash
git add src/app/dashboard/designer/banner-resizer/page.tsx src/app/dashboard/designer/page.tsx
git commit -m "feat: add Banner Resizer wizard page and dashboard tile"
```

---

## Task 16: End-to-end smoke test (web only — plugin not required)

Validate the full flow: sign in → create job → confirm code lands in Supabase → verify RPC returns config when called by hand.

- [ ] **Step 1: Run the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Create a job through the UI**

1. Sign in at `http://localhost:3000`.
2. Go to `/dashboard/designer/banner-resizer`.
3. Job name: `Smoke Test 2026-04-15`.
4. Tick: 300×250, 728×90, 160×600, 970×250 (4 sizes).
5. Add a custom size: 480×320.
6. Leave options at defaults.
7. Click **Generate code**.

Expected: page flips to the confirmation view with a 6-char code, copy button, QR, countdown ticking down from `23h 59m`.

- [ ] **Step 3: Verify the row in Supabase**

In Supabase SQL Editor:

```sql
select code, name, jsonb_array_length(config->'targets') as target_count, expires_at
  from banner_jobs
  order by created_at desc
  limit 5;
```

Expected: row with your code, name "Smoke Test 2026-04-15", target_count = 5, expires_at ~24h in the future.

- [ ] **Step 4: Verify the RPC works (simulating the plugin)**

In Supabase SQL Editor (replace `XXXXXX` with your actual code):

```sql
select consume_banner_job('XXXXXX');
```

Expected: JSON `{"name":"Smoke Test 2026-04-15","config":{"version":1,"targets":[...5 items...],"options":{...}}}`

Call again immediately:
```sql
select consume_banner_job('XXXXXX');
```
Expected: same result (within 5-min idempotency window).

- [ ] **Step 5: Verify the rate limit triggers**

Generate 10 jobs in quick succession via the UI (just click Generate ten times with the same form). On the 11th attempt within an hour, expect a toast: "Rate limit: max 10 jobs per hour".

Cleanup test rows when done:
```sql
delete from banner_jobs where name like 'Smoke Test%';
```

- [ ] **Step 6: Run all unit tests once more**

```bash
npm test
```
Expected: all tests pass (`iab-sizes`, `code-generator`, `job-config`, `format-countdown`, `route`).

- [ ] **Step 7: Run the build**

```bash
npm run build
```
Expected: build completes without errors.

- [ ] **Step 8: No commit needed if all green** — this task is verification only. If any issue surfaces, fix it in the related task and re-run from there.

---

## Self-Review Notes

After writing this plan, checked against the spec:

- **Spec §2 architectural decisions:** all 7 covered (hybrid → Tasks 8+9 (web side) ↔ plugin plan; auto-mapping + override → plugin plan; algorithm → plugin plan; IAB+custom → Task 4 + Task 10; web/plugin sync → Task 8 + Task 3 RPC; selection-first source detect → plugin plan; new page placement → Task 12).
- **Spec §3 architecture:** code format Task 5, Clerk auth Task 8, plugin install link Task 13.
- **Spec §4 user flow:** wizard Task 14, confirmation Task 14+13, plugin flow → plugin plan.
- **Spec §5 data model:** Task 3 (table + RLS + RPC). Note: implementation uses an RPC instead of a public SELECT policy — strictly safer than the spec described, no scope change.
- **Spec §6 algorithm:** plugin plan.
- **Spec §7 code organization web side:** all files mapped (Tasks 4–15).
- **Spec §8 limits:** MAX_TARGETS=20 in Task 6, MIN/MAX_DIMENSION in Task 6, name 1–80 in Task 6, rate limit 10/hour in Task 8.
- **Spec §8 web error states:** toast on POST failure (Task 14), no redirect (Task 14), cron auth (Task 9), 429 toast (Task 8 test + Task 16 step 5).
- **Spec §9 testing:** code-generator (Task 5), iab-sizes (Task 4), job-config (Task 6), API integration (Task 8). No component tests (intentionally — repo has no Testing Library setup; manual smoke covers UI).
