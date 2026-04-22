# Brand Packs v1 — Web Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the web side of "Brand Packs v1" — a Supabase `brands` table, a public Storage bucket for logos/images, a Clerk-gated admin UI at `/admin/brands`, and two public read-only API endpoints the separate Figma plugin repo will consume. No versioning, no preview, no roles — matches the current internal-tool posture.

**Architecture:** Clerk-gated admin pages under `/admin/brands` → server action uploads files to Supabase Storage via the service-role key → form writes/updates `brands` rows via the user's Clerk-templated Supabase JWT (`authenticated` role is allowed to write per RLS). Plugin consumes two fully public endpoints: `GET /api/brands` (list) and `GET /api/brands/[slug]` (detail). Storage bucket `brand-assets` is public-read.

**Tech Stack:** Next.js 16 App Router, TypeScript, Clerk (via `src/proxy.ts`), Supabase (`@supabase/supabase-js` on both anon and service-role keys), shadcn v4 (base-ui), Tailwind v4, Zod, TanStack Query, Sonner, Vitest.

---

## Sibling patterns to follow

- `supabase/migrations/003_banner_jobs.sql`, `004_spec_sheets.sql` — RLS policies, `security definer` RPC pattern (we won't need the RPC trick here since reads are fully public — plain anon SELECT is fine).
- `src/lib/banner-jobs/job-config.ts` — Zod schema file shape (colocated constants + types).
- `src/lib/supabase/client.ts`, `src/lib/supabase/types.ts` — client factory + persistent row types.
- `src/app/api/spec-sheets/route.ts` + `route.test.ts` — Clerk auth + rate limit + insert/list flow, and the Vitest mocking pattern for Supabase chains.
- `src/app/api/spec-sheets/[code]/route.ts` — dynamic route, public GET + Clerk-gated DELETE pattern.
- `src/components/spec-sheet-reviewer/sheets-list.tsx` — TanStack-Query list page pattern (`queryKey`, `useMutation` for delete, Sonner toasts).
- `src/components/spec-sheet-reviewer/upload-form.tsx` — form + Sonner errors idiom; shadcn v4 `Input`/`Label`/`Button` usage.
- `src/app/dashboard/strategist/spec-sheet-reviewer/page.tsx` — page shell with header icon, title, copy, a "just created" confirmation view.

## Notes on conventions (observed, do not deviate)

- **Clerk middleware lives at `src/proxy.ts`, NOT `middleware.ts`.** Adding a new protected route prefix means editing `src/proxy.ts`.
- **shadcn v4 is base-ui, not Radix.** Use the `render` prop where applicable — never `asChild`. Only the components already installed in `src/components/ui/` exist; if a new one is needed (e.g. `select`, `table`, `alert-dialog`), install it via `npx shadcn@latest add <name>` and commit the generated file.
- **Migrations run manually** against Supabase (SQL editor). There is no CLI wired up. Match `003_banner_jobs.sql` / `004_spec_sheets.sql` exactly (header comment pointing at spec, `create table if not exists`, indexes, RLS, policies).
- **RLS posture:** `banner_jobs` and `spec_sheets` scope rows to the Clerk `sub` claim. For `brands`, the app is single-tenant-internal — any authenticated user is an admin. Policies therefore use `(auth.role() = 'authenticated')` for writes and allow `anon` SELECT.
- **Row types live in `src/lib/supabase/types.ts`.** Add `Brand` there.
- **Tests:** Vitest; files live next to source as `*.test.ts`. `vitest.config.ts` includes everything under `src/**/*.test.ts`.
- **Commit style (observed):** `feat(<area>): short imperative`, `feat(db): …`, `feat(api): …`, `chore: …`, `fix(<area>): …`. Matches `git log --oneline`.

---

## File Structure

**Created (new):**

| File | Responsibility |
|---|---|
| `supabase/migrations/005_brands.sql` | Table, index, RLS, storage-bucket creation + policies. |
| `src/lib/brands/schema.ts` | Zod schemas for `BrandPack`, `BrandPackInput` (create/update), palette/font/images; exported TS types. |
| `src/lib/brands/schema.test.ts` | Unit tests for the Zod schema. |
| `src/lib/brands/slug.ts` | `toSlug(name)` + `isValidSlug(slug)` helpers. |
| `src/lib/brands/slug.test.ts` | Unit tests for slug helpers. |
| `src/lib/supabase/admin.ts` | Factory for a service-role Supabase client (server-only). Used only by the upload server action. |
| `src/app/api/brands/route.ts` | `GET` (public list), `POST` (Clerk-gated create). |
| `src/app/api/brands/route.test.ts` | Route tests. |
| `src/app/api/brands/[slug]/route.ts` | `GET` (public detail), `PATCH` (Clerk-gated update), `DELETE` (Clerk-gated). |
| `src/app/api/brands/[slug]/route.test.ts` | Route tests. |
| `src/app/admin/layout.tsx` | Minimal shell (header + main) for admin pages — kept separate from dashboard. |
| `src/app/admin/brands/page.tsx` | Client list page. |
| `src/app/admin/brands/new/page.tsx` | Client new-brand page (uses `BrandForm`). |
| `src/app/admin/brands/[slug]/page.tsx` | Client edit page (uses `BrandForm`). |
| `src/components/brands/brand-form.tsx` | The full form — identity, palette, typography, logos, images. |
| `src/components/brands/brands-table.tsx` | Table with name, slug, palette swatches, logo thumb. |
| `src/components/brands/color-input.tsx` | Hex input + live swatch. |
| `src/components/brands/image-slot.tsx` | Upload + label + remove, used by logos and images sections. |
| `src/app/admin/brands/actions.ts` | Server actions: `uploadBrandAsset(slug, kind, file)`, `deleteBrandAsset(path)`. Uses service-role client. |

**Modified:**

| File | Responsibility |
|---|---|
| `src/proxy.ts` | Add `/admin(.*)` to Clerk-protected matcher. |
| `src/lib/supabase/types.ts` | Append `Brand` row type. |
| `.env.local.example` | Add `SUPABASE_SERVICE_ROLE_KEY=` placeholder. |
| `package.json` / `package-lock.json` | Add `react-hook-form` + `@hookform/resolvers` (zod resolver) if needed; shadcn `select`, `table`, `alert-dialog` via shadcn CLI. |

---

## BrandPack data shape (plugin must mirror this)

This is the authoritative type the plugin will rebuild. Match field names and casing exactly.

```typescript
// src/lib/brands/schema.ts (shipped as the source of truth)
export type BrandPack = {
  id: string;                 // uuid
  slug: string;               // kebab-case, url-safe
  name: string;
  palette: {
    primary: string;          // "#RRGGBB"
    secondary: string;        // "#RRGGBB"
    accent?: string;
    neutral?: string;
  };
  font: {
    family: string;           // e.g. "Inter"
    fallback: string;         // e.g. "Arial"
    weights: {
      bold: string;           // exact Figma style name, e.g. "Bold"
      semi: string;           // e.g. "Semi Bold"
      regular: string;        // e.g. "Regular"
    };
  };
  logo_primary_url: string;
  logo_alt_url: string | null;
  images: Array<{
    url: string;
    label?: string;
    sort_order: number;       // 0..4
  }> | null;                  // max 5 entries
  created_at: string;         // ISO
  updated_at: string;         // ISO
};
```

---

## Task 1: Environment variable + Supabase service-role client

**Files:**
- Modify: `.env.local.example`
- Create: `src/lib/supabase/admin.ts`

The only write path that needs the service-role key is Storage uploads (the anon key can't write to a bucket whose policies restrict writes). DB writes continue to go through the user's Clerk-templated JWT.

- [ ] **Step 1: Add env placeholder**

Edit `.env.local.example`, append after the Supabase block:

```
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # server-only; used by admin upload action
```

Then add the real value to your local `.env.local` (and to Vercel env).

- [ ] **Step 2: Create the admin client factory**

`src/lib/supabase/admin.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service-role key.
 * Bypasses RLS — never import this from a client component.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin client is missing env vars");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add .env.local.example src/lib/supabase/admin.ts
git commit -m "chore: add supabase service-role client for admin uploads"
```

---

## Task 2: Supabase migration — `brands` table + Storage bucket

**Files:**
- Create: `supabase/migrations/005_brands.sql`

- [ ] **Step 1: Write the migration**

`supabase/migrations/005_brands.sql`:

```sql
-- Brand Packs v1: per-client brand data consumed by the Figma plugin.
-- See: docs/superpowers/plans/2026-04-21-brand-packs-web-admin.md

create table if not exists brands (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  name              text not null,
  palette           jsonb not null,   -- { primary, secondary, accent?, neutral? }
  font              jsonb not null,   -- { family, fallback, weights: { bold, semi, regular } }
  logo_primary_url  text not null,
  logo_alt_url      text,
  images            jsonb,            -- array of { url, label?, sort_order } — max 5
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- updated_at trigger (no pre-existing pattern in this repo; introduced here).
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists brands_set_updated_at on brands;
create trigger brands_set_updated_at
  before update on brands
  for each row execute function set_updated_at();

alter table brands enable row level security;

-- Public read: any visitor (and the Figma plugin anon call) can fetch a brand.
create policy "Anyone can read brands"
  on brands for select
  using (true);

-- Writes: any authenticated Clerk user = admin. (Matches the internal-tool
-- posture described in CLAUDE.md; there are no roles yet.)
create policy "Authenticated users can insert brands"
  on brands for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update brands"
  on brands for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete brands"
  on brands for delete
  to authenticated
  using (true);

-- Storage bucket for logos + imagery. Public-read; server actions with the
-- service-role key handle writes.
insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', true)
on conflict (id) do nothing;

-- Anyone can read (bucket is public; this is an explicit belt-and-braces policy).
drop policy if exists "Public read on brand-assets" on storage.objects;
create policy "Public read on brand-assets"
  on storage.objects for select
  using (bucket_id = 'brand-assets');
```

- [ ] **Step 2: Apply the migration**

Apply this SQL via the Supabase dashboard (SQL editor) against the project. Same process as `003_banner_jobs.sql` / `004_spec_sheets.sql` — no migration CLI.

Verify:

```sql
select count(*) from brands;                              -- expect 0
select id from storage.buckets where id = 'brand-assets'; -- expect 1 row
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/005_brands.sql
git commit -m "feat(db): add brands table + brand-assets storage bucket"
```

---

## Task 3: `Brand` row type + slug helper

**Files:**
- Modify: `src/lib/supabase/types.ts`
- Create: `src/lib/brands/slug.ts`
- Create: `src/lib/brands/slug.test.ts`

- [ ] **Step 1: Append `Brand` to the row types**

The canonical shape is derived from the zod schema in Task 4; this file just re-exports it as `Brand` so callers can use either name.

Add to the bottom of `src/lib/supabase/types.ts`:

```typescript
// Brand row type — canonical shape lives in `@/lib/brands/schema`. Re-exported
// here so `import { Brand } from "@/lib/supabase/types"` keeps working alongside
// the other row types.
export type { BrandPack as Brand } from "@/lib/brands/schema";
```

- [ ] **Step 2: Write failing slug tests**

`src/lib/brands/slug.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { toSlug, isValidSlug } from "./slug";

describe("toSlug", () => {
  it("lowercases, replaces whitespace with hyphens, strips junk", () => {
    expect(toSlug("ACME Corp")).toBe("acme-corp");
    expect(toSlug("  The   Big   Banana  ")).toBe("the-big-banana");
    expect(toSlug("Foo & Bar / Baz!")).toBe("foo-bar-baz");
  });

  it("collapses adjacent hyphens", () => {
    expect(toSlug("a -- b // c")).toBe("a-b-c");
  });

  it("returns '' for input that collapses to nothing", () => {
    expect(toSlug("   ---   ")).toBe("");
  });

  it("strips diacritics via NFKD normalization", () => {
    expect(toSlug("Café Déjà Vu")).toBe("cafe-deja-vu");
    expect(toSlug("Ñoño")).toBe("nono");
  });

  it("truncates to MAX_SLUG_LENGTH and produces round-trip-valid output", () => {
    const long = "The Extremely Long Official Company Name of Acme International Holdings LLC";
    const slug = toSlug(long);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
    expect(isValidSlug(slug)).toBe(true);
  });
});

describe("isValidSlug", () => {
  it("accepts lowercase kebab-case strings of length 1..60", () => {
    expect(isValidSlug("acme")).toBe(true);
    expect(isValidSlug("big-banana-co")).toBe(true);
  });

  it("rejects empty, uppercase, underscores, symbols, or leading/trailing hyphens", () => {
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("ACME")).toBe(false);
    expect(isValidSlug("acme_corp")).toBe(false);
    expect(isValidSlug("-acme")).toBe(false);
    expect(isValidSlug("acme-")).toBe(false);
    expect(isValidSlug("a".repeat(61))).toBe(false);
  });
});
```

- [ ] **Step 3: Run — expect failure**

```bash
npx vitest run src/lib/brands/slug.test.ts
```

Expected: module-not-found for `./slug`.

- [ ] **Step 4: Implement**

`src/lib/brands/slug.ts`:

```typescript
export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")        // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 60;

export function isValidSlug(value: string): boolean {
  if (typeof value !== "string") return false;
  if (value.length < 1 || value.length > MAX_SLUG_LENGTH) return false;
  return SLUG_RE.test(value);
}
```

- [ ] **Step 5: Run — expect pass**

```bash
npx vitest run src/lib/brands/slug.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/types.ts src/lib/brands/slug.ts src/lib/brands/slug.test.ts
git commit -m "feat(brands): add Brand row type and slug helpers"
```

---

## Task 4: Zod schema for `BrandPack`

**Files:**
- Create: `src/lib/brands/schema.ts`
- Create: `src/lib/brands/schema.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/brands/schema.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { brandPackInputSchema } from "./schema";

const valid = {
  slug: "acme",
  name: "ACME",
  palette: { primary: "#ff0000", secondary: "#00ff00" },
  font: {
    family: "Inter",
    fallback: "Arial",
    weights: { bold: "Bold", semi: "Semi Bold", regular: "Regular" },
  },
  logo_primary_url: "https://example.com/p.png",
  logo_alt_url: null,
  images: null,
};

describe("brandPackInputSchema", () => {
  it("accepts a minimal valid record", () => {
    expect(brandPackInputSchema.safeParse(valid).success).toBe(true);
  });

  it("requires primary and secondary hex colors", () => {
    const bad = { ...valid, palette: { primary: "red", secondary: "#00ff00" } };
    expect(brandPackInputSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts 3-digit and 6-digit hex", () => {
    const ok = { ...valid, palette: { primary: "#f00", secondary: "#00ff00" } };
    expect(brandPackInputSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects unknown palette keys", () => {
    const bad = {
      ...valid,
      palette: { primary: "#f00", secondary: "#0f0", wild: "#000" },
    };
    expect(brandPackInputSchema.safeParse(bad).success).toBe(false);
  });

  it("requires a valid slug", () => {
    expect(brandPackInputSchema.safeParse({ ...valid, slug: "ACME" }).success).toBe(false);
    expect(brandPackInputSchema.safeParse({ ...valid, slug: "" }).success).toBe(false);
  });

  it("caps images at 5 entries", () => {
    const images = Array.from({ length: 6 }, (_, i) => ({
      url: `https://x/${i}.png`,
      sort_order: i,
    }));
    expect(brandPackInputSchema.safeParse({ ...valid, images }).success).toBe(false);
  });

  it("requires logo_primary_url", () => {
    const bad = { ...valid, logo_primary_url: "" };
    expect(brandPackInputSchema.safeParse(bad).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run src/lib/brands/schema.test.ts
```

Expected: module-not-found.

- [ ] **Step 3: Implement**

`src/lib/brands/schema.ts`:

```typescript
import { z } from "zod";
import { MAX_SLUG_LENGTH } from "./slug";

export const MAX_BRAND_NAME_LENGTH = 80;
export const MAX_IMAGES = 5;

const hex = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex color");

const slugSchema = z
  .string()
  .min(1)
  .max(MAX_SLUG_LENGTH)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Must be lowercase kebab-case");

const paletteSchema = z
  .object({
    primary: hex,
    secondary: hex,
    accent: hex.optional(),
    neutral: hex.optional(),
  })
  .strict();

const fontSchema = z
  .object({
    family: z.string().trim().min(1).max(80),
    fallback: z.string().trim().min(1).max(80),
    weights: z
      .object({
        bold: z.string().trim().min(1).max(60),
        semi: z.string().trim().min(1).max(60),
        regular: z.string().trim().min(1).max(60),
      })
      .strict(),
  })
  .strict();

const imageSchema = z
  .object({
    url: z.url(),
    label: z.string().trim().max(80).optional(),
    sort_order: z.number().int().min(0).max(MAX_IMAGES - 1),
  })
  .strict();

export const brandPackInputSchema = z
  .object({
    slug: slugSchema,
    name: z.string().trim().min(1).max(MAX_BRAND_NAME_LENGTH),
    palette: paletteSchema,
    font: fontSchema,
    logo_primary_url: z.url(),
    logo_alt_url: z.url().nullable().optional(),
    images: z.array(imageSchema).max(MAX_IMAGES).nullable().optional(),
  })
  .strict();

export type BrandPackInput = z.infer<typeof brandPackInputSchema>;
export type BrandPalette = z.infer<typeof paletteSchema>;
export type BrandFont = z.infer<typeof fontSchema>;
export type BrandImage = z.infer<typeof imageSchema>;

/**
 * Canonical BrandPack shape (matches the `brands` row + the plugin type).
 */
export type BrandPack = BrandPackInput & {
  id: string;
  created_at: string;
  updated_at: string;
};
```

- [ ] **Step 4: Run — expect pass**

```bash
npx vitest run src/lib/brands/schema.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/brands/schema.ts src/lib/brands/schema.test.ts
git commit -m "feat(brands): add zod schema for BrandPack input"
```

---

## Task 5: Protect `/admin/*` with Clerk

**Files:**
- Modify: `src/proxy.ts`

- [ ] **Step 1: Inspect the existing matcher**

Open `src/proxy.ts`. It uses `clerkMiddleware()` and a `matcher` config protecting `/dashboard(.*)`. Add `/admin(.*)` to the same list.

- [ ] **Step 2: Edit**

Add `/admin(.*)` to the existing protected-route matcher (or the `createRouteMatcher` / `auth.protect()` branch, whichever the file uses — follow the exact pattern already there; do not restructure).

- [ ] **Step 3: Manual verify**

```bash
npm run dev
# In a private window, hit http://localhost:3000/admin/brands
```

Expected: redirected to `/sign-in`. Sign in, reach the (still unimplemented) page — expect a 404 from Next.js. This proves the gate works before any pages exist.

- [ ] **Step 4: Commit**

```bash
git add src/proxy.ts
git commit -m "feat(admin): protect /admin/* with Clerk"
```

---

## Task 6: `GET /api/brands` (public list) + `POST /api/brands` (create)

**Files:**
- Create: `src/app/api/brands/route.ts`
- Create: `src/app/api/brands/route.test.ts`

Matches `src/app/api/spec-sheets/route.ts` almost 1:1 — Clerk auth + rate limit + insert. Rate limit chosen: 30 brands per hour per user (admins bulk-create).

- [ ] **Step 1: Write failing tests**

`src/app/api/brands/route.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockGetToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const mockInsert = vi.fn();
const mockCount = vi.fn();
const mockList = vi.fn();

const mockFrom = vi.fn(() => ({
  insert: (...args: unknown[]) => mockInsert(...args),
  select: () => ({
    eq: () => ({ gte: () => mockCount() }),
    order: () => mockList(),
  }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseClient: () => ({ from: mockFrom }),
}));

import { POST, GET } from "./route";
import { auth } from "@clerk/nextjs/server";

const validInput = {
  slug: "acme",
  name: "ACME",
  palette: { primary: "#ff0000", secondary: "#00ff00" },
  font: {
    family: "Inter",
    fallback: "Arial",
    weights: { bold: "Bold", semi: "Semi Bold", regular: "Regular" },
  },
  logo_primary_url: "https://x/p.png",
  logo_alt_url: null,
  images: null,
};

function buildPost(body: unknown): NextRequest {
  return new Request("http://localhost/api/brands", {
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
  mockList.mockResolvedValue({ data: [], error: null });
});

describe("POST /api/brands", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const res = await POST(buildPost(validInput));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid payload", async () => {
    const res = await POST(buildPost({ ...validInput, slug: "ACME" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const bad = new Request("http://localhost/api/brands", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    }) as unknown as NextRequest;
    expect((await POST(bad as NextRequest)).status).toBe(400);
  });

  it("returns 429 at 30+ inserts in the last hour", async () => {
    mockCount.mockResolvedValue({ count: 30, error: null });
    expect((await POST(buildPost(validInput))).status).toBe(429);
  });

  it("inserts the row and returns 200 with slug", async () => {
    const res = await POST(buildPost(validInput));
    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const row = mockInsert.mock.calls[0][0];
    expect(row.slug).toBe("acme");
    expect(row.name).toBe("ACME");
    const json = await res.json();
    expect(json.slug).toBe("acme");
  });

  it("returns 500 if insert fails", async () => {
    mockInsert.mockResolvedValue({ error: { message: "db down" } });
    expect((await POST(buildPost(validInput))).status).toBe(500);
  });
});

describe("GET /api/brands", () => {
  it("returns 200 with a sorted summary list — no auth required", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    mockList.mockResolvedValue({
      data: [
        { slug: "acme", name: "ACME", logo_primary_url: "https://x/p.png" },
        { slug: "beta", name: "Beta", logo_primary_url: "https://x/q.png" },
      ],
      error: null,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.brands).toHaveLength(2);
    expect(json.brands[0]).toEqual({
      slug: "acme",
      name: "ACME",
      logo_primary_url: "https://x/p.png",
    });
  });

  it("returns 500 if list fails", async () => {
    mockList.mockResolvedValue({ data: null, error: { message: "down" } });
    expect((await GET()).status).toBe(500);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run src/app/api/brands/route.test.ts
```

Expected: module-not-found.

- [ ] **Step 3: Implement**

`src/app/api/brands/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase/client";
import { brandPackInputSchema } from "@/lib/brands/schema";

const RATE_LIMIT_PER_HOUR = 30;

export async function GET() {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("brands")
    .select("slug, name, logo_primary_url")
    .order("name", { ascending: true });

  if (error) {
    console.error("brands list failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({
    brands: (data ?? []).map((r) => ({
      slug: r.slug,
      name: r.name,
      logo_primary_url: r.logo_primary_url,
    })),
  });
}

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

  const parsed = brandPackInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.format() },
      { status: 400 }
    );
  }

  const supabaseToken = await getToken({ template: "supabase" });
  const supabase = createSupabaseClient(supabaseToken ?? undefined);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("brands")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)      // harmless — column does not exist; see note
    .gte("created_at", oneHourAgo);

  // Note: `brands` has no user_id column (single-tenant admin). For the MVP
  // rate limit we count total inserts globally in the last hour instead.
  // (Drop the .eq and remove the `userId` import when you see this comment.)

  if (countError) {
    console.error("brands rate limit count failed:", countError);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return NextResponse.json(
      { error: `Rate limit: max ${RATE_LIMIT_PER_HOUR} brands per hour` },
      { status: 429 }
    );
  }

  const input = parsed.data;
  const { error: insertError } = await supabase.from("brands").insert({
    slug: input.slug,
    name: input.name,
    palette: input.palette,
    font: input.font,
    logo_primary_url: input.logo_primary_url,
    logo_alt_url: input.logo_alt_url ?? null,
    images: input.images ?? null,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: `Slug "${input.slug}" already exists` },
        { status: 409 }
      );
    }
    console.error("brands insert failed:", insertError);
    return NextResponse.json({ error: "Failed to create brand" }, { status: 500 });
  }

  return NextResponse.json({ slug: input.slug });
}
```

Simplify before committing: remove the comment and the dead `.eq("user_id", userId)` — replace with the global count:

```typescript
const { count, error: countError } = await supabase
  .from("brands")
  .select("*", { count: "exact", head: true })
  .gte("created_at", oneHourAgo);
```

- [ ] **Step 4: Run — expect pass**

```bash
npx vitest run src/app/api/brands/route.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/brands/route.ts src/app/api/brands/route.test.ts
git commit -m "feat(api): GET (public) + POST /api/brands"
```

---

## Task 7: `GET /api/brands/[slug]` + `PATCH` + `DELETE`

**Files:**
- Create: `src/app/api/brands/[slug]/route.ts`
- Create: `src/app/api/brands/[slug]/route.test.ts`

Public `GET` (plugin consumes this). `PATCH` and `DELETE` gated by Clerk.

- [ ] **Step 1: Write failing tests**

`src/app/api/brands/[slug]/route.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockGetToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

const mockFrom = vi.fn(() => ({
  select: () => ({ eq: () => ({ maybeSingle: () => mockSingle() }) }),
  update: (...a: unknown[]) => ({ eq: () => mockUpdate(...a) }),
  delete: () => ({ eq: () => mockDelete() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseClient: () => ({ from: mockFrom }),
}));

import { GET, PATCH, DELETE } from "./route";
import { auth } from "@clerk/nextjs/server";

function ctx(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetToken.mockResolvedValue("fake.jwt.token");
  vi.mocked(auth).mockResolvedValue({ userId: "user_1", getToken: mockGetToken } as never);
});

describe("GET /api/brands/[slug]", () => {
  it("returns 404 when brand not found", async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });
    const res = await GET({} as NextRequest, ctx("acme"));
    expect(res.status).toBe(404);
  });

  it("returns the brand row on success — no auth required", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    mockSingle.mockResolvedValue({
      data: {
        id: "uuid", slug: "acme", name: "ACME",
        palette: { primary: "#f00", secondary: "#0f0" },
        font: { family: "Inter", fallback: "Arial", weights: { bold: "Bold", semi: "Semi Bold", regular: "Regular" } },
        logo_primary_url: "https://x/p.png",
        logo_alt_url: null,
        images: null,
        created_at: "2026-04-21T00:00:00Z",
        updated_at: "2026-04-21T00:00:00Z",
      },
      error: null,
    });
    const res = await GET({} as NextRequest, ctx("acme"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.slug).toBe("acme");
  });
});

describe("PATCH /api/brands/[slug]", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const req = new Request("http://x", { method: "PATCH", body: "{}" }) as unknown as NextRequest;
    expect((await PATCH(req, ctx("acme"))).status).toBe(401);
  });

  it("returns 400 on invalid body", async () => {
    const req = new Request("http://x", { method: "PATCH", body: JSON.stringify({ name: "" }) }) as unknown as NextRequest;
    expect((await PATCH(req, ctx("acme"))).status).toBe(400);
  });

  it("updates and returns 200 on success", async () => {
    mockUpdate.mockResolvedValue({ error: null });
    const req = new Request("http://x", {
      method: "PATCH",
      body: JSON.stringify({ name: "ACME Updated" }),
    }) as unknown as NextRequest;
    const res = await PATCH(req, ctx("acme"));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({ name: "ACME Updated" });
  });
});

describe("DELETE /api/brands/[slug]", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    expect((await DELETE({} as NextRequest, ctx("acme"))).status).toBe(401);
  });

  it("deletes and returns 200 on success", async () => {
    mockDelete.mockResolvedValue({ error: null });
    const res = await DELETE({} as NextRequest, ctx("acme"));
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run src/app/api/brands/[slug]/route.test.ts
```

Expected: module-not-found.

- [ ] **Step 3: Implement**

`src/app/api/brands/[slug]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase/client";
import { brandPackInputSchema } from "@/lib/brands/schema";

type RouteCtx = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { slug } = await params;
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("brand fetch failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

// Partial update — every field is optional.
const brandPackPatchSchema = brandPackInputSchema.partial();

export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = brandPackPatchSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.success ? undefined : parsed.error.format() },
      { status: 400 }
    );
  }

  const supabaseToken = await getToken({ template: "supabase" });
  const supabase = createSupabaseClient(supabaseToken ?? undefined);

  const { error } = await supabase.from("brands").update(parsed.data).eq("slug", slug);

  if (error) {
    console.error("brand update failed:", error);
    return NextResponse.json({ error: "Failed to update brand" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;

  const supabaseToken = await getToken({ template: "supabase" });
  const supabase = createSupabaseClient(supabaseToken ?? undefined);

  const { error } = await supabase.from("brands").delete().eq("slug", slug);

  if (error) {
    console.error("brand delete failed:", error);
    return NextResponse.json({ error: "Failed to delete brand" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npx vitest run src/app/api/brands/[slug]/route.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/brands
git commit -m "feat(api): GET (public) + PATCH + DELETE /api/brands/[slug]"
```

---

## Task 8: Upload server action

**Files:**
- Create: `src/app/admin/brands/actions.ts`

The admin form uploads logo/image files through a server action. The action uses the service-role key so it can write to the `brand-assets` bucket without Supabase auth. Gated by Clerk.

- [ ] **Step 1: Implement the server action**

`src/app/admin/brands/actions.ts`:

```typescript
"use server";

import { auth } from "@clerk/nextjs/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isValidSlug } from "@/lib/brands/slug";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);
const MAX_BYTES = 5 * 1024 * 1024;

export type UploadKind =
  | "logo-primary"
  | "logo-alt"
  | "image-0"
  | "image-1"
  | "image-2"
  | "image-3"
  | "image-4";

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/svg+xml") return "svg";
  throw new Error("Unsupported mime");
}

export async function uploadBrandAsset(
  slug: string,
  kind: UploadKind,
  file: File
): Promise<{ url: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  if (!isValidSlug(slug)) throw new Error("Invalid slug");
  if (!ALLOWED_MIME.has(file.type)) throw new Error("Unsupported file type");
  if (file.size > MAX_BYTES) throw new Error("File too large (max 5 MB)");

  const ext = extFromMime(file.type);
  const path = `${slug}/${kind}.${ext}`;

  const admin = createSupabaseAdminClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await admin.storage
    .from("brand-assets")
    .upload(path, bytes, {
      contentType: file.type,
      upsert: true,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = admin.storage.from("brand-assets").getPublicUrl(path);
  // Bust cache so the edit page re-renders the new asset after overwriting.
  const url = `${data.publicUrl}?v=${Date.now()}`;
  return { url };
}

export async function deleteBrandAsset(path: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from("brand-assets").remove([path]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}
```

Note: testing server actions in Vitest is fiddly and the repo has no precedent. Verify manually in Task 12 (end-to-end smoke test).

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/brands/actions.ts
git commit -m "feat(brands): add upload server action using service-role client"
```

---

## Task 9: Admin shell + list page

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/brands/page.tsx`
- Create: `src/components/brands/brands-table.tsx`

Intentionally a minimal shell — not the `/dashboard` shell (different nav, different purpose). A header with "Admin", a breadcrumb-ish title, and a `<main>`.

- [ ] **Step 1: Install shadcn `table` and `alert-dialog`**

```bash
npx shadcn@latest add table alert-dialog
```

Expected: `src/components/ui/table.tsx` and `src/components/ui/alert-dialog.tsx` created.

- [ ] **Step 2: Write the admin layout**

`src/app/admin/layout.tsx`:

```typescript
import Link from "next/link";
import { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/admin/brands" className="font-headline text-sm font-semibold">
            GlueSkills · Admin
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/admin/brands" className="hover:text-foreground">Brands</Link>
          </nav>
          <div className="ml-auto">
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to app
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Write the brands table**

`src/components/brands/brands-table.tsx`:

```typescript
"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button, buttonVariants } from "@/components/ui/button";
import { Plus, Pencil } from "lucide-react";

type BrandSummary = {
  slug: string;
  name: string;
  logo_primary_url: string;
  palette?: { primary: string; secondary: string; accent?: string; neutral?: string };
};

async function fetchBrands(): Promise<BrandSummary[]> {
  const res = await fetch("/api/brands");
  if (!res.ok) throw new Error("Failed to load brands");
  const json = await res.json();
  return json.brands;
}

function Swatch({ color }: { color?: string }) {
  if (!color) return null;
  return (
    <span
      className="inline-block size-4 rounded-full border border-border align-middle"
      style={{ backgroundColor: color }}
      title={color}
    />
  );
}

export function BrandsTable() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-brands"],
    queryFn: fetchBrands,
    staleTime: 60_000,
  });

  if (isLoading) return <div className="rounded-xl border p-6 text-sm text-muted-foreground">Loading brands…</div>;
  if (error) return <div className="rounded-xl border p-6 text-sm text-destructive">Could not load brands.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-2xl font-extrabold tracking-tight">Brands</h1>
        <Link href="/admin/brands/new" className={buttonVariants({ variant: "default" })}>
          <Plus className="mr-2 size-4" /> New brand
        </Link>
      </div>

      {(!data || data.length === 0) ? (
        <div className="rounded-xl border p-6 text-sm text-muted-foreground">
          No brands yet. Click "New brand" to create your first one.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium">Logo</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Slug</th>
                <th className="px-4 py-2 font-medium">Palette</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.map((b) => (
                <tr key={b.slug} className="border-t">
                  <td className="px-4 py-3">
                    <img src={b.logo_primary_url} alt="" className="size-8 rounded object-contain" />
                  </td>
                  <td className="px-4 py-3 font-medium">{b.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{b.slug}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <Swatch color={b.palette?.primary} />
                      <Swatch color={b.palette?.secondary} />
                      <Swatch color={b.palette?.accent} />
                      <Swatch color={b.palette?.neutral} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/brands/${b.slug}`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                      aria-label={`Edit ${b.name}`}
                    >
                      <Pencil className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

(The list API returns only `slug, name, logo_primary_url` today — the palette swatches will appear once Task 13 adds a detail-level list response or after you broaden the endpoint. Revisit in Task 13 if you want swatches in the list.)

- [ ] **Step 4: Write the page**

`src/app/admin/brands/page.tsx`:

```typescript
import { BrandsTable } from "@/components/brands/brands-table";

export default function AdminBrandsPage() {
  return <BrandsTable />;
}
```

- [ ] **Step 5: Manual verify**

```bash
npm run dev
# Visit http://localhost:3000/admin/brands (signed in)
```

Expected: empty-state card "No brands yet…", with a working "+ New brand" link (next page will 404 until Task 11).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/table.tsx src/components/ui/alert-dialog.tsx src/app/admin/layout.tsx src/app/admin/brands/page.tsx src/components/brands/brands-table.tsx
git commit -m "feat(admin): add /admin/brands list page"
```

---

## Task 10: Color input + image slot components

**Files:**
- Create: `src/components/brands/color-input.tsx`
- Create: `src/components/brands/image-slot.tsx`

Reusable pieces for Task 11.

- [ ] **Step 1: `color-input.tsx`**

```typescript
"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
};

export function ColorInput({ id, label, value, onChange, required, error }: Props) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {!required && <span className="text-muted-foreground font-normal"> (optional)</span>}
      </Label>
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-9 shrink-0 rounded border border-border"
          style={{ backgroundColor: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value) ? value : "transparent" }}
        />
        <Input
          id={id}
          type="text"
          placeholder="#RRGGBB"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: `image-slot.tsx`**

```typescript
"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadBrandAsset, type UploadKind } from "@/app/admin/brands/actions";

type Props = {
  slug: string;
  kind: UploadKind;
  label: string;
  required?: boolean;
  value: string | null;               // current URL
  labelValue?: string;                // optional caption
  onChange: (next: { url: string | null; label?: string }) => void;
  showLabelField?: boolean;
};

export function ImageSlot({ slug, kind, label, required, value, labelValue, onChange, showLabelField }: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handlePick(file: File) {
    if (!slug) {
      toast.error("Set a slug before uploading assets.");
      return;
    }
    setUploading(true);
    try {
      const { url } = await uploadBrandAsset(slug, kind, file);
      onChange({ url, label: labelValue });
      toast.success("Uploaded");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Label>
        {label}
        {!required && <span className="text-muted-foreground font-normal"> (optional)</span>}
      </Label>

      {value ? (
        <div className="flex items-center gap-3">
          <img src={value} alt="" className="size-16 rounded border border-border object-contain" />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UploadCloud className="mr-2 size-4" />}
              Replace
            </Button>
            {!required && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange({ url: null, label: labelValue })}
                aria-label="Remove image"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UploadCloud className="mr-2 size-4" />}
          Upload
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handlePick(f);
        }}
      />

      {showLabelField && (
        <div className="space-y-1">
          <Label className="text-xs">Label</Label>
          <Input
            value={labelValue ?? ""}
            onChange={(e) => onChange({ url: value, label: e.target.value })}
            placeholder="e.g. Hero hero shot"
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/brands/color-input.tsx src/components/brands/image-slot.tsx
git commit -m "feat(brands): add color-input and image-slot components"
```

---

## Task 11: Brand form + "new brand" page

**Files:**
- Create: `src/components/brands/brand-form.tsx`
- Create: `src/app/admin/brands/new/page.tsx`

The form is intentionally controlled with `useState` (matches `upload-form.tsx` — the repo has not yet introduced `react-hook-form`, so sticking with the simpler idiom avoids adding a dep).

- [ ] **Step 1: `brand-form.tsx`** (single file — identity, palette, typography, logos, images)

```typescript
"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Save, Trash2 } from "lucide-react";
import { ColorInput } from "./color-input";
import { ImageSlot } from "./image-slot";
import { toSlug } from "@/lib/brands/slug";
import { brandPackInputSchema, MAX_IMAGES, type BrandPack } from "@/lib/brands/schema";

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  initial?: BrandPack;
};

type FormState = {
  name: string;
  slug: string;
  slugManuallyEdited: boolean;
  palette: { primary: string; secondary: string; accent: string; neutral: string };
  font: {
    family: string;
    fallback: string;
    weights: { bold: string; semi: string; regular: string };
  };
  logo_primary_url: string | null;
  logo_alt_url: string | null;
  images: Array<{ url: string | null; label: string }>;
};

function initialState(initial?: BrandPack): FormState {
  return {
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    slugManuallyEdited: !!initial,
    palette: {
      primary: initial?.palette.primary ?? "",
      secondary: initial?.palette.secondary ?? "",
      accent: initial?.palette.accent ?? "",
      neutral: initial?.palette.neutral ?? "",
    },
    font: {
      family: initial?.font.family ?? "Inter",
      fallback: initial?.font.fallback ?? "Arial",
      weights: {
        bold: initial?.font.weights.bold ?? "Bold",
        semi: initial?.font.weights.semi ?? "Semi Bold",
        regular: initial?.font.weights.regular ?? "Regular",
      },
    },
    logo_primary_url: initial?.logo_primary_url ?? null,
    logo_alt_url: initial?.logo_alt_url ?? null,
    images: Array.from({ length: MAX_IMAGES }, (_, i) => {
      const existing = (initial?.images ?? []).find((x) => x.sort_order === i);
      return { url: existing?.url ?? null, label: existing?.label ?? "" };
    }),
  };
}

export function BrandForm({ mode, initial }: Props) {
  const router = useRouter();
  const [f, setF] = useState<FormState>(() => initialState(initial));
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const effectiveSlug = useMemo(
    () => (f.slugManuallyEdited ? f.slug : toSlug(f.name)),
    [f.name, f.slug, f.slugManuallyEdited]
  );

  function buildPayload() {
    const images = f.images
      .map((img, i) => (img.url ? { url: img.url, label: img.label.trim() || undefined, sort_order: i } : null))
      .filter(Boolean) as Array<{ url: string; label?: string; sort_order: number }>;

    const palette = {
      primary: f.palette.primary.trim(),
      secondary: f.palette.secondary.trim(),
      ...(f.palette.accent.trim() ? { accent: f.palette.accent.trim() } : {}),
      ...(f.palette.neutral.trim() ? { neutral: f.palette.neutral.trim() } : {}),
    };

    return {
      slug: effectiveSlug,
      name: f.name.trim(),
      palette,
      font: {
        family: f.font.family.trim(),
        fallback: f.font.fallback.trim(),
        weights: {
          bold: f.font.weights.bold.trim(),
          semi: f.font.weights.semi.trim(),
          regular: f.font.weights.regular.trim(),
        },
      },
      logo_primary_url: f.logo_primary_url ?? "",
      logo_alt_url: f.logo_alt_url,
      images: images.length ? images : null,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = buildPayload();
    const parsed = brandPackInputSchema.safeParse(payload);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(`${first.path.join(".")}: ${first.message}`);
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "create") {
        const res = await fetch("/api/brands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed" }));
          toast.error(err.error || "Failed to create brand");
          return;
        }
        toast.success("Brand created");
        router.push(`/admin/brands/${parsed.data.slug}`);
      } else {
        const res = await fetch(`/api/brands/${initial!.slug}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed" }));
          toast.error(err.error || "Failed to update brand");
          return;
        }
        toast.success("Saved");
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!initial) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/brands/${initial.slug}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete");
        return;
      }
      toast.success("Deleted");
      router.push("/admin/brands");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Identity */}
      <section className="space-y-4 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Identity</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="ACME" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={effectiveSlug}
              onChange={(e) => setF({ ...f, slug: e.target.value, slugManuallyEdited: true })}
              disabled={mode === "edit"}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              {mode === "edit" ? "Slug cannot be changed after creation." : "URL-safe. Auto-generated from name; override if needed."}
            </p>
          </div>
        </div>
      </section>

      {/* Palette */}
      <section className="space-y-4 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Palette</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ColorInput id="primary" label="Primary" required value={f.palette.primary} onChange={(v) => setF({ ...f, palette: { ...f.palette, primary: v } })} />
          <ColorInput id="secondary" label="Secondary" required value={f.palette.secondary} onChange={(v) => setF({ ...f, palette: { ...f.palette, secondary: v } })} />
          <ColorInput id="accent" label="Accent" value={f.palette.accent} onChange={(v) => setF({ ...f, palette: { ...f.palette, accent: v } })} />
          <ColorInput id="neutral" label="Neutral" value={f.palette.neutral} onChange={(v) => setF({ ...f, palette: { ...f.palette, neutral: v } })} />
        </div>
      </section>

      {/* Typography */}
      <section className="space-y-4 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Typography</h2>
        <p className="text-xs text-muted-foreground">
          Weight style names must match the Figma font exactly (e.g. "Semi Bold" not "SemiBold"). Figma is strict.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="font-family">Font family</Label>
            <Input id="font-family" value={f.font.family} onChange={(e) => setF({ ...f, font: { ...f.font, family: e.target.value } })} placeholder="Inter" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="font-fallback">Fallback family</Label>
            <Input id="font-fallback" value={f.font.fallback} onChange={(e) => setF({ ...f, font: { ...f.font, fallback: e.target.value } })} placeholder="Arial" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="w-bold">Bold weight style</Label>
            <Input id="w-bold" value={f.font.weights.bold} onChange={(e) => setF({ ...f, font: { ...f.font, weights: { ...f.font.weights, bold: e.target.value } } })} placeholder="Bold" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="w-semi">Semi weight style</Label>
            <Input id="w-semi" value={f.font.weights.semi} onChange={(e) => setF({ ...f, font: { ...f.font, weights: { ...f.font.weights, semi: e.target.value } } })} placeholder="Semi Bold" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="w-reg">Regular weight style</Label>
            <Input id="w-reg" value={f.font.weights.regular} onChange={(e) => setF({ ...f, font: { ...f.font, weights: { ...f.font.weights, regular: e.target.value } } })} placeholder="Regular" />
          </div>
        </div>
      </section>

      {/* Logos */}
      <section className="space-y-4 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Logos</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ImageSlot
            slug={effectiveSlug}
            kind="logo-primary"
            label="Primary logo"
            required
            value={f.logo_primary_url}
            onChange={(x) => setF({ ...f, logo_primary_url: x.url })}
          />
          <ImageSlot
            slug={effectiveSlug}
            kind="logo-alt"
            label="Alt logo"
            value={f.logo_alt_url}
            onChange={(x) => setF({ ...f, logo_alt_url: x.url })}
          />
        </div>
      </section>

      {/* Images */}
      <section className="space-y-4 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Imagery (up to 5)</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {f.images.map((img, i) => (
            <ImageSlot
              key={i}
              slug={effectiveSlug}
              kind={`image-${i}` as const}
              label={`Image ${i + 1}`}
              value={img.url}
              labelValue={img.label}
              showLabelField
              onChange={(x) => {
                const next = [...f.images];
                next[i] = { url: x.url, label: x.label ?? "" };
                setF({ ...f, images: next });
              }}
            />
          ))}
        </div>
      </section>

      <Separator />

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
          {mode === "create" ? "Create brand" : "Save changes"}
        </Button>

        {mode === "edit" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline">
                <Trash2 className="mr-2 size-4" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{initial?.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the brand record. Uploaded files stay in Storage. The Figma plugin will stop returning this brand immediately.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Deleting…" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </form>
  );
}
```

Note on shadcn v4 `<AlertDialogTrigger asChild>`: base-ui's equivalent is the `render` prop. If `asChild` fails, replace with `render={<Button type="button" variant="outline">...</Button>}`. The repo's installed shadcn `alert-dialog.tsx` will show which pattern applies — follow it exactly.

- [ ] **Step 2: `new/page.tsx`**

```typescript
import { BrandForm } from "@/components/brands/brand-form";

export default function NewBrandPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-extrabold tracking-tight">New brand</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a brand pack. You can edit everything after saving.
        </p>
      </div>
      <BrandForm mode="create" />
    </div>
  );
}
```

- [ ] **Step 3: Manual verify**

```bash
npm run dev
# Visit /admin/brands/new
```

Expected: full form renders. Uploading a file before entering a slug shows a toast "Set a slug before uploading assets." Typing a name autopopulates the slug.

- [ ] **Step 4: Commit**

```bash
git add src/components/brands/brand-form.tsx src/app/admin/brands/new/page.tsx
git commit -m "feat(admin): add brand form + /admin/brands/new page"
```

---

## Task 12: Edit page `/admin/brands/[slug]`

**Files:**
- Create: `src/app/admin/brands/[slug]/page.tsx`

- [ ] **Step 1: Write the page (server component — fetches via public GET)**

```typescript
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { BrandForm } from "@/components/brands/brand-form";
import type { BrandPack } from "@/lib/brands/schema";

type PageProps = { params: Promise<{ slug: string }> };

async function fetchBrand(slug: string): Promise<BrandPack | null> {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const res = await fetch(`${proto}://${host}/api/brands/${slug}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load brand");
  return res.json();
}

export default async function EditBrandPage({ params }: PageProps) {
  const { slug } = await params;
  const brand = await fetchBrand(slug);
  if (!brand) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-extrabold tracking-tight">{brand.name}</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{brand.slug}</p>
      </div>
      <BrandForm mode="edit" initial={brand} />
    </div>
  );
}
```

- [ ] **Step 2: Manual verify**

```bash
npm run dev
# 1. Hit /admin/brands/does-not-exist → expect Next.js 404 page
# 2. Create a brand via /admin/brands/new
# 3. Hit /admin/brands/<that-slug> → expect populated form with Delete button
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/brands/[slug]/page.tsx
git commit -m "feat(admin): add /admin/brands/[slug] edit page"
```

---

## Task 13: End-to-end smoke test

**Files:** (verification only — no new code)

- [ ] **Step 1: Run the test suite**

```bash
npm run test
```

Expected: all tests pass, including new `slug`, `schema`, `route`, `route/[slug]` tests plus all pre-existing.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Typecheck (implicit via build)**

```bash
npm run build
```

Expected: successful build.

- [ ] **Step 4: Real end-to-end in dev**

```bash
npm run dev
```

Walk through:

1. Sign in → navigate to `http://localhost:3000/admin/brands`. Expected: empty state.
2. Click "+ New brand". Fill: name "ACME Test", let slug auto-populate to `acme-test`, palette primary `#ff4422` secondary `#223355`, font defaults.
3. Upload a small PNG to "Primary logo". Expected: toast "Uploaded", thumbnail appears. Check Supabase Storage → `brand-assets/acme-test/logo-primary.png` exists.
4. Click "Create brand". Expected: toast "Brand created", redirected to `/admin/brands/acme-test`.
5. Verify the populated form shows all your values.
6. Visit `http://localhost:3000/api/brands` in a private tab (no auth). Expected JSON: `{ "brands": [{ "slug": "acme-test", "name": "ACME Test", "logo_primary_url": "https://...logo-primary.png?v=..." }] }`.
7. Visit `http://localhost:3000/api/brands/acme-test` in a private tab. Expected: full `BrandPack` JSON including palette, font, logo URLs.
8. Back at `/admin/brands/acme-test`, click Delete → confirm. Expected: redirected back to `/admin/brands`, brand gone.
9. Re-hit `/api/brands` — expected: `{ "brands": [] }`.

- [ ] **Step 5: No commit needed** — this task is verification.

---

## Out of scope (not planned, per spec)

- Auth / roles — any signed-in Clerk user is an admin.
- Preview panel (rendering a sample Figma template with the brand applied).
- Versioning, drafts, audit log, soft-delete.
- Client-facing UI.
- Font file uploads (Figma plugins can't install fonts).
- Bulk imagery admin (the 5-slot grid on the edit page IS the entry point).
- Storage garbage collection (deleted brands leak files in Storage; acceptable for v1, revisit if it becomes a problem).

---

## Plugin contract (informational — do not implement here)

The plugin will:

1. `GET /api/brands` → populate a dropdown with `{ slug, name, logo_primary_url }`.
2. On selection, `GET /api/brands/<slug>` → receive the full `BrandPack` type defined in `src/lib/brands/schema.ts` and mirrored in the plugin repo.
3. Fonts: plugin can't install font files — it will use `BrandPack.font.family` and `.weights.*` as exact Figma style names and assume the font is available in the user's Figma account.
4. Storage URLs are public and cache-busted via `?v=<timestamp>`; the plugin can `fetch(url).then(r => r.arrayBuffer())` to import into Figma.

---

## Critical Files for Implementation

- /Users/grozenblat/Desktop/GlueSkills/supabase/migrations/005_brands.sql
- /Users/grozenblat/Desktop/GlueSkills/src/lib/brands/schema.ts
- /Users/grozenblat/Desktop/GlueSkills/src/app/api/brands/route.ts
- /Users/grozenblat/Desktop/GlueSkills/src/app/admin/brands/actions.ts
- /Users/grozenblat/Desktop/GlueSkills/src/components/brands/brand-form.tsx
