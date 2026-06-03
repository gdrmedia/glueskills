import { notFound, redirect } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import { getAuthedRepo } from "@/lib/project-kickoff/authed-repo";
import { canApprove } from "@/lib/project-kickoff/config";
import { KickoffEditor } from "@/components/project-kickoff/kickoff-editor";
import { KickoffDocument } from "@/components/project-kickoff/kickoff-document";
import type { User } from "@clerk/backend";

function resolveDisplayName(user: User): string {
  const firstName = user.firstName ?? "";
  const lastName = user.lastName ?? "";
  if (firstName && lastName) return `${firstName} ${lastName[0]}.`;
  if (firstName) return firstName;
  const email = user.emailAddresses[0]?.emailAddress;
  if (email) return email.split("@")[0];
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
  try {
    const clerk = await clerkClient();
    // limit defaults to 10; set it to the id count so no editor is silently dropped
    const res = await clerk.users.getUserList({ userId: editorIds, limit: editorIds.length });
    for (const user of res.data) {
      editorNames[user.id] = resolveDisplayName(user);
    }
  } catch {
    // Non-fatal: UI falls back to raw id
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
    />
  );
}
