import { notFound, redirect } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import { getAuthedRepo } from "@/lib/project-kickoff/authed-repo";
import { canApprove } from "@/lib/project-kickoff/config";
import { KickoffEditor } from "@/components/project-kickoff/kickoff-editor";
import { KickoffDocument } from "@/components/project-kickoff/kickoff-document";
import type { User } from "@clerk/backend";

/** Title-case a single token: "casey" → "Casey". */
function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
}

/**
 * Best-effort "First L." from an email local part: "casey.woods" → "Casey W.",
 * "monica.alameda" → "Monica A.". A single-token local (no separator, e.g.
 * "miamidesigns") has no last name to abbreviate, so it's just title-cased.
 */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0];
  const tokens = local.split(/[._+-]+/).filter(Boolean);
  if (tokens.length >= 2) {
    return `${cap(tokens[0])} ${tokens[tokens.length - 1][0].toUpperCase()}.`;
  }
  return cap(local);
}

function resolveDisplayName(user: User): string {
  const firstName = user.firstName ?? "";
  const lastName = user.lastName ?? "";
  if (firstName && lastName) return `${firstName} ${lastName[0].toUpperCase()}.`;
  if (firstName) return firstName;
  const email = user.emailAddresses[0]?.emailAddress;
  if (email) return nameFromEmail(email);
  return user.id;
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthedRepo();
  if (!ctx) redirect("/");
  const { id } = await params;
  const kickoff = await ctx.repo.get(id);
  if (!kickoff) notFound();

  // Collect distinct user ids to resolve: current user + last_edited_by + submitted_by + approved_by
  const editorIdSet = new Set<string>([ctx.userId]);
  for (const sd of Object.values(kickoff.sections)) {
    if (sd?.last_edited_by) editorIdSet.add(sd.last_edited_by);
  }
  if (kickoff.submitted_by) editorIdSet.add(kickoff.submitted_by);
  if (kickoff.approved_by) editorIdSet.add(kickoff.approved_by);
  const editorIds = Array.from(editorIdSet);

  const editorNames: Record<string, string> = {};
  let users: { id: string; name: string }[] = [];
  try {
    const clerk = await clerkClient();
    // Full roster for the section-owner dropdown — also seeds editorNames so most
    // ids resolve to a name without a second lookup.
    const roster = await clerk.users.getUserList({ limit: 100 });
    users = roster.data
      .map((u) => ({ id: u.id, name: resolveDisplayName(u) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const user of roster.data) editorNames[user.id] = resolveDisplayName(user);

    // Resolve any editor not in the roster (e.g. since-removed users) so the
    // "edited by" labels don't fall back to a raw id.
    const unresolved = editorIds.filter((eid) => !(eid in editorNames));
    if (unresolved.length) {
      const res = await clerk.users.getUserList({ userId: unresolved, limit: unresolved.length });
      for (const user of res.data) editorNames[user.id] = resolveDisplayName(user);
    }
  } catch {
    // Non-fatal: UI falls back to raw id / empty roster
  }

  if (kickoff.status === "under_review" || kickoff.status === "approved") {
    return (
      <KickoffDocument
        kickoff={kickoff}
        editorNames={editorNames}
        isApprover={canApprove(ctx.userId)}
      />
    );
  }

  return (
    <KickoffEditor
      initial={kickoff}
      currentUserId={ctx.userId}
      isApprover={canApprove(ctx.userId)}
      editorNames={editorNames}
      users={users}
    />
  );
}
