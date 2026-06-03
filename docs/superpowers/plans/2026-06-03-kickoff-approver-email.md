# Approver Email on Submit-for-Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a Creative Kickoff draft is submitted for review, email both approvers a link to the brief.

**Architecture:** A new self-catching `notify.ts` module resolves the submitter's name and both approver emails from Clerk and sends a minimal email via Resend. The existing transition route calls it (awaited, but never throws) only on the `submit` action, so a send failure never blocks the submission.

**Tech Stack:** Next.js 16 route handler, Clerk (`clerkClient`), Resend HTTP API, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-03-kickoff-approver-email-design.md`

---

## File Structure

- **Create** `src/lib/project-kickoff/notify.ts` — sole responsibility: given a submitted kickoff, resolve recipients and send the approver notification. Self-catching; never throws.
- **Create** `src/lib/project-kickoff/notify.test.ts` — unit tests for the module (Clerk + fetch mocked).
- **Modify** `src/app/api/kickoffs/[id]/transition/route.ts` — call `notifyApproversOfSubmission` after a successful `submit` update.
- **Modify** `src/app/api/kickoffs/[id]/transition/route.test.ts` — mock the notify module; assert it fires on `submit` and not on `approve`/`reopen`.

**Reference patterns (read before coding):**
- Resend send + Clerk `getUser`: `src/app/api/feedback/route.ts`
- Approver IDs: `src/lib/project-kickoff/config.ts` (`approverIds()`)
- Kickoff type: `src/lib/project-kickoff/types.ts` (`Kickoff` has `id`, `title`)
- Existing test mock style: `src/app/api/kickoffs/[id]/transition/route.test.ts`

**Run a single test file:** `npx vitest run <path>`

---

## Task 1: `notify.ts` module (with tests)

**Files:**
- Create: `src/lib/project-kickoff/notify.ts`
- Test: `src/lib/project-kickoff/notify.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/project-kickoff/notify.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Clerk: getUser returns a per-id fixture
const mockGetUser = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(async () => ({ users: { getUser: mockGetUser } })),
}));

import { notifyApproversOfSubmission } from "./notify";
import type { Kickoff } from "./types";

const kickoff = { id: "k1", title: "Acme Launch" } as Kickoff;

const USERS: Record<string, unknown> = {
  user_sub: { firstName: "Sam", lastName: "Submitter", emailAddresses: [{ emailAddress: "sam@x.com" }] },
  user_gui: { firstName: "Gui", lastName: "R", emailAddresses: [{ emailAddress: "gui@x.com" }] },
  user_mon: { firstName: "Monica", lastName: "P", emailAddresses: [{ emailAddress: "monica@x.com" }] },
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.KICKOFF_APPROVER_IDS = "user_gui,user_mon";
  process.env.RESEND_API_KEY = "re_test";
  mockGetUser.mockImplementation(async (id: string) => USERS[id]);
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "email_1" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

describe("notifyApproversOfSubmission", () => {
  it("sends one email to BOTH approvers with subject, link and submitter name", async () => {
    await notifyApproversOfSubmission({ kickoff, submitterId: "user_sub", origin: "https://app.test" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(sent.to).toEqual(["gui@x.com", "monica@x.com"]);
    expect(sent.subject).toBe('[GlueSkills] "Acme Launch" submitted for review');
    expect(sent.text).toContain("Sam Submitter");
    expect(sent.text).toContain("https://app.test/dashboard/strategist/project-kickoff/k1");
  });

  it("swallows a Resend failure (does not throw)", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    await expect(
      notifyApproversOfSubmission({ kickoff, submitterId: "user_sub", origin: "https://app.test" })
    ).resolves.toBeUndefined();
  });

  it("skips an approver with no email but still sends to the rest", async () => {
    USERS.user_mon = { firstName: "Monica", lastName: "P", emailAddresses: [] };
    await notifyApproversOfSubmission({ kickoff, submitterId: "user_sub", origin: "https://app.test" });
    const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.to).toEqual(["gui@x.com"]);
  });

  it("does not call Resend when no approver email resolves", async () => {
    USERS.user_gui = { emailAddresses: [] };
    USERS.user_mon = { emailAddresses: [] };
    await notifyApproversOfSubmission({ kickoff, submitterId: "user_sub", origin: "https://app.test" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/project-kickoff/notify.test.ts`
Expected: FAIL — `Failed to resolve import "./notify"` (module does not exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/project-kickoff/notify.ts`:

```ts
import { clerkClient } from "@clerk/nextjs/server";
import { approverIds } from "./config";
import type { Kickoff } from "./types";

interface NotifyArgs {
  kickoff: Kickoff;
  submitterId: string;
  origin: string;
}

/**
 * Email both approvers that a kickoff brief was submitted for review.
 * Self-catching: every failure (Clerk lookup, missing email, Resend non-2xx)
 * is logged and swallowed. NEVER throws — the caller's submit must not depend on it.
 */
export async function notifyApproversOfSubmission({
  kickoff,
  submitterId,
  origin,
}: NotifyArgs): Promise<void> {
  try {
    const clerk = await clerkClient();

    // Submitter display name (fallback to email, then a generic label).
    let submitterName = "A teammate";
    try {
      const u = await clerk.users.getUser(submitterId);
      submitterName =
        [u.firstName, u.lastName].filter(Boolean).join(" ") ||
        u.emailAddresses[0]?.emailAddress ||
        submitterName;
    } catch (e) {
      console.error("kickoff notify: failed to resolve submitter", submitterId, e);
    }

    // Resolve approver emails; skip any that fail or have no email.
    const emails: string[] = [];
    for (const id of approverIds()) {
      try {
        const u = await clerk.users.getUser(id);
        const email = u.emailAddresses[0]?.emailAddress;
        if (email) emails.push(email);
        else console.error("kickoff notify: approver has no email", id);
      } catch (e) {
        console.error("kickoff notify: failed to resolve approver", id, e);
      }
    }
    if (emails.length === 0) {
      console.error("kickoff notify: no approver emails resolved; skipping send");
      return;
    }

    const link = `${origin}/dashboard/strategist/project-kickoff/${kickoff.id}`;
    const subject = `[GlueSkills] "${kickoff.title}" submitted for review`;
    const text = `${submitterName} submitted the kickoff brief "${kickoff.title}" for review.\n\nReview it here: ${link}`;
    const html = `<p>${submitterName} submitted the kickoff brief <strong>&quot;${kickoff.title}&quot;</strong> for review.</p><p><a href="${link}">Open the brief</a></p>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "GlueSkills <feedback@resend.dev>",
        to: emails,
        subject,
        text,
        html,
      }),
    });

    if (!res.ok) {
      console.error("kickoff notify: Resend send failed:", await res.text());
    }
  } catch (e) {
    console.error("kickoff notify: unexpected error", e);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/project-kickoff/notify.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/project-kickoff/notify.ts src/lib/project-kickoff/notify.test.ts
git commit -m "feat(kickoff): notify module — email approvers on submit"
```

---

## Task 2: Wire notify into the transition route (with tests)

**Files:**
- Modify: `src/app/api/kickoffs/[id]/transition/route.ts`
- Modify: `src/app/api/kickoffs/[id]/transition/route.test.ts`

- [ ] **Step 1: Write the failing test additions**

In `src/app/api/kickoffs/[id]/transition/route.test.ts`, add a notify mock near the other `vi.mock` calls (after line 12):

```ts
const mockNotify = vi.fn();
vi.mock("@/lib/project-kickoff/notify", () => ({
  notifyApproversOfSubmission: (...args: unknown[]) => mockNotify(...args),
}));
```

Then add these tests inside the `describe("POST transition", ...)` block:

```ts
it("notifies both approvers on submit, with kickoff + submitter + origin", async () => {
  await POST(body("submit"), params);
  expect(mockNotify).toHaveBeenCalledTimes(1);
  const arg = mockNotify.mock.calls[0][0];
  expect(arg.kickoff.status).toBe("under_review");
  expect(arg.kickoff.id).toBe("id1");
  expect(arg.submitterId).toBe("user_a");
  expect(arg.origin).toBe("http://x");
});

it("does NOT notify on approve", async () => {
  vi.mocked(auth).mockResolvedValue({ userId: "user_approver", getToken: mockGetToken } as never);
  mockGet.mockResolvedValue({ ...draft, status: "under_review" });
  await POST(body("approve"), params);
  expect(mockNotify).not.toHaveBeenCalled();
});

it("does NOT notify on reopen", async () => {
  mockGet.mockResolvedValue({ ...draft, status: "under_review", locked: true });
  await POST(body("reopen"), params);
  expect(mockNotify).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run "src/app/api/kickoffs/[id]/transition/route.test.ts"`
Expected: FAIL — the "notifies both approvers on submit" test fails because the route does not call notify yet (`mockNotify` has 0 calls).

- [ ] **Step 3: Wire notify into the route**

In `src/app/api/kickoffs/[id]/transition/route.ts`, add the import after line 7:

```ts
import { notifyApproversOfSubmission } from "@/lib/project-kickoff/notify";
```

Then replace the update + return block (currently lines 48-49):

```ts
    const fresh = await ctx.repo.update(id, patch);
    return NextResponse.json({ kickoff: fresh });
```

with:

```ts
    const fresh = await ctx.repo.update(id, patch);

    // Fire-and-forget approver notification. Awaited so the serverless function
    // doesn't terminate mid-send, but notify self-catches so this never throws
    // and never affects the response.
    if (parsed.data.action === "submit") {
      await notifyApproversOfSubmission({
        kickoff: fresh,
        submitterId: ctx.userId,
        origin: new URL(req.url).origin,
      });
    }

    return NextResponse.json({ kickoff: fresh });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run "src/app/api/kickoffs/[id]/transition/route.test.ts"`
Expected: PASS (all transition tests — the original 6 plus the 3 new ones).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/kickoffs/[id]/transition/route.ts" "src/app/api/kickoffs/[id]/transition/route.test.ts"
git commit -m "feat(kickoff): email approvers when a brief is submitted for review"
```

---

## Task 3: Full verification + Resend-domain check

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — previous count (181) + the new tests, all green.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Build (only if no `next dev` is running on the same workspace)**

Run: `npm run build`
Expected: build succeeds. (Repo has 5 pre-existing lint errors unrelated to this feature; `next build` does not fail on them.)

- [ ] **Step 4: Manual deploy-config check (document, do not block)**

Verify in the Resend dashboard whether a sending domain is verified. The code sends `from: "GlueSkills <feedback@resend.dev>"` — the `resend.dev` sandbox typically delivers only to the account owner (Gui). To reliably reach Monica, a verified domain + matching `from` address is required. If not yet set up, note it in the PR description as a follow-up; the only code change needed later is the `from` string in `notify.ts`.

- [ ] **Step 5: Manual end-to-end (optional, in dev)**

With `next dev` running and `RESEND_API_KEY` + `KICKOFF_APPROVER_IDS` set in `.env.local`: open a draft brief with all required fields complete, click Submit for review, and confirm the email arrives (to Gui at minimum, per Step 4). Confirm the link opens the correct brief's document view.

---

## Self-Review

- **Spec coverage:** recipients both-always (Task 1 loops `approverIds()`, no exclusion) ✓; minimal content (subject + name + link, no deliverable detail) ✓; fire-and-forget (route awaits a self-catching call; Task 2 tests prove submit still returns 200 via existing tests) ✓; trigger only on submit (Task 2 `if action === "submit"` + not-on-approve/reopen tests) ✓; deep link route ✓; origin from request ✓ (refined to `new URL(req.url).origin` for test/portability — noted); open Resend-domain risk (Task 3 Step 4) ✓.
- **Placeholders:** none — every code/test step is complete.
- **Type consistency:** `notifyApproversOfSubmission({ kickoff, submitterId, origin })` signature is identical in the module, its tests, and the route call. `Kickoff.id`/`Kickoff.title` match `types.ts`.
