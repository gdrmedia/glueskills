"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useKickoffList, useCreateKickoff } from "@/lib/project-kickoff/queries";
import type { Deliverables, KickoffStatus } from "@/lib/project-kickoff/types";
import type { ListTab } from "@/lib/project-kickoff/repository";

const STATUS_LABEL: Record<KickoffStatus, string> = {
  draft: "Draft", under_review: "Under review", approved: "Approved",
};
const DLABEL: Record<keyof Deliverables, string> = { case_study: "CS", social: "Social", award: "Award" };

function deliverableChips(d: Deliverables) {
  return (Object.keys(d) as (keyof Deliverables)[]).filter((k) => d[k]).map((k) => DLABEL[k]).join(" · ") || "—";
}

export function KickoffList() {
  const router = useRouter();
  const [tab, setTab] = useState<ListTab>("drafts");
  const { data, isLoading } = useKickoffList(tab);
  const create = useCreateKickoff();

  async function newBrief() {
    const id = await create.mutateAsync();
    router.push(`/dashboard/strategist/project-kickoff/${id}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight">Creative Kickoff Brief</h1>
          <p className="mt-1.5 text-muted-foreground">Capture, hand off, and approve project kickoff briefs.</p>
        </div>
        <Button onClick={newBrief} disabled={create.isPending}><Plus className="h-4 w-4" /> New brief</Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ListTab)}>
        <TabsList>
          <TabsTrigger value="drafts">Drafts</TabsTrigger>
          <TabsTrigger value="under_review">Under review</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
      ) : !data?.length ? (
        <div className="rounded-2xl bg-card p-10 text-center text-muted-foreground">
          {{ drafts: "No drafts yet. Create one to get started.", under_review: "No briefs under review.", approved: "No approved briefs yet." }[tab]}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
          {data.map((k) => (
            <button key={k.id} onClick={() => router.push(`/dashboard/strategist/project-kickoff/${k.id}`)}
              className="flex w-full items-center gap-4 border-b px-6 py-4 text-left last:border-0 hover:bg-accent/50">
              <span className="flex-1 truncate font-medium">{k.title}</span>
              <Badge variant="secondary">{STATUS_LABEL[k.status]}</Badge>
              <span className="hidden w-28 truncate text-sm text-muted-foreground sm:block">{deliverableChips(k.deliverables)}</span>
              <span className="w-12 text-right text-sm text-muted-foreground">{k.progress.done}/{k.progress.total}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
