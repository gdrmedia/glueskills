import { clerkClient } from "@clerk/nextjs/server";
import { approverIds } from "./config";
import { SECTION_BY_ID } from "./form-schema";
import type { Kickoff } from "./types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Mirror of the kickoff document-view route in src/app/dashboard/strategist/project-kickoff/[id].
const KICKOFF_REVIEW_PATH = "/dashboard/strategist/project-kickoff";

// Single sender for all kickoff emails. Currently the Resend sandbox address,
// which only delivers to the Resend account owner — swap this one line for a
// verified sending domain to reach the whole team (see the open Resend follow-up).
const EMAIL_FROM = "GlueSkills <feedback@resend.dev>";

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

    const link = `${origin}${KICKOFF_REVIEW_PATH}/${kickoff.id}`;
    const subject = `[GlueSkills] "${kickoff.title}" submitted for review`;
    const text = `${submitterName} submitted the kickoff brief "${kickoff.title}" for review.\n\nReview it here: ${link}`;
    const html = `<p>${escapeHtml(submitterName)} submitted the kickoff brief <strong>&quot;${escapeHtml(kickoff.title)}&quot;</strong> for review.</p><p><a href="${link}">Open the brief</a></p>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
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

interface NudgeArgs {
  kickoff: Kickoff;
  sectionId: number;
  ownerId: string;
  origin: string;
  /** Optional free-text note from the nudger, included in the email body. */
  message?: string;
}

/**
 * Email the owner of a section a reminder to fill it out.
 * Self-catching like notifyApproversOfSubmission: every failure (Clerk lookup,
 * missing email, Resend non-2xx) is logged and swallowed. NEVER throws.
 */
export async function notifySectionOwner({
  kickoff,
  sectionId,
  ownerId,
  origin,
  message,
}: NudgeArgs): Promise<void> {
  try {
    const sectionTitle = SECTION_BY_ID[sectionId]?.title ?? `Section ${sectionId}`;
    const clerk = await clerkClient();

    let ownerName = "there";
    let email: string | undefined;
    try {
      const u = await clerk.users.getUser(ownerId);
      ownerName =
        [u.firstName, u.lastName].filter(Boolean).join(" ") ||
        u.emailAddresses[0]?.emailAddress ||
        ownerName;
      email = u.emailAddresses[0]?.emailAddress;
    } catch (e) {
      console.error("kickoff nudge: failed to resolve owner", ownerId, e);
    }

    if (!email) {
      console.error("kickoff nudge: owner has no email; skipping send", ownerId);
      return;
    }

    const link = `${origin}${KICKOFF_REVIEW_PATH}/${kickoff.id}`;
    const note = message?.trim();
    const subject = `[GlueSkills] Reminder: "${kickoff.title}" — ${sectionTitle}`;
    const text =
      `Hi ${ownerName},\n\nYou're the owner of the "${sectionTitle}" section of the kickoff brief "${kickoff.title}". Please fill it out when you get a chance.` +
      (note ? `\n\nMessage:\n${note}` : "") +
      `\n\nOpen the brief: ${link}`;
    const html =
      `<p>Hi ${escapeHtml(ownerName)},</p>` +
      `<p>You're the owner of the <strong>${escapeHtml(sectionTitle)}</strong> section of the kickoff brief <strong>&quot;${escapeHtml(kickoff.title)}&quot;</strong>. Please fill it out when you get a chance.</p>` +
      (note ? `<p><strong>Message:</strong><br/>${escapeHtml(note).replace(/\n/g, "<br/>")}</p>` : "") +
      `<p><a href="${link}">Open the brief</a></p>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [email],
        subject,
        text,
        html,
      }),
    });

    if (!res.ok) {
      console.error("kickoff nudge: Resend send failed:", await res.text());
    }
  } catch (e) {
    console.error("kickoff nudge: unexpected error", e);
  }
}
