# Banner Resizer Figma Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Figma plugin half of the Banner Resizer feature. Designer pastes the 6-character code from the GlueSkills web wizard, the plugin fetches the job config, scans the file for source frames, lets the designer override the auto-mapped source→target assignments, then generates resized banner frames inside the same Figma file.

**Architecture:** Standard Figma plugin — TypeScript code in two contexts: a **sandbox** (`code.ts`, has Figma scene-graph API but no DOM) and a **UI iframe** (`ui.tsx`, has DOM/React but no Figma API). The two halves communicate via `postMessage`. The sandbox calls the Supabase `consume_banner_job` RPC over HTTPS using the Supabase anon key (embedded in the plugin bundle — safe because the RPC is the only path and the 6-char code is the bearer token).

**Tech Stack:** TypeScript, React 19, Webpack 5 (Figma plugins need bundled output), `@figma/plugin-typings` for the Figma API types, `@supabase/supabase-js` for the RPC call, Vitest for unit tests.

**Repo:** New repository `glueskills-banner-resizer-plugin` (separate from the Next.js app — Figma plugins ship independently and have their own build pipeline).

**Spec:** `docs/superpowers/specs/2026-04-15-banner-resizer-design.md` (in the GlueSkills web repo)

---

## File Structure

**Repo root:**
- `manifest.json` — Figma plugin manifest
- `package.json` — deps, scripts
- `tsconfig.json` — strict TS for sandbox
- `tsconfig.ui.json` — separate TS config for the UI (jsx)
- `webpack.config.js` — bundles `code.ts` and `ui.tsx` separately
- `vitest.config.ts`
- `.gitignore`
- `README.md`

**`src/`:**
- `code.ts` — sandbox entry, registers UI, routes messages
- `shared/types.ts` — `BannerJobConfig` (duplicated from web `src/lib/banner-jobs/job-config.ts`)
- `shared/messages.ts` — typed message contracts for sandbox↔UI
- `api/consume-job.ts` — Supabase RPC wrapper
- `algorithm/auto-map.ts` — closest-aspect-ratio matching
- `algorithm/role-detectors.ts` — name/type-based role classification
- `algorithm/name-frame.ts` — frame naming pattern resolution
- `algorithm/pass-1-resize.ts` — clone source frame, resize, place
- `algorithm/pass-2-roles.ts` — walk children, apply role-specific adjustments
- `algorithm/pass-3-validate.ts` — bounds/overflow checks, add ⚠ Review badge
- `algorithm/place-frames.ts` — new-page vs current-page placement
- `algorithm/run-job.ts` — orchestrates passes 1→3 for all (source, target) pairs

**`src/ui/`:**
- `ui.html` — minimal iframe shell that loads `ui.js`
- `ui.tsx` — React entry, renders `App`
- `App.tsx` — top-level state machine (code-entry → source-picker → mapping → progress → done)
- `code-entry.tsx`
- `source-picker.tsx`
- `mapping-list.tsx`
- `progress.tsx`
- `ui.css` — minimal Figma-flavored styling

**`tests/`:**
- `auto-map.test.ts`
- `role-detectors.test.ts`
- `name-frame.test.ts`

---

## Task 1: Bootstrap the plugin repo

Creates the new repository with all the boilerplate the rest of the tasks build on. Plugins have specific manifest requirements; webpack splits into two bundles (sandbox + UI) that share no globals.

**Files:** all new, all in a brand-new git repo at `~/Desktop/glueskills-banner-resizer-plugin/` (sibling to the GlueSkills repo).

- [ ] **Step 1: Create the repo and initialize**

```bash
mkdir -p ~/Desktop/glueskills-banner-resizer-plugin
cd ~/Desktop/glueskills-banner-resizer-plugin
git init
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "glueskills-banner-resizer-plugin",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "webpack --mode=production",
    "watch": "webpack --mode=development --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit && tsc --noEmit -p tsconfig.ui.json"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.102.1",
    "react": "^19.2.4",
    "react-dom": "^19.2.4"
  },
  "devDependencies": {
    "@figma/plugin-typings": "^1.115.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "css-loader": "^7.1.0",
    "html-webpack-inline-source-plugin": "^1.0.0-beta.2",
    "html-webpack-plugin": "^5.6.0",
    "style-loader": "^4.0.0",
    "ts-loader": "^9.5.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "webpack": "^5.95.0",
    "webpack-cli": "^5.1.0"
  }
}
```

- [ ] **Step 3: Create `manifest.json`**

```json
{
  "name": "GlueSkills Banner Resizer",
  "id": "glueskills-banner-resizer",
  "api": "1.0.0",
  "main": "dist/code.js",
  "ui": "dist/ui.html",
  "editorType": ["figma"],
  "networkAccess": {
    "allowedDomains": ["https://*.supabase.co"],
    "reasoning": "Fetches banner-resize job configs created in the GlueSkills web app, stored in Supabase."
  },
  "permissions": ["currentuser"]
}
```

> The `id` here is a placeholder for local development. When publishing to Figma Community, Figma assigns a real ID — replace this with the assigned ID at publish time.

- [ ] **Step 4: Create `tsconfig.json` (sandbox)**

```json
{
  "compilerOptions": {
    "target": "es2017",
    "module": "commonjs",
    "lib": ["es2017"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "typeRoots": ["./node_modules/@types", "./node_modules/@figma"],
    "types": ["@figma/plugin-typings"]
  },
  "include": ["src/code.ts", "src/algorithm/**/*.ts", "src/api/**/*.ts", "src/shared/**/*.ts"]
}
```

- [ ] **Step 5: Create `tsconfig.ui.json` (UI iframe)**

```json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "esnext",
    "moduleResolution": "bundler",
    "lib": ["es2020", "dom"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "noEmit": true
  },
  "include": ["src/ui/**/*.ts", "src/ui/**/*.tsx", "src/shared/**/*.ts"]
}
```

- [ ] **Step 6: Create `webpack.config.js`**

```js
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = (env, argv) => ({
  mode: argv.mode === "production" ? "production" : "development",
  devtool: argv.mode === "production" ? false : "inline-source-map",

  entry: {
    code: "./src/code.ts",
    ui: "./src/ui/ui.tsx",
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: (file) => (file.endsWith(".tsx") ? "tsconfig.ui.json" : "tsconfig.json"),
            },
          },
        ],
      },
      { test: /\.css$/, use: ["style-loader", "css-loader"] },
    ],
  },

  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },

  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist"),
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/ui/ui.html",
      filename: "ui.html",
      chunks: ["ui"],
      inject: "body",
      cache: false,
    }),
  ],
});
```

- [ ] **Step 7: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 8: Create `.gitignore`**

```
node_modules/
dist/
.env
.env.local
.DS_Store
*.log
```

- [ ] **Step 9: Create a stub `README.md`**

```markdown
# GlueSkills Banner Resizer (Figma Plugin)

Companion plugin for the GlueSkills Banner Resizer web tool.
Pastes a 6-character pickup code → fetches job config from Supabase → generates resized banner frames in the current Figma file.

See spec at `<glueskills-repo>/docs/superpowers/specs/2026-04-15-banner-resizer-design.md`.

## Develop

```
npm install
npm run watch    # rebuilds on save
```

In Figma desktop: Plugins → Development → Import plugin from manifest → select `manifest.json`.
```

- [ ] **Step 10: Install deps**

```bash
npm install
```

Expected: dependencies install. Vitest, webpack, react, supabase-js, plugin-typings all resolved.

- [ ] **Step 11: First commit**

```bash
git add .
git commit -m "chore: bootstrap glueskills-banner-resizer-plugin repo"
```

---

## Task 2: Shared types and message contracts

`BannerJobConfig` is the contract with the web side. Duplicate the type from the web repo verbatim. Message types define the sandbox↔UI protocol.

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/messages.ts`

- [ ] **Step 1: Create `src/shared/types.ts`**

```ts
// CONTRACT WITH WEB SIDE — keep in sync with:
// glueskills-repo/src/lib/banner-jobs/job-config.ts
//
// If you change this, change it in the web repo too. Both bundles must agree.

export type BannerJobTarget = {
  width: number;
  height: number;
  label?: string;
  isCustom: boolean;
};

export type BannerJobOptions = {
  placeOnNewPage: boolean;
  namingPattern: "size" | "size-job" | "size-source";
};

export type BannerJobConfig = {
  version: 1;
  targets: BannerJobTarget[];
  options: BannerJobOptions;
};

export type BannerJobResponse = {
  name: string;
  config: BannerJobConfig;
};

// Source frame info the UI shows in the picker / mapping list
export type SourceFrame = {
  id: string;            // Figma node id
  name: string;          // user-visible layer name
  width: number;
  height: number;
};

// Final mapping decision (one row per target)
export type Mapping = {
  target: BannerJobTarget;
  sourceId: string;      // chosen source frame's id
};

// Per-frame validation issue
export type FrameFlag = "out-of-bounds" | "text-overflow" | "tiny-node" | "all-hidden" | null;
```

- [ ] **Step 2: Create `src/shared/messages.ts`**

```ts
import type { BannerJobResponse, BannerJobConfig, Mapping, SourceFrame } from "./types";

// Messages from UI iframe → sandbox
export type UiToSandbox =
  | { type: "fetch-job"; code: string }
  | { type: "scan-frames" }
  | { type: "generate"; jobName: string; config: BannerJobConfig; mappings: Mapping[] }
  | { type: "cancel" }
  | { type: "close" };

// Messages from sandbox → UI iframe
export type SandboxToUi =
  | { type: "job-fetched"; job: BannerJobResponse }
  | { type: "fetch-error"; error: "not_found" | "expired" | "already_used" | "network" }
  | { type: "frames-scanned"; frames: SourceFrame[]; selectionUsed: boolean }
  | { type: "generate-progress"; done: number; total: number }
  | { type: "generate-complete"; pageId: string; pageName: string; flagged: number; total: number }
  | { type: "generate-error"; error: string };
```

- [ ] **Step 3: Verify it typechecks**

```bash
npm run typecheck
```

Expected: no errors. (Both `tsconfig.json` and `tsconfig.ui.json` include `src/shared/`.)

- [ ] **Step 4: Commit**

```bash
git add src/shared/types.ts src/shared/messages.ts
git commit -m "feat: shared types and sandbox<->ui message contracts"
```

---

## Task 3: Supabase consume-job client

Wraps `consume_banner_job(text)` RPC. Lives in the sandbox (the iframe doesn't make network calls — the sandbox does, then forwards the result via postMessage).

**Files:**
- Create: `src/api/consume-job.ts`
- Create: `.env.example` (not loaded — Figma plugins don't read .env. The values are baked into the bundle. Document them in `.env.example` so contributors know what to swap.)

- [ ] **Step 1: Create `.env.example`**

```
# Public Supabase config — these get bundled into the plugin (anon key is safe to embed)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
```

> **Note:** Figma plugins are pure JS bundles — no env at runtime. We'll inline the production values directly in `consume-job.ts`. The `.env.example` documents what they are. This is the same pattern the official Figma plugin examples use for backend URLs/keys.

- [ ] **Step 2: Implement `src/api/consume-job.ts`**

```ts
// src/api/consume-job.ts
import { createClient } from "@supabase/supabase-js";
import type { BannerJobResponse } from "../shared/types";

// PRODUCTION VALUES — these match the GlueSkills Supabase project.
// Anon key is safe to embed; the consume_banner_job RPC enforces auth via the
// 6-char code, not Supabase's JWT. See spec §5.
const SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type ConsumeJobError = "not_found" | "expired" | "already_used" | "network";
export type ConsumeJobResult =
  | { ok: true; job: BannerJobResponse }
  | { ok: false; error: ConsumeJobError };

export async function consumeJob(code: string): Promise<ConsumeJobResult> {
  try {
    const { data, error } = await supabase.rpc("consume_banner_job", { job_code: code });
    if (error) {
      console.error("Supabase RPC error:", error);
      return { ok: false, error: "network" };
    }
    if (!data) {
      return { ok: false, error: "not_found" };
    }
    if (typeof data === "object" && "error" in data) {
      const e = (data as { error: string }).error;
      if (e === "not_found" || e === "expired" || e === "already_used") {
        return { ok: false, error: e };
      }
      return { ok: false, error: "network" };
    }
    // RPC returned { name, config } on success
    return { ok: true, job: data as BannerJobResponse };
  } catch (e) {
    console.error("consumeJob threw:", e);
    return { ok: false, error: "network" };
  }
}
```

> **Before publishing:** Replace `YOUR_PROJECT_REF` and `YOUR_ANON_KEY` with the actual values from the GlueSkills Supabase dashboard → Settings → API. They are public values, safe to commit to a public repo.

- [ ] **Step 3: Verify it typechecks**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/api/consume-job.ts .env.example
git commit -m "feat: add Supabase consume_banner_job RPC client"
```

---

## Task 4: Auto-mapping algorithm (TDD)

Pure function: given target sizes + source frames, returns a mapping where each target picks the source whose aspect ratio is closest. Tested in isolation.

**Files:**
- Create: `src/algorithm/auto-map.ts`
- Create: `tests/auto-map.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/auto-map.test.ts
import { describe, expect, it } from "vitest";
import { autoMap } from "../src/algorithm/auto-map";
import type { SourceFrame, BannerJobTarget } from "../src/shared/types";

const makeSrc = (id: string, w: number, h: number, name = id): SourceFrame => ({
  id,
  name,
  width: w,
  height: h,
});

const makeTarget = (w: number, h: number): BannerJobTarget => ({
  width: w,
  height: h,
  isCustom: false,
});

describe("autoMap", () => {
  it("returns one mapping per target", () => {
    const sources = [makeSrc("a", 300, 250), makeSrc("b", 728, 90)];
    const targets = [makeTarget(300, 250), makeTarget(336, 280), makeTarget(970, 90)];
    const result = autoMap(sources, targets);
    expect(result).toHaveLength(3);
  });

  it("picks the closest aspect-ratio source for each target", () => {
    const sources = [
      makeSrc("medRect", 300, 250),       // ratio 1.20
      makeSrc("leaderboard", 728, 90),    // ratio 8.09
      makeSrc("skyscraper", 160, 600),    // ratio 0.27
      makeSrc("billboard", 970, 250),     // ratio 3.88
    ];

    // Target ratio matches medRect best
    expect(autoMap(sources, [makeTarget(336, 280)])[0].sourceId).toBe("medRect");

    // Target ratio matches leaderboard best
    expect(autoMap(sources, [makeTarget(970, 90)])[0].sourceId).toBe("leaderboard");

    // Target ratio matches skyscraper best
    expect(autoMap(sources, [makeTarget(120, 600)])[0].sourceId).toBe("skyscraper");

    // Target ratio matches billboard best
    expect(autoMap(sources, [makeTarget(1200, 300)])[0].sourceId).toBe("billboard");
  });

  it("handles a single source by mapping all targets to it", () => {
    const sources = [makeSrc("only", 300, 250)];
    const targets = [makeTarget(728, 90), makeTarget(160, 600), makeTarget(300, 250)];
    const result = autoMap(sources, targets);
    expect(result.every((m) => m.sourceId === "only")).toBe(true);
  });

  it("returns empty mapping when sources is empty", () => {
    const result = autoMap([], [makeTarget(300, 250)]);
    expect(result).toEqual([]);
  });

  it("breaks ties by preferring the source closer in absolute area", () => {
    // Both are square (ratio 1.0)
    const sources = [makeSrc("small", 100, 100), makeSrc("big", 1000, 1000)];
    // Target is 200x200 — closer in area to small
    const result = autoMap(sources, [makeTarget(200, 200)]);
    expect(result[0].sourceId).toBe("small");
  });
});
```

- [ ] **Step 2: Run the test (expect failure)**

```bash
npm test
```
Expected: FAIL — `autoMap` not found.

- [ ] **Step 3: Implement `autoMap`**

```ts
// src/algorithm/auto-map.ts
import type { BannerJobTarget, Mapping, SourceFrame } from "../shared/types";

export function autoMap(sources: SourceFrame[], targets: BannerJobTarget[]): Mapping[] {
  if (sources.length === 0) return [];

  return targets.map((target) => {
    const targetRatio = target.width / target.height;
    const targetArea = target.width * target.height;

    let best = sources[0];
    let bestScore = scoreFor(best, targetRatio, targetArea);

    for (let i = 1; i < sources.length; i++) {
      const score = scoreFor(sources[i], targetRatio, targetArea);
      if (score < bestScore) {
        best = sources[i];
        bestScore = score;
      }
    }

    return { target, sourceId: best.id };
  });
}

function scoreFor(source: SourceFrame, targetRatio: number, targetArea: number): number {
  const sourceRatio = source.width / source.height;
  // Use log ratio so 2x and 0.5x are equally bad
  const ratioPenalty = Math.abs(Math.log(sourceRatio / targetRatio));
  // Tie-breaker: relative area difference (small contribution)
  const sourceArea = source.width * source.height;
  const areaPenalty = Math.abs(Math.log(sourceArea / targetArea)) * 0.05;
  return ratioPenalty + areaPenalty;
}
```

- [ ] **Step 4: Run the test (expect pass)**

```bash
npm test
```
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/algorithm/auto-map.ts tests/auto-map.test.ts
git commit -m "feat: auto-map targets to closest aspect-ratio source"
```

---

## Task 5: Role detectors (TDD)

Pure function: classifies a node by name + minimal type hints into one of: `logo`, `cta`, `background`, `headline`, `body`, `image`, `other`. Tested with fixture node descriptors.

**Files:**
- Create: `src/algorithm/role-detectors.ts`
- Create: `tests/role-detectors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/role-detectors.test.ts
import { describe, expect, it } from "vitest";
import { detectRole, type NodeDescriptor } from "../src/algorithm/role-detectors";

const node = (overrides: Partial<NodeDescriptor>): NodeDescriptor => ({
  name: "",
  type: "RECTANGLE",
  fontSize: undefined,
  hasImageFill: false,
  textCharCount: undefined,
  area: 100,
  zIndex: 0,
  ...overrides,
});

describe("detectRole", () => {
  it("classifies logo by name", () => {
    expect(detectRole(node({ name: "Logo" }))).toBe("logo");
    expect(detectRole(node({ name: "Brand mark" }))).toBe("logo");
    expect(detectRole(node({ name: "Wordmark Final" }))).toBe("logo");
    expect(detectRole(node({ name: "MAIN LOGO" }))).toBe("logo");
  });

  it("classifies CTA buttons", () => {
    expect(detectRole(node({ name: "CTA" }))).toBe("cta");
    expect(detectRole(node({ name: "Buy Button" }))).toBe("cta");
    expect(detectRole(node({ name: "btn-primary" }))).toBe("cta");
  });

  it("classifies background by name", () => {
    expect(detectRole(node({ name: "BG" }))).toBe("background");
    expect(detectRole(node({ name: "Background" }))).toBe("background");
    expect(detectRole(node({ name: "bg-image" }))).toBe("background");
  });

  it("classifies background by being the largest fill behind everything", () => {
    expect(detectRole(node({ name: "rect", area: 10000, zIndex: 0 }))).toBe("background");
  });

  it("classifies headline by font size", () => {
    expect(detectRole(node({ name: "Title", type: "TEXT", fontSize: 36 }))).toBe("headline");
    expect(detectRole(node({ name: "Title", type: "TEXT", fontSize: 24 }))).toBe("headline");
  });

  it("classifies headline by name even at small font size", () => {
    expect(detectRole(node({ name: "Headline", type: "TEXT", fontSize: 14 }))).toBe("headline");
    expect(detectRole(node({ name: "h1", type: "TEXT", fontSize: 12 }))).toBe("headline");
  });

  it("classifies body text", () => {
    expect(detectRole(node({ name: "Description", type: "TEXT", fontSize: 14 }))).toBe("body");
    expect(detectRole(node({ name: "Subtitle", type: "TEXT", fontSize: 18 }))).toBe("body");
  });

  it("classifies images by image fill", () => {
    expect(detectRole(node({ name: "Hero photo", hasImageFill: true }))).toBe("image");
  });

  it("falls through to 'other' for unrecognized nodes", () => {
    expect(detectRole(node({ name: "decorative dot" }))).toBe("other");
    expect(detectRole(node({ name: "spacer", type: "FRAME" }))).toBe("other");
  });

  it("treats CTA detection as higher priority than background even with matching area", () => {
    expect(
      detectRole(node({ name: "Buy now Button", area: 100000, zIndex: 0 }))
    ).toBe("cta");
  });
});
```

- [ ] **Step 2: Run the test (expect failure)**

```bash
npm test
```
Expected: FAIL — `detectRole` not found.

- [ ] **Step 3: Implement `detectRole`**

```ts
// src/algorithm/role-detectors.ts

export type Role = "logo" | "cta" | "background" | "headline" | "body" | "image" | "other";

export type NodeDescriptor = {
  name: string;
  type: string;            // Figma node type, e.g. "TEXT", "RECTANGLE", "FRAME"
  fontSize?: number;       // for TEXT nodes
  hasImageFill: boolean;
  textCharCount?: number;  // for TEXT nodes
  area: number;            // width * height
  zIndex: number;          // 0 = bottom of stack
};

const LOGO_RE = /\b(logo|brand|wordmark)\b/i;
const CTA_RE = /\b(cta|button|btn)\b/i;
const BG_RE = /\b(bg|background)\b/i;
const HEADLINE_NAME_RE = /\b(headline|title|h1)\b/i;

const HEADLINE_FONT_THRESHOLD = 24;
const BACKGROUND_AREA_FALLBACK_THRESHOLD = 5000; // rough — caller can pass actual frame area later

export function detectRole(node: NodeDescriptor): Role {
  // Highest priority: explicit name patterns
  if (LOGO_RE.test(node.name)) return "logo";
  if (CTA_RE.test(node.name)) return "cta";
  if (BG_RE.test(node.name)) return "background";

  // Headline by name OR by font size
  if (node.type === "TEXT") {
    if (HEADLINE_NAME_RE.test(node.name)) return "headline";
    if (node.fontSize !== undefined && node.fontSize >= HEADLINE_FONT_THRESHOLD) return "headline";
    return "body";
  }

  // Image by fill
  if (node.hasImageFill) return "image";

  // Background fallback: large rectangle at the bottom of the stack
  if (
    (node.type === "RECTANGLE" || node.type === "FRAME") &&
    node.area >= BACKGROUND_AREA_FALLBACK_THRESHOLD &&
    node.zIndex === 0
  ) {
    return "background";
  }

  return "other";
}
```

- [ ] **Step 4: Run the test (expect pass)**

```bash
npm test
```
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/algorithm/role-detectors.ts tests/role-detectors.test.ts
git commit -m "feat: role detection from layer names + types"
```

---

## Task 6: Frame naming (TDD)

Pure function: given a target size, the job name, the source frame name, and the chosen pattern, returns the new frame's name.

**Files:**
- Create: `src/algorithm/name-frame.ts`
- Create: `tests/name-frame.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/name-frame.test.ts
import { describe, expect, it } from "vitest";
import { nameFrame } from "../src/algorithm/name-frame";

describe("nameFrame", () => {
  it("formats 'size' pattern as WIDTHxHEIGHT", () => {
    expect(
      nameFrame({ width: 728, height: 90 }, "Q2 Spring", "Hero v3", "size")
    ).toBe("728x90");
  });

  it("formats 'size-job' pattern as WxH — Job name", () => {
    expect(
      nameFrame({ width: 300, height: 250 }, "Q2 Spring", "Hero v3", "size-job")
    ).toBe("300x250 — Q2 Spring");
  });

  it("formats 'size-source' pattern as WxH — Source name", () => {
    expect(
      nameFrame({ width: 300, height: 250 }, "Q2 Spring", "Hero v3", "size-source")
    ).toBe("300x250 — Hero v3");
  });
});
```

- [ ] **Step 2: Run the test (expect failure)**

```bash
npm test
```
Expected: FAIL — `nameFrame` not found.

- [ ] **Step 3: Implement `nameFrame`**

```ts
// src/algorithm/name-frame.ts
import type { BannerJobOptions, BannerJobTarget } from "../shared/types";

export function nameFrame(
  target: Pick<BannerJobTarget, "width" | "height">,
  jobName: string,
  sourceName: string,
  pattern: BannerJobOptions["namingPattern"]
): string {
  const size = `${target.width}x${target.height}`;
  switch (pattern) {
    case "size":
      return size;
    case "size-job":
      return `${size} — ${jobName}`;
    case "size-source":
      return `${size} — ${sourceName}`;
  }
}
```

- [ ] **Step 4: Run the test (expect pass)**

```bash
npm test
```
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/algorithm/name-frame.ts tests/name-frame.test.ts
git commit -m "feat: frame naming pattern resolution"
```

---

## Task 7: Pass 1 — clone & resize

Clones the source frame, resizes it to the target dimensions, returns the new clone. Figma's native `resize()` respects existing constraints, which gives us the baseline pass.

**Files:**
- Create: `src/algorithm/pass-1-resize.ts`

- [ ] **Step 1: Implement Pass 1**

```ts
// src/algorithm/pass-1-resize.ts
// Sandbox-only — uses figma.* APIs.

export function pass1ResizeClone(
  source: FrameNode,
  targetWidth: number,
  targetHeight: number
): FrameNode {
  const clone = source.clone();
  // Reset to source dimensions explicitly first (clone preserves them anyway,
  // but being explicit makes the resize() call deterministic).
  clone.resize(source.width, source.height);
  // Now resize to target. Figma's native constraints (top/bottom/left/right/
  // center anchors, "scale" mode) take effect during this call.
  clone.resize(targetWidth, targetHeight);
  return clone;
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```
Expected: no errors. (`FrameNode` resolves from `@figma/plugin-typings`.)

- [ ] **Step 3: Commit**

```bash
git add src/algorithm/pass-1-resize.ts
git commit -m "feat: pass 1 — clone source frame and resize"
```

---

## Task 8: Pass 2 — role-aware micro-adjust

Walks the cloned frame's children, classifies each via `detectRole`, applies role-specific adjustments per the spec table.

**Files:**
- Create: `src/algorithm/pass-2-roles.ts`

- [ ] **Step 1: Implement Pass 2**

```ts
// src/algorithm/pass-2-roles.ts
// Sandbox-only — uses figma.* APIs.
import { detectRole, type NodeDescriptor, type Role } from "./role-detectors";

const HEADLINE_MIN_SHRINK_RATIO = 0.3; // hide if must shrink more than this

export async function pass2Roles(
  clone: FrameNode,
  source: FrameNode,
  targetWidth: number,
  targetHeight: number
): Promise<void> {
  const sourceArea = source.width * source.height;
  const targetArea = targetWidth * targetHeight;
  const areaScale = Math.sqrt(targetArea / sourceArea);

  // Walk top-level children of the clone (we don't recurse into nested groups
  // — Figma constraints handle inner structure).
  const children = [...clone.children]; // snapshot — we'll mutate during iteration

  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    const descriptor = describe(node, i);
    const role = detectRole(descriptor);

    switch (role) {
      case "logo":
        adjustLogo(node, targetWidth, targetHeight, source);
        break;
      case "cta":
        adjustCta(node, targetWidth, targetHeight, source);
        break;
      case "background":
        adjustBackground(node, targetWidth, targetHeight);
        break;
      case "headline":
        await adjustText(node, areaScale, targetWidth, targetHeight, /* hideOnOverflow */ false);
        break;
      case "body":
        await adjustText(node, areaScale, targetWidth, targetHeight, /* hideOnOverflow */ true);
        break;
      case "image":
        adjustImage(node, targetWidth, targetHeight, source);
        break;
      case "other":
        // Leave Figma's constraint-based resize alone
        break;
    }
  }
}

function describe(node: SceneNode, index: number): NodeDescriptor {
  const fontSize =
    node.type === "TEXT" && typeof node.fontSize === "number" ? node.fontSize : undefined;
  const hasImageFill =
    "fills" in node &&
    Array.isArray(node.fills) &&
    node.fills.some((f) => f.type === "IMAGE");
  const textCharCount = node.type === "TEXT" ? node.characters.length : undefined;
  const area = "width" in node && "height" in node ? node.width * node.height : 0;
  return {
    name: node.name,
    type: node.type,
    fontSize,
    hasImageFill,
    textCharCount,
    area,
    zIndex: index,
  };
}

function adjustLogo(node: SceneNode, tw: number, th: number, source: FrameNode) {
  if (!("width" in node) || !("height" in node) || !("x" in node) || !("y" in node)) return;
  const aspect = node.width / node.height;
  const cap = Math.min(tw, th) * 0.25;
  let newW = Math.min(node.width, cap);
  let newH = newW / aspect;
  if (newH > cap) {
    newH = cap;
    newW = newH * aspect;
  }
  if ("resize" in node) (node as LayoutMixin).resize(newW, newH);

  // Pin to top quadrant matching source position
  const inLeftHalf = node.x < source.width / 2;
  const padding = Math.min(tw, th) * 0.05;
  node.x = inLeftHalf ? padding : tw - newW - padding;
  node.y = padding;
}

function adjustCta(node: SceneNode, tw: number, th: number, source: FrameNode) {
  if (!("width" in node) || !("height" in node) || !("x" in node) || !("y" in node)) return;
  // Force into bounds — clamp size first if needed
  const maxW = tw * 0.6;
  const maxH = th * 0.4;
  if (node.width > maxW || node.height > maxH) {
    const aspect = node.width / node.height;
    let w = Math.min(node.width, maxW);
    let h = w / aspect;
    if (h > maxH) {
      h = maxH;
      w = h * aspect;
    }
    if ("resize" in node) (node as LayoutMixin).resize(w, h);
  }
  // Pin: bottom-right if source CTA was right-of-center, else bottom-center
  const padding = Math.min(tw, th) * 0.05;
  const wasRightHalf = node.x + node.width / 2 > source.width / 2;
  node.x = wasRightHalf ? tw - node.width - padding : (tw - node.width) / 2;
  node.y = th - node.height - padding;
}

function adjustBackground(node: SceneNode, tw: number, th: number) {
  if (!("resize" in node) || !("x" in node) || !("y" in node)) return;
  (node as LayoutMixin).resize(tw, th);
  node.x = 0;
  node.y = 0;
}

async function adjustText(
  node: SceneNode,
  areaScale: number,
  tw: number,
  th: number,
  hideOnOverflow: boolean
) {
  if (node.type !== "TEXT") return;
  const text = node as TextNode;
  if (typeof text.fontSize !== "number") return;

  const originalFontSize = text.fontSize;

  // Load the font (required before mutating fontSize)
  const fontName = text.fontName;
  if (typeof fontName === "object") {
    await figma.loadFontAsync(fontName);
  }

  // First pass: scale by sqrt(areaScale)
  let newSize = Math.max(8, Math.round(originalFontSize * areaScale));
  text.fontSize = newSize;

  // Iteratively shrink if it overflows the target frame height
  const maxIters = 30;
  let iter = 0;
  while ((text.height > th || text.width > tw) && newSize > 8 && iter < maxIters) {
    newSize -= 1;
    text.fontSize = newSize;
    iter++;
  }

  // If we had to shrink past the threshold for body text, hide it
  if (hideOnOverflow && newSize < originalFontSize * (1 - HEADLINE_MIN_SHRINK_RATIO)) {
    text.visible = false;
  }

  // Force position into bounds
  if (text.x + text.width > tw) text.x = Math.max(0, tw - text.width);
  if (text.y + text.height > th) text.y = Math.max(0, th - text.height);
}

function adjustImage(node: SceneNode, tw: number, th: number, source: FrameNode) {
  if (!("width" in node) || !("height" in node) || !("x" in node) || !("y" in node)) return;
  // Preserve aspect — already done by Figma constraints; just clamp position
  // into target bounds based on source quadrant
  const sourceCenterX = node.x + node.width / 2;
  const sourceCenterY = node.y + node.height / 2;
  const xThird = Math.floor((sourceCenterX / source.width) * 3);
  const yThird = Math.floor((sourceCenterY / source.height) * 3);

  const targetCenterX = ((xThird + 0.5) / 3) * tw;
  const targetCenterY = ((yThird + 0.5) / 3) * th;

  node.x = Math.max(0, Math.min(tw - node.width, targetCenterX - node.width / 2));
  node.y = Math.max(0, Math.min(th - node.height, targetCenterY - node.height / 2));
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/algorithm/pass-2-roles.ts
git commit -m "feat: pass 2 — role-aware micro-adjustments"
```

---

## Task 9: Pass 3 — validate & flag

Walks the clone, checks for problems, returns the worst flag found. Caller can then add the visible ⚠ Review badge.

**Files:**
- Create: `src/algorithm/pass-3-validate.ts`

- [ ] **Step 1: Implement Pass 3 + the badge helper**

```ts
// src/algorithm/pass-3-validate.ts
// Sandbox-only — uses figma.* APIs.
import type { FrameFlag } from "../shared/types";

export function pass3Validate(clone: FrameNode): FrameFlag {
  const flags: FrameFlag[] = [];
  let allHidden = true;
  let hasBackground = false;

  for (const child of clone.children) {
    if (child.visible) allHidden = false;

    const isBackground =
      /\b(bg|background)\b/i.test(child.name) ||
      ("width" in child && "height" in child && child.width === clone.width && child.height === clone.height);
    if (isBackground) hasBackground = true;

    if ("x" in child && "y" in child && "width" in child && "height" in child) {
      if (
        child.x < 0 ||
        child.y < 0 ||
        child.x + child.width > clone.width ||
        child.y + child.height > clone.height
      ) {
        flags.push("out-of-bounds");
      }
      if (child.width < 4 || child.height < 4) {
        flags.push("tiny-node");
      }
    }

    if (child.type === "TEXT") {
      const text = child as TextNode;
      if (text.height > clone.height || text.width > clone.width) {
        flags.push("text-overflow");
      }
    }
  }

  // "All content hidden" wins over other flags
  const visibleNonBackground = clone.children.some((c) => c.visible && !/\b(bg|background)\b/i.test(c.name));
  if (!visibleNonBackground && hasBackground) {
    return "all-hidden";
  }
  if (allHidden) return "all-hidden";

  // Pick the most informative flag (priority: out-of-bounds > text-overflow > tiny-node)
  if (flags.includes("out-of-bounds")) return "out-of-bounds";
  if (flags.includes("text-overflow")) return "text-overflow";
  if (flags.includes("tiny-node")) return "tiny-node";
  return null;
}

// Adds a small ⚠ Review badge ABOVE the frame (16px above its top edge,
// left-aligned). Returns the badge node so the caller can group it with the frame.
export async function addReviewBadge(frame: FrameNode, flag: FrameFlag): Promise<FrameNode | null> {
  if (flag === null) return null;

  await figma.loadFontAsync({ family: "Inter", style: "Medium" });

  const badge = figma.createFrame();
  badge.name = "⚠ Review";
  badge.layoutMode = "HORIZONTAL";
  badge.primaryAxisSizingMode = "AUTO";
  badge.counterAxisSizingMode = "AUTO";
  badge.paddingLeft = 8;
  badge.paddingRight = 8;
  badge.paddingTop = 4;
  badge.paddingBottom = 4;
  badge.itemSpacing = 4;
  badge.cornerRadius = 4;
  badge.fills = [{ type: "SOLID", color: { r: 0.86, g: 0.15, b: 0.31 } }];

  const text = figma.createText();
  text.fontName = { family: "Inter", style: "Medium" };
  text.characters = `⚠ Review${flagSuffix(flag)}`;
  text.fontSize = 11;
  text.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  badge.appendChild(text);

  badge.x = frame.x;
  badge.y = frame.y - badge.height - 16;

  // Append to the same parent (so it lives alongside the frame)
  if (frame.parent) frame.parent.appendChild(badge);
  return badge;
}

function flagSuffix(flag: FrameFlag): string {
  switch (flag) {
    case "out-of-bounds": return "";
    case "text-overflow": return " — text overflow";
    case "tiny-node": return " — tiny element";
    case "all-hidden": return " — all content hidden, frame too small";
    default: return "";
  }
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/algorithm/pass-3-validate.ts
git commit -m "feat: pass 3 — validate & add review badge"
```

---

## Task 10: Frame placement (new page vs current page)

Creates the destination Figma page (or uses the current one) and positions the new frame at the right coordinates.

**Files:**
- Create: `src/algorithm/place-frames.ts`

- [ ] **Step 1: Implement `place-frames.ts`**

```ts
// src/algorithm/place-frames.ts
// Sandbox-only — uses figma.* APIs.

const GAP = 80;       // gap between generated frames
const ROW_GAP = 120;  // gap above the row when appending to current page

export type Placement =
  | { type: "new-page"; pageName: string }
  | { type: "current-page" };

type Cursor = { x: number; y: number; pageId: string };

/**
 * Returns a setup containing the destination page id and a cursor function
 * that positions each new frame appropriately.
 */
export function setupPlacement(placement: Placement, sources: FrameNode[]): {
  pageId: string;
  page: PageNode;
  positionFrame: (frame: FrameNode) => void;
} {
  if (placement.type === "new-page") {
    const page = figma.createPage();
    page.name = placement.pageName;
    const cursor: Cursor = { x: 0, y: 0, pageId: page.id };
    return {
      pageId: page.id,
      page,
      positionFrame: (frame) => {
        frame.x = cursor.x;
        frame.y = cursor.y;
        page.appendChild(frame);
        cursor.x += frame.width + GAP;
        // Wrap at 4000px
        if (cursor.x > 4000) {
          cursor.x = 0;
          cursor.y += 700; // row height — generous
        }
      },
    };
  }

  // current-page placement: find bottommost edge of existing frames, start there
  const page = figma.currentPage;
  let bottom = 0;
  for (const node of page.children) {
    if ("y" in node && "height" in node) {
      bottom = Math.max(bottom, node.y + node.height);
    }
  }
  const cursor: Cursor = { x: 0, y: bottom + ROW_GAP, pageId: page.id };
  return {
    pageId: page.id,
    page,
    positionFrame: (frame) => {
      frame.x = cursor.x;
      frame.y = cursor.y;
      page.appendChild(frame);
      cursor.x += frame.width + GAP;
      if (cursor.x > 4000) {
        cursor.x = 0;
        cursor.y += 700;
      }
    },
  };
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/algorithm/place-frames.ts
git commit -m "feat: frame placement on new page or current page"
```

---

## Task 11: Run-job orchestrator

Glues passes 1→2→3 into a single per-(source, target) generator, called in a loop with progress callbacks.

**Files:**
- Create: `src/algorithm/run-job.ts`

- [ ] **Step 1: Implement `run-job.ts`**

```ts
// src/algorithm/run-job.ts
// Sandbox-only — uses figma.* APIs.
import type { BannerJobConfig, Mapping, SourceFrame } from "../shared/types";
import { pass1ResizeClone } from "./pass-1-resize";
import { pass2Roles } from "./pass-2-roles";
import { pass3Validate, addReviewBadge } from "./pass-3-validate";
import { setupPlacement, type Placement } from "./place-frames";
import { nameFrame } from "./name-frame";

export type RunJobInput = {
  jobName: string;
  config: BannerJobConfig;
  mappings: Mapping[];
  sourceMap: Map<string, FrameNode>;
};

export type RunJobResult = {
  pageId: string;
  pageName: string;
  flagged: number;
  total: number;
  createdFrames: FrameNode[];
};

export async function runJob(
  input: RunJobInput,
  onProgress: (done: number, total: number) => void
): Promise<RunJobResult> {
  const placement: Placement = input.config.options.placeOnNewPage
    ? { type: "new-page", pageName: `Generated – ${input.jobName}` }
    : { type: "current-page" };

  const sources = [...input.sourceMap.values()];
  const setup = setupPlacement(placement, sources);

  const total = input.mappings.length;
  let flagged = 0;
  const createdFrames: FrameNode[] = [];

  for (let i = 0; i < input.mappings.length; i++) {
    const mapping = input.mappings[i];
    const source = input.sourceMap.get(mapping.sourceId);
    if (!source) {
      console.warn(`Source frame ${mapping.sourceId} not found, skipping target ${mapping.target.width}x${mapping.target.height}`);
      onProgress(i + 1, total);
      continue;
    }

    try {
      const clone = pass1ResizeClone(source, mapping.target.width, mapping.target.height);
      clone.name = nameFrame(mapping.target, input.jobName, source.name, input.config.options.namingPattern);
      setup.positionFrame(clone);

      await pass2Roles(clone, source, mapping.target.width, mapping.target.height);

      const flag = pass3Validate(clone);
      if (flag !== null) {
        flagged++;
        await addReviewBadge(clone, flag);
      }

      createdFrames.push(clone);
    } catch (err) {
      console.error(`Failed to generate ${mapping.target.width}x${mapping.target.height}:`, err);
    }

    onProgress(i + 1, total);
  }

  return {
    pageId: setup.pageId,
    pageName: setup.page.name,
    flagged,
    total,
    createdFrames,
  };
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/algorithm/run-job.ts
git commit -m "feat: run-job orchestrator chaining all three passes"
```

---

## Task 12: Sandbox entry — `code.ts`

The plugin's main entry — registers the UI and handles all messages from the iframe.

**Files:**
- Create: `src/code.ts`

- [ ] **Step 1: Implement `code.ts`**

```ts
// src/code.ts
// Sandbox entry — runs in Figma's plugin sandbox (no DOM, has figma.*).
import { consumeJob } from "./api/consume-job";
import { autoMap } from "./algorithm/auto-map";
import { runJob } from "./algorithm/run-job";
import type { UiToSandbox, SandboxToUi } from "./shared/messages";
import type { SourceFrame } from "./shared/types";

figma.showUI(__html__, { width: 360, height: 540, themeColors: true });

// Cache the most recently scanned source frames so the UI's mapping list can
// reference them by id during the "generate" step.
let scannedSources: Map<string, FrameNode> = new Map();

function send(msg: SandboxToUi) {
  figma.ui.postMessage(msg);
}

figma.ui.onmessage = async (raw: UiToSandbox) => {
  switch (raw.type) {
    case "fetch-job":
      await handleFetchJob(raw.code);
      break;
    case "scan-frames":
      handleScanFrames();
      break;
    case "generate":
      await handleGenerate(raw);
      break;
    case "cancel":
    case "close":
      figma.closePlugin();
      break;
  }
};

async function handleFetchJob(code: string) {
  const result = await consumeJob(code.toUpperCase().trim());
  if (!result.ok) {
    send({ type: "fetch-error", error: result.error });
    return;
  }
  send({ type: "job-fetched", job: result.job });
}

function handleScanFrames() {
  const selection = figma.currentPage.selection.filter((n): n is FrameNode => n.type === "FRAME");

  let frames: FrameNode[];
  let selectionUsed = false;
  if (selection.length > 0) {
    frames = selection;
    selectionUsed = true;
  } else {
    frames = figma.currentPage.children.filter((n): n is FrameNode => n.type === "FRAME");
  }

  // Cache for use during generate
  scannedSources = new Map(frames.map((f) => [f.id, f]));

  const summaries: SourceFrame[] = frames.map((f) => ({
    id: f.id,
    name: f.name,
    width: Math.round(f.width),
    height: Math.round(f.height),
  }));

  send({ type: "frames-scanned", frames: summaries, selectionUsed });
}

async function handleGenerate(msg: Extract<UiToSandbox, { type: "generate" }>) {
  // Build a sourceMap from the scanned cache, keyed by id
  const sourceMap = new Map<string, FrameNode>();
  for (const mapping of msg.mappings) {
    const node = scannedSources.get(mapping.sourceId);
    if (node) sourceMap.set(mapping.sourceId, node);
  }

  if (sourceMap.size === 0) {
    send({ type: "generate-error", error: "No valid source frames available." });
    return;
  }

  try {
    const result = await runJob(
      {
        jobName: msg.jobName,
        config: msg.config,
        mappings: msg.mappings,
        sourceMap,
      },
      (done, total) => send({ type: "generate-progress", done, total })
    );

    send({
      type: "generate-complete",
      pageId: result.pageId,
      pageName: result.pageName,
      flagged: result.flagged,
      total: result.total,
    });
  } catch (err) {
    console.error("runJob threw:", err);
    send({ type: "generate-error", error: err instanceof Error ? err.message : "Unknown error" });
  }
}

// Cleanup: if the user closes the plugin mid-generation, currently-created
// frames remain in the file. We don't aggressively delete them — the user
// might want to keep partial output. Document this in the README.
figma.on("close", () => {
  // No-op; partial frames stay.
});

// Re-export of __html__ is auto-injected by webpack via HtmlWebpackPlugin;
// nothing needed here.
```

- [ ] **Step 2: Add a global declaration so TS knows about `__html__`**

Edit `tsconfig.json` and add a typeRoots-style `types` reference, OR just append at the bottom of `src/code.ts`:

```ts
declare const __html__: string;
```

(Add this at the very top of `code.ts`, just under the imports.)

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/code.ts tsconfig.json
git commit -m "feat: sandbox entry with message routing for fetch/scan/generate"
```

---

## Task 13: UI bootstrap — `ui.html`, `ui.tsx`, `App.tsx`

Sets up the React iframe and the top-level state machine.

**Files:**
- Create: `src/ui/ui.html`
- Create: `src/ui/ui.tsx`
- Create: `src/ui/App.tsx`
- Create: `src/ui/ui.css`

- [ ] **Step 1: Create `src/ui/ui.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>GlueSkills Banner Resizer</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>
```

- [ ] **Step 2: Create `src/ui/ui.css`**

```css
:root {
  font-family: Inter, -apple-system, system-ui, sans-serif;
  font-size: 12px;
  color: var(--figma-color-text, #2c2c2c);
  background: var(--figma-color-bg, #fff);
}
* { box-sizing: border-box; }
body { margin: 0; padding: 16px; }
button {
  cursor: pointer;
  border: none;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  background: #18a0fb;
  color: #fff;
}
button:disabled { opacity: 0.5; cursor: not-allowed; }
button.secondary { background: transparent; border: 1px solid #d6d6d6; color: var(--figma-color-text); }
input[type="text"] {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #d6d6d6;
  border-radius: 6px;
  font-size: 13px;
  font-family: ui-monospace, monospace;
}
.section { margin-bottom: 16px; }
.label { font-weight: 600; margin-bottom: 6px; display: block; }
.muted { color: #888; font-size: 11px; }
.error { color: #e0345b; font-size: 12px; margin-top: 8px; }
.row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 4px; }
.row:hover { background: var(--figma-color-bg-hover, #f5f5f5); }
.checkbox { width: 14px; height: 14px; }
.mono { font-family: ui-monospace, monospace; }
.progress-track { width: 100%; height: 4px; background: #ececec; border-radius: 2px; overflow: hidden; }
.progress-bar { height: 100%; background: #18a0fb; transition: width 0.3s; }
```

- [ ] **Step 3: Create `src/ui/ui.tsx`**

```tsx
// src/ui/ui.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./ui.css";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
```

- [ ] **Step 4: Create `src/ui/App.tsx`**

```tsx
// src/ui/App.tsx
import React, { useEffect, useState } from "react";
import type { SandboxToUi, UiToSandbox } from "../shared/messages";
import type { BannerJobResponse, Mapping, SourceFrame } from "../shared/types";
import { CodeEntry } from "./code-entry";
import { SourcePicker } from "./source-picker";
import { MappingList } from "./mapping-list";
import { Progress } from "./progress";

type State =
  | { stage: "code" }
  | { stage: "fetching" }
  | { stage: "code-error"; error: string }
  | { stage: "scanning"; job: BannerJobResponse }
  | { stage: "picking-sources"; job: BannerJobResponse; frames: SourceFrame[]; selectionUsed: boolean }
  | { stage: "mapping"; job: BannerJobResponse; sources: SourceFrame[] }
  | { stage: "generating"; job: BannerJobResponse; done: number; total: number }
  | { stage: "done"; pageName: string; flagged: number; total: number }
  | { stage: "generate-error"; error: string };

function send(msg: UiToSandbox) {
  parent.postMessage({ pluginMessage: msg }, "*");
}

export function App() {
  const [state, setState] = useState<State>({ stage: "code" });

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as SandboxToUi | undefined;
      if (!msg) return;

      switch (msg.type) {
        case "job-fetched":
          setState({ stage: "scanning", job: msg.job });
          send({ type: "scan-frames" });
          break;
        case "fetch-error":
          setState({ stage: "code-error", error: errorMessage(msg.error) });
          break;
        case "frames-scanned":
          setState((s) =>
            s.stage === "scanning"
              ? { stage: "picking-sources", job: s.job, frames: msg.frames, selectionUsed: msg.selectionUsed }
              : s
          );
          break;
        case "generate-progress":
          setState((s) =>
            s.stage === "generating" ? { ...s, done: msg.done, total: msg.total } : s
          );
          break;
        case "generate-complete":
          setState({ stage: "done", pageName: msg.pageName, flagged: msg.flagged, total: msg.total });
          break;
        case "generate-error":
          setState({ stage: "generate-error", error: msg.error });
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  switch (state.stage) {
    case "code":
    case "fetching":
    case "code-error":
      return (
        <CodeEntry
          loading={state.stage === "fetching"}
          error={state.stage === "code-error" ? state.error : null}
          onSubmit={(code) => {
            setState({ stage: "fetching" });
            send({ type: "fetch-job", code });
          }}
        />
      );

    case "scanning":
      return <div className="muted">Scanning frames…</div>;

    case "picking-sources":
      return (
        <SourcePicker
          jobName={state.job.name}
          frames={state.frames}
          selectionUsed={state.selectionUsed}
          onContinue={(sources) =>
            setState({ stage: "mapping", job: state.job, sources })
          }
        />
      );

    case "mapping":
      return (
        <MappingList
          jobName={state.job.name}
          config={state.job.config}
          sources={state.sources}
          onGenerate={(mappings: Mapping[]) => {
            setState({ stage: "generating", job: state.job, done: 0, total: mappings.length });
            send({
              type: "generate",
              jobName: state.job.name,
              config: state.job.config,
              mappings,
            });
          }}
        />
      );

    case "generating":
      return <Progress done={state.done} total={state.total} />;

    case "done":
      return (
        <div className="section">
          <h3>Done</h3>
          <p>
            Generated {state.total} banners on page <strong>{state.pageName}</strong>.
            {state.flagged > 0 && ` ${state.flagged} flagged for review.`}
          </p>
          <button onClick={() => send({ type: "close" })}>Close</button>
        </div>
      );

    case "generate-error":
      return (
        <div className="section">
          <p className="error">Generation failed: {state.error}</p>
          <button className="secondary" onClick={() => send({ type: "close" })}>Close</button>
        </div>
      );
  }
}

function errorMessage(err: "not_found" | "expired" | "already_used" | "network"): string {
  switch (err) {
    case "not_found": return "We couldn't find that code. Generate a new one in the GlueSkills web app.";
    case "expired": return "This code has expired. Generate a new one in the GlueSkills web app.";
    case "already_used": return "This code has already been used. Generate a new one in the GlueSkills web app.";
    case "network": return "Couldn't reach GlueSkills. Check your connection and try again.";
  }
}
```

- [ ] **Step 5: Verify typecheck**

```bash
npm run typecheck
```
Expected: missing component imports — that's fine, they'll be created in Tasks 14–17. Comment them out for now or skip the typecheck until those tasks are done. (Or copy the stub components below into placeholders that just `return null`.)

For now, create stub files so typecheck passes:

```bash
mkdir -p src/ui
```

```tsx
// src/ui/code-entry.tsx (stub)
import React from "react";
export function CodeEntry(_: { loading: boolean; error: string | null; onSubmit: (code: string) => void }) {
  return null;
}
```

```tsx
// src/ui/source-picker.tsx (stub)
import React from "react";
import type { SourceFrame } from "../shared/types";
export function SourcePicker(_: { jobName: string; frames: SourceFrame[]; selectionUsed: boolean; onContinue: (s: SourceFrame[]) => void }) {
  return null;
}
```

```tsx
// src/ui/mapping-list.tsx (stub)
import React from "react";
import type { BannerJobConfig, Mapping, SourceFrame } from "../shared/types";
export function MappingList(_: { jobName: string; config: BannerJobConfig; sources: SourceFrame[]; onGenerate: (m: Mapping[]) => void }) {
  return null;
}
```

```tsx
// src/ui/progress.tsx (stub)
import React from "react";
export function Progress(_: { done: number; total: number }) {
  return null;
}
```

Now run typecheck:
```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/ui/
git commit -m "feat: UI shell — App state machine + stub components"
```

---

## Task 14: CodeEntry component

The first screen — paste-the-6-char-code input.

**Files:**
- Modify: `src/ui/code-entry.tsx`

- [ ] **Step 1: Replace the stub with the real component**

```tsx
// src/ui/code-entry.tsx
import React, { useState } from "react";

const CODE_LENGTH = 6;

export function CodeEntry({
  loading,
  error,
  onSubmit,
}: {
  loading: boolean;
  error: string | null;
  onSubmit: (code: string) => void;
}) {
  const [code, setCode] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== CODE_LENGTH || loading) return;
    onSubmit(code.toUpperCase().trim());
  }

  return (
    <form className="section" onSubmit={submit}>
      <h3 style={{ marginTop: 0 }}>Banner Resizer</h3>
      <p className="muted" style={{ marginBottom: 12 }}>
        Paste the 6-character pickup code from the GlueSkills web app.
      </p>
      <label className="label" htmlFor="code-input">Pickup code</label>
      <input
        id="code-input"
        type="text"
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, CODE_LENGTH))}
        placeholder="ABC123"
        maxLength={CODE_LENGTH}
        style={{ textTransform: "uppercase", letterSpacing: "0.2em", textAlign: "center", fontSize: "20px" }}
      />
      {error && <p className="error">{error}</p>}
      <div style={{ marginTop: 12 }}>
        <button type="submit" disabled={code.length !== CODE_LENGTH || loading}>
          {loading ? "Looking up…" : "Continue"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/code-entry.tsx
git commit -m "feat: CodeEntry component"
```

---

## Task 15: SourcePicker component

Lists scanned frames as checkboxes; if `selectionUsed` is true, all are pre-checked and there's a heading note.

**Files:**
- Modify: `src/ui/source-picker.tsx`

- [ ] **Step 1: Replace the stub with the real component**

```tsx
// src/ui/source-picker.tsx
import React, { useState } from "react";
import type { SourceFrame } from "../shared/types";

export function SourcePicker({
  jobName,
  frames,
  selectionUsed,
  onContinue,
}: {
  jobName: string;
  frames: SourceFrame[];
  selectionUsed: boolean;
  onContinue: (selected: SourceFrame[]) => void;
}) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    () => new Set(selectionUsed ? frames.map((f) => f.id) : [])
  );

  function toggle(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selected = frames.filter((f) => checkedIds.has(f.id));

  if (frames.length === 0) {
    return (
      <div className="section">
        <h3 style={{ marginTop: 0 }}>{jobName}</h3>
        <p className="error">No frames found on this page. Add at least one frame to your file and re-open the plugin.</p>
      </div>
    );
  }

  return (
    <div className="section">
      <h3 style={{ marginTop: 0 }}>{jobName}</h3>
      <p className="muted" style={{ marginBottom: 12 }}>
        {selectionUsed
          ? `Using your selection (${frames.length} ${frames.length === 1 ? "frame" : "frames"}). Uncheck any you don't want as a source.`
          : "Pick which frames to use as sources. The plugin will auto-map your target sizes to the closest aspect ratio source."}
      </p>
      <div style={{ maxHeight: 280, overflowY: "auto" }}>
        {frames.map((f) => (
          <label key={f.id} className="row">
            <input
              type="checkbox"
              className="checkbox"
              checked={checkedIds.has(f.id)}
              onChange={() => toggle(f.id)}
            />
            <span className="mono">{f.width}×{f.height}</span>
            <span style={{ flex: 1 }}>{f.name}</span>
          </label>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={() => onContinue(selected)} disabled={selected.length === 0}>
          Continue with {selected.length} {selected.length === 1 ? "source" : "sources"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/source-picker.tsx
git commit -m "feat: SourcePicker component"
```

---

## Task 16: MappingList component

Auto-maps targets to sources via `autoMap`, shows the list with per-row source override dropdowns.

**Files:**
- Modify: `src/ui/mapping-list.tsx`

- [ ] **Step 1: Replace the stub with the real component**

```tsx
// src/ui/mapping-list.tsx
import React, { useMemo, useState } from "react";
import type { BannerJobConfig, Mapping, SourceFrame } from "../shared/types";
import { autoMap } from "../algorithm/auto-map";

export function MappingList({
  jobName,
  config,
  sources,
  onGenerate,
}: {
  jobName: string;
  config: BannerJobConfig;
  sources: SourceFrame[];
  onGenerate: (mappings: Mapping[]) => void;
}) {
  // Initialize mappings from autoMap
  const initial = useMemo(() => autoMap(sources, config.targets), [sources, config.targets]);
  const [mappings, setMappings] = useState<Mapping[]>(initial);

  function changeSource(targetIdx: number, sourceId: string) {
    setMappings((prev) =>
      prev.map((m, i) => (i === targetIdx ? { ...m, sourceId } : m))
    );
  }

  const sourceById = new Map(sources.map((s) => [s.id, s]));

  return (
    <div className="section">
      <h3 style={{ marginTop: 0 }}>{jobName}</h3>
      <p className="muted" style={{ marginBottom: 12 }}>
        {config.targets.length} target {config.targets.length === 1 ? "size" : "sizes"} mapped to your sources by closest aspect ratio. Override any below.
      </p>
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {mappings.map((m, idx) => {
          const src = sourceById.get(m.sourceId);
          return (
            <div key={`${m.target.width}x${m.target.height}-${idx}`} className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="mono" style={{ minWidth: 60 }}>{m.target.width}×{m.target.height}</span>
                <span className="muted">←</span>
                <select
                  value={m.sourceId}
                  onChange={(e) => changeSource(idx, e.target.value)}
                  style={{ flex: 1, padding: "4px 6px", borderRadius: 4, border: "1px solid #d6d6d6" }}
                >
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.width}×{s.height})
                    </option>
                  ))}
                </select>
              </div>
              {src && m.target.width / m.target.height !== src.width / src.height && (
                <div className="muted" style={{ marginLeft: 68, fontSize: 10 }}>
                  Aspect ratio differs — expect adjustments
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={() => onGenerate(mappings)}>
          Generate {mappings.length} {mappings.length === 1 ? "frame" : "frames"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/mapping-list.tsx
git commit -m "feat: MappingList component with override dropdowns"
```

---

## Task 17: Progress component

Simple progress bar shown while frames are being generated.

**Files:**
- Modify: `src/ui/progress.tsx`

- [ ] **Step 1: Replace the stub with the real component**

```tsx
// src/ui/progress.tsx
import React from "react";

export function Progress({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="section">
      <h3 style={{ marginTop: 0 }}>Generating</h3>
      <p className="muted">Generating {total} {total === 1 ? "frame" : "frames"}… {done} of {total}</p>
      <div className="progress-track">
        <div className="progress-bar" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck and build**

```bash
npm run typecheck
npm run build
```
Expected: both succeed. `dist/code.js` and `dist/ui.html` exist.

- [ ] **Step 3: Commit**

```bash
git add src/ui/progress.tsx
git commit -m "feat: Progress component"
```

---

## Task 18: Local development install + manual smoke test

End-to-end check: build, install in Figma, create a test job in the GlueSkills web app, run the plugin in Figma, verify generated frames look reasonable.

> **Prerequisite:** The web side from `2026-04-15-banner-resizer-web.md` must be deployed (or running locally on `localhost:3000`) AND the Supabase migration applied AND the real Supabase URL/anon key swapped into `src/api/consume-job.ts`.

- [ ] **Step 1: Build the plugin**

```bash
npm run build
```
Expected: `dist/code.js` and `dist/ui.html` produced, no errors.

- [ ] **Step 2: Install in Figma desktop**

1. Open Figma desktop.
2. Menu: Plugins → Development → Import plugin from manifest.
3. Navigate to and select `~/Desktop/glueskills-banner-resizer-plugin/manifest.json`.

Expected: "GlueSkills Banner Resizer" appears under Plugins → Development.

- [ ] **Step 3: Build a test Figma file**

Create a new Figma file with **four source frames** on the current page:

| Frame name | Size | Children |
|---|---|---|
| Hero — Medium Rectangle | 300×250 | Background rect (full bleed, light color), Logo (top-left, ~60×30), Headline ("Spring Sale" 24pt, center), CTA button ("Shop Now" frame, bottom-right) |
| Hero — Leaderboard | 728×90 | Same elements rearranged horizontally |
| Hero — Wide Skyscraper | 160×600 | Same elements stacked vertically |
| Hero — Billboard | 970×250 | Same elements with hero image on right |

This isn't required to be polished — it's the smoke test bench. Save the file as "Banner Resizer Smoke Test".

- [ ] **Step 4: Generate a job in the web app**

In the GlueSkills web app at `/dashboard/designer/banner-resizer`:
1. Job name: `Smoke Test 2026-04-15`
2. Pick sizes: 336×280, 300×600, 970×90, 320×50, 250×250 (5 targets covering different aspect ratios)
3. Click Generate code → copy the 6-char code.

- [ ] **Step 5: Run the plugin**

In the Figma test file:
1. Plugins → Development → GlueSkills Banner Resizer.
2. Plugin opens, paste the code, hit Continue.
3. Source picker shows the four source frames — leave all four checked, Continue.
4. Mapping list shows 5 rows with auto-mapped sources (e.g., 336×280 → Medium Rectangle, 970×90 → Leaderboard).
5. Click Generate.
6. Progress bar updates to 5/5.
7. Success screen: "Generated 5 banners on page Generated – Smoke Test 2026-04-15."

- [ ] **Step 6: Inspect the generated page**

Click the new "Generated – Smoke Test 2026-04-15" page in the Figma left panel. Verify:
- 5 frames are present, named per pattern `[size] — Smoke Test 2026-04-15`.
- Each frame contains roughly the source's elements, repositioned.
- Frames with very different aspect ratios from their source have a `⚠ Review` badge above them.
- The 320×50 (mobile banner) is the most likely flag — text would have shrunk significantly or been hidden.

If the result looks reasonable (not perfect — that's expected per the spec), the smoke test passes. Note any specific failures (crash, empty frames, wrong placement) and file as bug tasks.

- [ ] **Step 7: Run all unit tests once more**

```bash
npm test
```
Expected: all tests pass (`auto-map`, `role-detectors`, `name-frame`).

- [ ] **Step 8: No commit needed if all green** — verification only.

---

## Task 19: Distribution — three modes, when to use each

Document and prepare for each of the three distribution paths the team will use.

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update `README.md` with distribution sections**

Replace the stub README with:

```markdown
# GlueSkills Banner Resizer (Figma Plugin)

Companion plugin for the GlueSkills Banner Resizer web tool.
Pastes a 6-character pickup code → fetches job config from Supabase → generates resized banner frames in the current Figma file.

See spec at `<glueskills-repo>/docs/superpowers/specs/2026-04-15-banner-resizer-design.md`.

## Develop

```bash
npm install
npm run watch    # rebuilds on save
npm test         # run unit tests
```

In Figma desktop: Plugins → Development → Import plugin from manifest → select `manifest.json`.

After editing code with `npm run watch` running, re-run the plugin from Figma — the new bundle is picked up automatically.

## Distribution

There are three modes the plugin can run in. Use whichever fits the audience:

### 1. Local dev install — for active development

Each developer/designer manually imports the local `manifest.json`. Re-imports needed if the user changes machines.

**When:** Active development. Internal preview before publishing.

**Setup:** Per machine, one-time:
```
git clone <this repo>
cd glueskills-banner-resizer-plugin
npm install
npm run build
```
Then in Figma desktop: Plugins → Development → Import plugin from manifest → select `manifest.json`.

### 2. Private organization publish — for the GlueSkills team

Publishes to your Figma Organization only. Bypasses Figma Community public review. Requires a paid Figma plan with an Organization.

**When:** Internal team rollout. Everyone in the GlueSkills Figma org gets it in their Plugins menu without manual install.

**Setup:**
1. In Figma desktop with the plugin imported as a development plugin, open it once.
2. Menu: Plugins → Development → Manage plugins in development → "GlueSkills Banner Resizer" → Publish.
3. Choose "Private to organization" (only available with a paid Org plan).
4. Fill out cover image, description, screenshots — these are visible to org members only.

### 3. Public Community publish — for external users

Submitted to Figma Community. Reviewed by Figma's team. ~1–3 weeks for first-time submissions.

**When:** Ready to make available to the wider design community.

**Setup:**
1. In Figma desktop with the plugin imported, open it once.
2. Menu: Plugins → Development → Manage plugins in development → "GlueSkills Banner Resizer" → Publish.
3. Choose "Public" → fill out the required fields:
   - Cover image (1920×960 png)
   - Tagline, description (~150 + ~500 words)
   - Tags
   - Screenshots (5+, each 1600×900)
   - Support contact email (`guillermo.rozenblat@glueiq.com`)
4. Submit for review. Figma typically responds in 1–3 weeks; resubmissions are faster.
5. Once approved, the plugin gets a permanent Community URL — replace the `id` in `manifest.json` with the assigned ID and rebuild.

## Production secrets

`src/api/consume-job.ts` contains the Supabase URL and anon key inline. These are safe to commit (anon key is public) but must point at the right Supabase project before publishing. Update them when:
- The GlueSkills Supabase project changes URL or anon key.
- Switching from staging → production Supabase project.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add distribution guide for dev / private org / public Community"
```

---

## Self-Review Notes

After writing this plan, checked against the spec:

- **Spec §2 decisions** — all Web/Plugin split decisions implemented: hybrid (this plan + web plan), auto-map+override (Tasks 4 + 16), constraint passthrough + role detection (Tasks 7+8+9, no AI in v1), code handoff via RPC (Task 3), selection-first source detect (Task 12), new-page placement (Task 10).
- **Spec §3 architecture** — sandbox+UI iframe (Task 13), `postMessage` (Tasks 12+13), Supabase anon key embedded (Task 3), no Figma OAuth.
- **Spec §4.2 plugin flow** — code entry (Task 14), source picker w/ selection-first (Tasks 12+15), mapping with override (Tasks 4+16), generate + progress (Tasks 11+17), success message (Task 13 App.tsx done state).
- **Spec §5 data model** — `consume_banner_job` RPC consumed in Task 3; "code is the auth" preserved.
- **Spec §6 algorithm** — Pass 1 (Task 7), Pass 2 with all role detection rules (Tasks 5+8), Pass 3 + ⚠ Review badge above frame (Task 9), explicit non-goals respected (no wholesale layout, no AI).
- **Spec §7 code organization plugin side** — file structure mirrored exactly.
- **Spec §8 plugin error states** — all 8 scenarios handled in Tasks 12+13: code not found, expired, already used, network failure (Task 12 `consumeJob`), zero source frames (Task 15 disable), failed clone (Task 11 try/catch + console), all-hidden flag (Task 9), close mid-generation (Task 12 `figma.on("close")` no-op note).
- **Spec §9 testing** — auto-map (Task 4), role-detectors (Task 5), name-frame (Task 6). Snapshot tests of algorithm passes are NOT included — they require a Figma scene-graph mock that doesn't exist in `@figma/plugin-typings` and would be a large investment for marginal value. Manual smoke test (Task 18) covers the integrated behavior. This is a deliberate scope decision — call it out at execution time and revisit in v2 if regressions become a problem.
- **Type consistency check:**
  - `BannerJobConfig`/`BannerJobTarget`/`BannerJobOptions` defined in Task 2, used in 4, 6, 11, 13, 16. ✓
  - `Mapping`/`SourceFrame` defined in Task 2, used in 4, 11, 12, 13, 15, 16. ✓
  - `UiToSandbox`/`SandboxToUi` defined in Task 2, used in 12, 13. ✓
  - `BannerJobResponse` defined in Task 2, used in 3 (consumeJob result), 12, 13. ✓
  - `Role`/`NodeDescriptor` defined in Task 5, used in 8. ✓
  - `FrameFlag` defined in Task 2, used in 9. ✓
  - `Placement` defined in Task 10, used in 11. ✓
- **Placeholder scan:** No "TODO", "TBD", or vague handwaves. The two `YOUR_PROJECT_REF` / `YOUR_ANON_KEY` strings in Task 3 are explicitly flagged as placeholders to swap before publishing — that's a known boundary for credential injection, not a plan failure.
