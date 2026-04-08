@AGENTS.md

# GlueSkills

Dashboard with 22 utility tools for creatives (designers, copywriters, strategists, SEO specialists). Priority is speed — instant transitions, client-side tools, no unnecessary server round-trips.

## Tech Stack

- **Next.js 16** (App Router) + TypeScript
- **Clerk** auth — uses `src/proxy.ts` with `clerkMiddleware()`, NOT `middleware.ts`
- **Supabase** (free tier) — schema exists but tools are client-side; DB not actively used
- **shadcn/ui v4** — based on **base-ui**, NOT Radix. Uses `render` prop, NOT `asChild`
- **TanStack Query** — client-side caching, 5-min staleTime
- **Tailwind CSS v4**
- **Resend** — feedback emails to guillermo.rozenblat@glueiq.com
- **Vercel** — deployment target

## Critical Gotchas

1. **shadcn v4 = base-ui**: Components use `render` prop instead of `asChild`. Do NOT use Radix patterns.
2. **Clerk uses `proxy.ts`**, not `middleware.ts`. Auth component is `<Show when="signed-in">`, NOT `<SignedIn>`.
3. **Font is set on `body` in `globals.css`** — Tailwind v4 `@theme` variables can't resolve Next.js font loader CSS vars at definition time. Don't try to move fonts into theme config.
4. **All tools are client-side** except Web Scraper and OG Debugger (which hit `/api/scrape`).
5. **Next.js 16 has breaking changes** — always read `node_modules/next/dist/docs/` before writing Next.js code.

## Architecture

- **Persistent dashboard shell** — sidebar + header never re-render between pages (`src/app/dashboard/layout.tsx`)
- **Color-coded sections**: purple (Designer), teal (Copywriter), orange (Strategist), rose (SEO)
- **Font stack**: Inter (sans) + JetBrains Mono (mono)

## Key Files

| File | Purpose |
|------|---------|
| `src/proxy.ts` | Clerk middleware (protects `/dashboard/*`) |
| `src/app/layout.tsx` | Root layout: ClerkProvider, QueryProvider, TooltipProvider |
| `src/app/dashboard/layout.tsx` | Dashboard shell (sidebar + header + toaster) |
| `src/components/dashboard/sidebar.tsx` | Top-level nav categories |
| `src/components/dashboard/tool-grid.tsx` | Reusable color-coded tool card grid |
| `src/components/dashboard/feedback-dialog.tsx` | Feedback popup (bug/feature request) |
| `src/app/api/scrape/route.ts` | Server-side URL scraper for SEO tools |
| `src/app/api/feedback/route.ts` | Feedback emails via Resend (includes Clerk user info) |
| `.env.local` | Clerk keys, Supabase keys, Resend API key |

## Tool Routes

- Designer (6 tools): `/dashboard/designer/*`
- Copywriter (5 tools): `/dashboard/copywriter/*`
- Strategist (5 tools): `/dashboard/strategist/*`
- SEO (5 tools): `/dashboard/seo/*`

## Logo

`/public/glueskills-logo.png` — displayed in sidebar and mobile menu at `h-[2.5rem]`
