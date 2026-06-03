# Design — Approver email on Creative Kickoff submit-for-review

**Date:** 2026-06-03
**Feature:** When a Creative Kickoff draft is submitted for review, email both approvers a link to the brief.
**Builds on:** `2026-06-02-creative-kickoff-brief-tool-design.md`

## Goal

When a strategist submits a kickoff brief (draft → under_review), notify the approvers
(`KICKOFF_APPROVER_IDS` — Gui + Monica) by email so they know a brief is waiting and can open it directly.

## Decisions (locked during brainstorming)

| Question | Decision |
|----------|----------|
| Recipients | **Both approvers, always** — even if the submitter is themselves an approver. |
| Email content | **Minimal** — submitter name + brief title + a link to the document view. No deliverable/section detail (approvers read that in the brief). |
| Failure handling | **Fire-and-forget** — a send failure never blocks or fails the submit; it is logged server-side. |
| Trigger | Only the `submit` transition (`draft → under_review`). Not `approve`, not `reopen`. |

## Architecture

One new isolated module + a few lines of wiring in the existing transition route.
Chosen over inlining (the way `feedback/route.ts` sends) so the route stays readable and the
email logic is unit-testable on its own.

### New unit — `src/lib/project-kickoff/notify.ts`

```
notifyApproversOfSubmission({ kickoff, submitterId, origin }): Promise<void>
```

- **Resolves** the submitter's display name and both approver email addresses from Clerk
  (`clerkClient().users.getUser(id)` → `user.emailAddresses[0]?.emailAddress`), the same call
  pattern as `feedback/route.ts`.
- **Recipients** come from `approverIds()` in `config.ts` (reads `KICKOFF_APPROVER_IDS`). Both,
  always — no exclusion of the submitter.
- **Builds** the minimal email and **POSTs** to Resend (`https://api.resend.com/emails`,
  `Authorization: Bearer ${RESEND_API_KEY}`).
- **Self-catching:** every failure path — Clerk lookup error, an approver with no resolvable
  email, Resend non-2xx — is caught and `console.error`'d. The function **never throws**. An
  approver missing an email is skipped; remaining approvers still receive the email.
- **Depends on:** `clerkClient` (Clerk), `approverIds()` (config), `RESEND_API_KEY` (env), global `fetch`.

### Wiring — `src/app/api/kickoffs/[id]/transition/route.ts`

After the submit `repo.update` succeeds (currently line ~48), call:

```ts
if (parsed.data.action === "submit") {
  await notifyApproversOfSubmission({
    kickoff: fresh,
    submitterId: ctx.userId,
    origin: new URL(req.url).origin,
  });
}
```

- **Awaited** so a Vercel serverless function does not terminate before the Resend `fetch`
  completes — but because the function self-catches, the awaited call never throws and the
  `200` response is returned regardless. This is how "fire-and-forget" is done safely in serverless.
- `origin` is derived from `new URL(req.url).origin` — no new base-URL env var needed; works in dev
  (`http://localhost:3000`) and on Vercel, and (unlike `req.nextUrl`) on the plain `Request` objects
  the existing transition tests construct.

## The email (minimal)

- **To:** both approver emails (resolved from `KICKOFF_APPROVER_IDS`).
- **From:** `GlueSkills <feedback@resend.dev>` (reuse the feedback route's sender — see Open Risk).
- **Subject:** `[GlueSkills] "{title}" submitted for review`
- **Body:** `{SubmitterName} submitted the kickoff brief "{title}" for review.` followed by a
  link/button to the brief.
- **Link:** `{origin}/dashboard/strategist/project-kickoff/{kickoff.id}` (confirmed route).

## Data flow

```
submit POST
  → applyTransition() ok (status → under_review, locked)
  → repo.update(id, patch)
  → notifyApproversOfSubmission({ kickoff: fresh, submitterId, origin })
       → Clerk: resolve submitter name + approver emails
       → Resend: POST email to both approvers
       → on any failure: console.error, swallow
  → 200 { kickoff: fresh }   // returned regardless of email outcome
```

## Error handling

- All notify-path errors are caught inside `notify.ts` and logged. None propagate to the route.
- Missing/unresolvable approver email → that recipient skipped, others still sent, logged.
- Resend non-2xx → logged with response body, submit still returns 200.

## Testing

- **`src/lib/project-kickoff/notify.test.ts`** — mock `@clerk/nextjs/server` and global `fetch`:
  - sends to **both** approver addresses, always;
  - subject and link are correct (`{origin}/dashboard/strategist/project-kickoff/{id}`);
  - a Resend failure (non-2xx / thrown fetch) is swallowed — `notifyApproversOfSubmission`
    resolves without throwing;
  - an approver with no email is skipped without throwing.
- **`src/app/api/kickoffs/[id]/transition/route.test.ts`** (extend) — mock the notify module:
  - on `submit`, notify is called once with `{ kickoff, submitterId, origin }`;
  - on `approve` and `reopen`, notify is **not** called;
  - notify is invoked only after a successful `repo.update`.

## Open risk (deploy config, not code)

`resend.dev` is Resend's sandbox/shared domain. In test mode Resend generally only delivers to
the **account owner's** address (Gui). Monica may not receive the email until a real sending
domain is **verified in Resend** and the `from` is switched to an address on that domain. This
is a Resend dashboard / env concern, surfaced explicitly after the build so it can be verified
before the feature is relied upon. The code is unaffected — only the `from` address would change.

## Out of scope (YAGNI)

- Deliverable/section detail in the email body.
- Notifications on `approve` / `reopen`.
- A branded HTML template. (An archived branded template exists at
  `glue-work/_archive/from-gui.dev/exports/glueiq-email-templates/creative-kickoff-brief-notification.html`
  in the parent repo — a future-polish reference only; not used here.)
- In-app / push notifications.
