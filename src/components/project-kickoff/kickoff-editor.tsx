"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeliverableBar } from "./deliverable-bar";
import { StatusRail } from "./status-rail";
import { SectionCard } from "./section-card";
import { SaveIndicator } from "./save-indicator";
import { useAutosave } from "./use-autosave";
import { useKickoffTransition } from "@/lib/project-kickoff/queries";
import { activeSections, missingRequired } from "@/lib/project-kickoff/validation";
import { mergeSection, type SectionPatch } from "@/lib/project-kickoff/merge";
import type { Kickoff, DeliverableKey, Deliverables } from "@/lib/project-kickoff/types";

const STATUS_LABEL: Record<Kickoff["status"], string> = {
  draft: "Draft", under_review: "Under review", approved: "Approved",
};

export function KickoffEditor(
  { initial, currentUserId, isApprover }:
  { initial: Kickoff; currentUserId: string; isApprover: boolean }
) {
  const router = useRouter();
  const [kickoff, setKickoff] = useState<Kickoff>(initial);
  const sections = useMemo(() => activeSections(kickoff.deliverables), [kickoff.deliverables]);
  const [openId, setOpenId] = useState<number>(sections[0]?.id ?? 1);
  const [showMissing, setShowMissing] = useState(false);
  const autosave = useAutosave(kickoff.id);
  const transition = useKickoffTransition(kickoff.id);
  const readOnly = kickoff.locked;

  const missing = useMemo(() => missingRequired(kickoff.deliverables, kickoff.sections), [kickoff]);
  const missingBySection = useMemo(() => {
    const m: Record<number, Set<string>> = {};
    if (showMissing) for (const x of missing) (m[x.section] ??= new Set()).add(x.key);
    return m;
  }, [missing, showMissing]);

  function patchSection(sectionId: number, patch: SectionPatch) {
    const now = new Date().toISOString();
    const merged = mergeSection(kickoff.sections, sectionId, patch, currentUserId, now);
    setKickoff((k) => ({ ...k, sections: mergeSection(k.sections, sectionId, patch, currentUserId, now) }));
    // Queue the FULL section slice (not just this field's delta) so debounced
    // coalescing can never drop an earlier edit to the same section.
    const full = merged[String(sectionId)];
    autosave.queue({
      section: sectionId,
      patch: {
        answers: full.answers,
        approval: full.approval,
        approval_notes: full.approval_notes,
        owner: full.owner,
        section_status: full.section_status,
      },
    });
  }

  function toggleDeliverable(key: DeliverableKey, next: boolean) {
    const deliverables: Deliverables = { ...kickoff.deliverables, [key]: next };
    setKickoff((k) => ({ ...k, deliverables }));
    autosave.queue({ deliverables });
  }

  async function doTransition(action: "submit" | "approve" | "reopen") {
    try {
      const updated = await transition.mutateAsync(action);
      setKickoff(updated);
      toast.success(
        action === "submit" ? "Submitted for review" :
        action === "approve" ? "Approved" : "Reopened for editing"
      );
    } catch (e) {
      const err = e as { status?: number };
      if (action === "submit" && err.status === 422) {
        setShowMissing(true);
        toast.error("Fill the required fields highlighted below");
        const first = missing[0];
        if (first) { setOpenId(first.section); document.getElementById(`ck-section-${first.section}`)?.scrollIntoView({ behavior: "smooth" }); }
      } else if (err.status === 403) {
        toast.error("You don’t have permission for that");
      } else {
        toast.error("Something went wrong");
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-headline text-2xl font-extrabold tracking-tight">{kickoff.title}</h1>
          <Badge variant="secondary">{STATUS_LABEL[kickoff.status]}</Badge>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={autosave.state} />
          <Button variant="ghost" onClick={() => router.push("/dashboard/strategist/project-kickoff")}>Back to list</Button>
        </div>
      </div>

      <DeliverableBar deliverables={kickoff.deliverables} readOnly={readOnly} onToggle={toggleDeliverable} />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <StatusRail sections={sections} data={kickoff.sections} activeId={openId}
            onJump={(id) => { setOpenId(id); document.getElementById(`ck-section-${id}`)?.scrollIntoView({ behavior: "smooth" }); }} />
        </aside>

        <div className="space-y-4">
          {sections.map((s) => (
            <SectionCard key={s.id} section={s} data={kickoff.sections[String(s.id)] ?? {
              answers: {}, approval: null, approval_notes: "", owner: null,
              section_status: "not_started", last_edited_by: null, last_edited_at: null,
            }}
              open={openId === s.id} readOnly={readOnly}
              missingKeys={missingBySection[s.id] ?? new Set()}
              onToggleOpen={() => setOpenId(openId === s.id ? -1 : s.id)}
              onPatch={(p) => patchSection(s.id, p)} />
          ))}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {kickoff.status === "draft" && (
              <Button onClick={() => doTransition("submit")} disabled={transition.isPending}>Submit for review</Button>
            )}
            {kickoff.status === "under_review" && (
              <Button variant="outline" onClick={() => doTransition("reopen")} disabled={transition.isPending}>Reopen / unlock</Button>
            )}
            {kickoff.status === "under_review" && isApprover && (
              <Button onClick={() => doTransition("approve")} disabled={transition.isPending}>Approve</Button>
            )}
            {kickoff.status === "approved" && isApprover && (
              <Button variant="outline" onClick={() => doTransition("reopen")} disabled={transition.isPending}>Reopen</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
