import { notFound, redirect } from "next/navigation";
import { getAuthedRepo } from "@/lib/project-kickoff/authed-repo";
import { canApprove } from "@/lib/project-kickoff/config";
import { KickoffEditor } from "@/components/project-kickoff/kickoff-editor";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthedRepo();
  if (!ctx) redirect("/");
  const { id } = await params;
  const kickoff = await ctx.repo.get(id);
  if (!kickoff) notFound();
  return <KickoffEditor initial={kickoff} currentUserId={ctx.userId} isApprover={canApprove(ctx.userId)} />;
}
