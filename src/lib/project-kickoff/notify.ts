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
