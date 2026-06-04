"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MetaCard, SectionCard, RowGrid,
  type Row,
} from "./momentum/summary-parts";
import { useKickoffTransition } from "@/lib/project-kickoff/queries";
import { activeSections, sectionComplete } from "@/lib/project-kickoff/validation";
import { navLayout } from "@/lib/project-kickoff/nav-layout";
import type { Kickoff } from "@/lib/project-kickoff/types";

const STATUS_LABEL: Record<Kickoff["status"], string> = {
  draft: "Draft", under_review: "Under review", approved: "Approved",
};

export function KickoffDocument({
  kickoff, editorNames, isApprover,
}: {
  kickoff: Kickoff;
  editorNames: Record<string, string>;
  isApprover: boolean;
}) {
  const router = useRouter();
  const transition = useKickoffTransition(kickoff.id);

  // Sections that have at least one displayable value.
  const shownSections = useMemo(
    () =>
      activeSections(kickoff.deliverables).filter((s) => {
        const data = kickoff.sections[String(s.id)];
        if (!data) return false;
        const hasAnswer = s.fields.some((f) => (data.answers[f.key] ?? "").trim() !== "");
        const hasApproval = data.approval !== null;
        const hasNotes = (data.approval_notes ?? "").trim() !== "";
        return hasAnswer || hasApproval || hasNotes;
      }),
    [kickoff.deliverables, kickoff.sections]
  );

  // Sequential section numbers — identical to the editor — via navLayout.
  const numberById = useMemo(() => {
    const nav = navLayout(kickoff.deliverables);
    const m: Record<number, number> = {};
    for (const r of nav.lead) m[r.section.id] = r.number;
    for (const d of nav.deliverables) if (d.number != null) m[d.section.id] = d.number;
    for (const r of nav.tail) m[r.section.id] = r.number;
    return m;
  }, [kickoff.deliverables]);

  async function doTransition(action: "approve" | "reopen") {
    try {
      await transition.mutateAsync(action);
      toast.success(action === "approve" ? "Approved" : "Reopened for editing");
      router.refresh();
    } catch (e) {
      const err = e as { status?: number };
      if (err.status === 403) toast.error("You don't have permission for that");
      else toast.error("Something went wrong");
    }
  }

  return (
    <div className="momentum-kickoff" style={{ paddingBottom: 80 }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: "-.02em", color: "var(--glue-ink)" }}>{kickoff.title}</h1>
          <span style={{ background: "var(--glue-ink-100)", color: "var(--glue-ink-600)", fontSize: 14, fontWeight: 600, padding: "5px 13px", borderRadius: 999 }}>
            {STATUS_LABEL[kickoff.status]}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button type="button" className="m-btn m-btn-ghost" onClick={() => router.push("/dashboard/strategist/project-kickoff")}>
            Back to list
          </button>
          {kickoff.status === "under_review" && (
            <button type="button" className="m-btn m-btn-outline" disabled={transition.isPending} onClick={() => doTransition("reopen")}>
              Reopen / unlock
            </button>
          )}
          {kickoff.status === "under_review" && isApprover && (
            <button type="button" className="m-btn m-btn-approve" disabled={transition.isPending} onClick={() => doTransition("approve")}>
              Approve
            </button>
          )}
          {kickoff.status === "approved" && isApprover && (
            <button type="button" className="m-btn m-btn-outline" disabled={transition.isPending} onClick={() => doTransition("reopen")}>
              Reopen
            </button>
          )}
        </div>
      </div>

      {/* overview + section cards */}
      <MetaCard id="doc-overview" kickoff={kickoff} editorNames={editorNames} />

      {shownSections.map((section) => {
        const data = kickoff.sections[String(section.id)]!;
        const rows: Row[] = [];
        for (const f of section.fields) {
          if ((data.answers[f.key] ?? "").trim() !== "") {
            rows.push({ label: f.label, node: data.answers[f.key] });
          }
        }
        if (data.approval !== null) {
          rows.push({
            label: "Approval",
            node: <span className="m-deliv-pill" style={{ textTransform: "capitalize" }}>{data.approval}</span>,
          });
        }
        if ((data.approval_notes ?? "").trim() !== "") {
          rows.push({ label: "Approval notes", node: data.approval_notes });
        }
        return (
          <SectionCard
            key={section.id}
            id={`doc-section-${section.id}`}
            number={numberById[section.id]}
            title={section.title}
            complete={sectionComplete(section, kickoff.sections)}
          >
            <RowGrid rows={rows} />
          </SectionCard>
        );
      })}
    </div>
  );
}
