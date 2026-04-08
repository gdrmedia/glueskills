# GlueSkills — Initial Build Summary
**Date:** 2026-04-07

## What Was Built

GlueSkills is a fast, lean dashboard with utility tools for creatives (designers, copywriters, strategists, SEO specialists). The priority was speed — instant page transitions, no full database reloads between sections.

## Tech Stack

- **Next.js 16** (App Router) + TypeScript
- **Clerk** — authentication (using `proxy.ts` with `clerkMiddleware()`, `<Show>` component)
- **Supabase** (free tier) — database (schema created but tools are mostly client-side)
- **shadcn/ui** (v4, base-ui based — uses `render` prop, not `asChild`)
- **TanStack Query** — client-side caching with 5-min staleTime
- **Tailwind CSS v4**
- **Resend** — for feedback emails
- **Vercel** — deployment target

## Architecture

- **Persistent dashboard shell** — sidebar + header never re-render between pages
- **Sidebar** — top-level categories only (Designer, Copywriter, Strategist, SEO)
- **Category pages** — big icon cards linking to individual tools
- **Tools** — almost all client-side for instant performance (except web scraper which uses `/api/scrape` server route)
- **Color-coded sections** — purple (Designer), teal (Copywriter), orange (Strategist), rose (SEO)
- **Font** — Inter (sans-serif) + JetBrains Mono (monospace), set directly on `body` in globals.css

## All 22 Tools

### Designer (purple) — `/dashboard/designer/*`
1. **Image Resizer** — upload, resize with social media presets, download PNG
2. **Color Palette** — generate palettes (analogous, complementary, triadic, monochromatic, random) from a base color
3. **Aspect Ratio Calculator** — calculate ratios, scale to new sizes, common presets
4. **Contrast Checker** — WCAG AA/AAA pass/fail with live preview
5. **Gradient Generator** — linear/radial/conic CSS gradients with multi-stop color controls
6. **Font Pairer** — browse 12 Google Font pairings with live preview and type scale

### Copywriter (teal) — `/dashboard/copywriter/*`
7. **Word Counter** — words, chars, sentences, paragraphs, reading time, platform limit badges
8. **Headline Analyzer** — score ring (0-100), power words, emotional words, suggestions
9. **Lorem Generator** — paragraphs/sentences/words with seeded randomization
10. **Readability Score** — Flesch-Kincaid, Gunning Fog, Coleman-Liau, SMOG with gauge bars
11. **Email Subject Tester** — spam word detection, power words, inbox preview, mobile truncation

### Strategist (orange) — `/dashboard/strategist/*`
12. **SWOT Builder** — color-coded 4-quadrant editor, copy/export as .md
13. **Brief Builder** — 9-field creative brief template, export as .md
14. **Competitor Tracker** — add multiple competitors with structured fields, export
15. **Persona Builder** — multi-persona tabs with demographics, goals, pain points, export
16. **Budget Calculator** — line items with categories, budget cap, category breakdown bars, CSV export

### SEO (rose) — `/dashboard/seo/*`
17. **Web Scraper** — server-side URL fetch, meta tag extraction, heading structure, SEO quick check
18. **Keyword Density** — single words, bigrams, trigrams with density bars, target keyword tracking
19. **Meta Tag Preview** — Google + social preview, generated HTML code with copy
20. **Schema Generator** — JSON-LD for Article, FAQ, Product, LocalBusiness, Event
21. **OG Debugger** — Facebook, Twitter, Google previews with raw tag display

## Key Files

- `src/proxy.ts` — Clerk middleware (protects `/dashboard/*`)
- `src/app/layout.tsx` — root layout with ClerkProvider, QueryProvider, TooltipProvider
- `src/app/dashboard/layout.tsx` — persistent dashboard shell (sidebar + header + toaster)
- `src/components/dashboard/sidebar.tsx` — top-level nav categories
- `src/components/dashboard/tool-grid.tsx` — reusable color-coded tool card grid
- `src/components/dashboard/feedback-dialog.tsx` — feedback popup (bug/feature request)
- `src/app/api/scrape/route.ts` — server-side URL scraper for SEO tools
- `src/app/api/feedback/route.ts` — sends feedback emails via Resend (includes user name + email from Clerk)
- `supabase/migrations/001_initial_schema.sql` — database schema (briefs, copy_items, assets, calendar_events, notes — from original plan, not actively used by current tools)
- `.env.local` — Clerk keys, Supabase keys, Resend API key

## Feedback System

- "Feedback" button in header opens a dialog with Bug / Feature Request selection
- Sends email to guillermo.rozenblat@glueiq.com via Resend API
- Email includes user's name and email address (fetched from Clerk)

## Logo

- `/assets/glueskills-logo.png` (source) → `/public/glueskills-logo.png` (served)
- Displayed in sidebar and mobile menu at `h-[2.5rem]`

## Notes for Next Session

- shadcn v4 uses **base-ui** (not Radix) — components use `render` prop instead of `asChild`
- Clerk uses `proxy.ts` (not `middleware.ts`), `<Show when="signed-in">` (not `<SignedIn>`)
- The Supabase schema/types/hooks still exist but aren't actively used by the current tool-based architecture — they were from an earlier CRUD-based design that was replaced
- All tools are client-side except the web scraper and OG debugger (which hit `/api/scrape`)
- Font is set directly on `body` in `globals.css` because Tailwind v4 `@theme` variables can't resolve Next.js font loader CSS variables at definition time
