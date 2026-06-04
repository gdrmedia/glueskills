"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SaveIndicator } from "./save-indicator";
import { NudgeDialog } from "./nudge-dialog";
import { DeleteBriefDialog } from "./delete-brief-dialog";
import { ApprovalControl } from "./approval-control";
import { Ring, Arrow, OwnerControl, MField, SectionNav } from "./momentum/parts";
import { useAutosave } from "./use-autosave";
import { useKickoffTransition, useNudgeSectionOwner, useDeleteKickoff } from "@/lib/project-kickoff/queries";
import { activeSections, missingRequired } from "@/lib/project-kickoff/validation";
import { navLayout } from "@/lib/project-kickoff/nav-layout";
import { mergeSection, type SectionPatch } from "@/lib/project-kickoff/merge";
import type { Kickoff, DeliverableKey, Deliverables, KickoffUser, SectionData, SectionDef } from "@/lib/project-kickoff/types";

const STATUS_LABEL: Record<Kickoff["status"], string> = {
  draft: "Draft", under_review: "Under review", approved: "Approved",
};

// One-line subtitle per section (Momentum's "blurb"), keyed by section id.
const BLURB: Record<number, string> = {
  1: "The 30-second version. Who, what, and why it mattered.",
  2: "The big idea and how it came to life.",
  3: "The numbers that make the case undeniable.",
  4: "Everything the published case study page needs.",
  5: "How this travels across feeds.",
  6: "Make the jury believe.",
  7: "Final sign-offs and the files that ship.",
};

const EMPTY_SECTION: SectionData = {
  answers: {}, approval: null, approval_notes: "", owner: null,
  section_status: "not_started", last_edited_by: null, last_edited_at: null,
};

// Per-section completion from required fields (falls back to all fields when a
// section has no required ones), so the ring is meaningful.
function sectionProgress(section: SectionDef, data: SectionData | undefined) {
  const req = section.fields.filter((f) => f.required);
  const pool = req.length ? req : section.fields;
  const answers = data?.answers ?? {};
  const done = pool.filter((f) => (answers[f.key] ?? "").trim().length > 0).length;
  return { done, total: pool.length, pct: pool.length ? done / pool.length : 0 };
}

export function KickoffEditor(
  { initial, currentUserId, isApprover, editorNames, users }:
  { initial: Kickoff; currentUserId: string; isApprover: boolean; editorNames: Record<string, string>; users: KickoffUser[] }
) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [kickoff, setKickoff] = useState<Kickoff>(initial);
  const sections = useMemo(() => activeSections(kickoff.deliverables), [kickoff.deliverables]);
  const nav = useMemo(() => navLayout(kickoff.deliverables), [kickoff.deliverables]);
  const numberById = useMemo(() => {
    const m: Record<number, number> = {};
    for (const r of nav.lead) m[r.section.id] = r.number;
    for (const d of nav.deliverables) if (d.number != null) m[d.section.id] = d.number;
    for (const r of nav.tail) m[r.section.id] = r.number;
    return m;
  }, [nav]);
  const [openId, setOpenId] = useState<number>(sections[0]?.id ?? 1);
  const [showMissing, setShowMissing] = useState(false);
  const [nudgingId, setNudgingId] = useState<number | null>(null);
  const autosave = useAutosave(kickoff.id);
  const transition = useKickoffTransition(kickoff.id);
  const nudge = useNudgeSectionOwner(kickoff.id);
  const del = useDeleteKickoff();
  const readOnly = kickoff.locked;

  async function nudgeOwner(sectionId: number, message: string) {
    const full = kickoff.sections[String(sectionId)];
    if (!full?.owner) return;
    const ownerName = editorNames[full.owner] ?? full.owner;
    setNudgingId(sectionId);
    try {
      // Autosave is debounced; flush the current section first so the nudge route
      // reads the freshly-selected owner instead of stale server state.
      await autosave.flush({
        section: sectionId,
        patch: {
          answers: full.answers,
          approval: full.approval,
          approval_notes: full.approval_notes,
          owner: full.owner,
          section_status: full.section_status,
        },
      });
      await nudge.mutateAsync({ sectionId, message });
      toast.success(`Reminder sent to ${ownerName}`);
    } catch (e) {
      toast.error("Couldn’t send the reminder");
      throw e; // let the dialog stay open so the user can retry
    } finally {
      setNudgingId(null);
    }
  }

  const missing = useMemo(() => missingRequired(kickoff.deliverables, kickoff.sections), [kickoff]);
  const missingBySection = useMemo(() => {
    const m: Record<number, Set<string>> = {};
    if (showMissing) for (const x of missing) (m[x.section] ??= new Set()).add(x.key);
    return m;
  }, [missing, showMissing]);

  function patchSection(sectionId: number, patch: SectionPatch) {
    const now = new Date().toISOString();
    setKickoff((k) => {
      const sections = mergeSection(k.sections, sectionId, patch, currentUserId, now);
      const full = sections[String(sectionId)];
      // Queue the FULL section slice (not just this field's delta) built from the
      // freshly-merged state, so debounced coalescing can never drop an earlier
      // same-render edit to the same section. autosave.queue is idempotent-by-
      // replacement, so it is safe to call inside the updater even if React
      // double-invokes it (StrictMode / concurrent).
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
      const nextTitle =
        sectionId === 1 && patch.answers && "campaign_name" in patch.answers
          ? (patch.answers.campaign_name as string).trim() || "Untitled brief"
          : k.title;
      return { ...k, sections, title: nextTitle };
    });
  }

  function toggleDeliverable(key: DeliverableKey, next: boolean) {
    setKickoff((k) => {
      const deliverables: Deliverables = { ...k.deliverables, [key]: next };
      autosave.queue({ deliverables });
      return { ...k, deliverables };
    });
  }

  async function deleteBrief() {
    try {
      await del.mutateAsync(kickoff.id);
      toast.success("Brief deleted");
      router.push("/dashboard/strategist/project-kickoff");
    } catch (e) {
      const err = e as { status?: number };
      if (err.status === 409) toast.error("Only drafts can be deleted");
      else if (err.status === 403) toast.error("You don't have permission for that");
      else toast.error("Couldn't delete the brief");
      throw e; // keep the dialog open so the user can retry
    }
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
        if (first) goToSection(first.section);
      } else if (err.status === 403) {
        toast.error("You don’t have permission for that");
      } else {
        toast.error("Something went wrong");
      }
    }
  }

  // Switch sections and jump the scroll container to the top, so the next
  // section fades in already scrolled up rather than mid-page.
  function goToSection(id: number) {
    setOpenId(id);
    let node: HTMLElement | null = rootRef.current?.parentElement ?? null;
    while (node) {
      const oy = getComputedStyle(node).overflowY;
      if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight) { node.scrollTop = 0; break; }
      node = node.parentElement;
    }
  }

  // Active section (guarded against a just-removed deliverable section).
  const activeSection = sections.find((s) => s.id === openId) ?? sections[0];
  const activeIdx = sections.findIndex((s) => s.id === activeSection.id);
  const activeData = kickoff.sections[String(activeSection.id)] ?? EMPTY_SECTION;
  const activePct = sectionProgress(activeSection, activeData);

  return (
    <div ref={rootRef} className="momentum-kickoff" style={{ paddingBottom: 80 }}>
      {/* campaign header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: "-.02em", color: "var(--glue-ink)" }}>{kickoff.title}</h1>
          <span style={{ background: "var(--glue-ink-100)", color: "var(--glue-ink-600)", fontSize: 14, fontWeight: 600, padding: "5px 13px", borderRadius: 999 }}>
            {STATUS_LABEL[kickoff.status]}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <SaveIndicator state={autosave.state} />
          <button type="button" className="m-btn m-btn-ghost" onClick={() => router.push("/dashboard/strategist/project-kickoff")}>
            Back to list
          </button>
          {kickoff.status === "draft" && (
            <button type="button" className="m-btn m-btn-primary" disabled={transition.isPending} onClick={() => doTransition("submit")}>
              Submit for review
            </button>
          )}
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

      {/* two-column body */}
      <div style={{ display: "flex", gap: 28, marginTop: 26, alignItems: "flex-start" }}>
        {/* ring nav */}
        <div style={{ width: 300, flexShrink: 0, position: "sticky", top: 12 }}>
          <SectionNav
            layout={nav}
            activeId={activeSection.id}
            progressFor={(s) => sectionProgress(s, kickoff.sections[String(s.id)])}
            readOnly={readOnly}
            onSelect={goToSection}
            onAdd={(key, id) => { toggleDeliverable(key, true); goToSection(id); }}
            onRemove={(key) => toggleDeliverable(key, false)}
          />
        </div>

        {/* section panel */}
        <div style={{ flex: 1, minWidth: 0, background: "var(--glue-surface)", borderRadius: 20, boxShadow: "var(--shadow-panel)", padding: "30px 34px" }}>
          <div style={{ fontSize: 13, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--glue-ink-400)", fontWeight: 600 }}>
            Section {numberById[activeSection.id] ?? "–"} / {nav.activeTotal}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, margin: "6px 0 4px" }}>
            <h2 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: "-.02em", color: "var(--glue-ink)" }}>{activeSection.title}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--glue-ink-500)", fontWeight: 600, fontSize: 15 }}>
              <Ring pct={activePct.pct} size={30} stroke={3.5} /> <span className="m-num">{Math.round(activePct.pct * 100)}%</span>
            </div>
          </div>
          <p style={{ margin: "0 0 20px", color: "var(--glue-ink-500)", fontSize: 16 }}>{BLURB[activeSection.id]}</p>

          {/* status + owner + nudge */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 24 }}>
            <OwnerControl ownerId={activeData.owner} users={users} editorNames={editorNames} disabled={readOnly}
              onChange={(v) => patchSection(activeSection.id, { owner: v })} />
            <NudgeDialog
              recipientName={activeData.owner ? (editorNames[activeData.owner] ?? activeData.owner) : ""}
              disabled={readOnly || !activeData.owner}
              sending={nudgingId === activeSection.id}
              onSend={(message) => nudgeOwner(activeSection.id, message)} />
          </div>

          {/* fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {activeSection.fields.map((f) => (
              <MField key={f.key} field={f} value={activeData.answers[f.key] ?? ""} readOnly={readOnly}
                missing={missingBySection[activeSection.id]?.has(f.key) ?? false}
                onChange={(v) => patchSection(activeSection.id, { answers: { [f.key]: v } })} />
            ))}
          </div>

          {/* approval */}
          <div style={{ marginTop: 22 }}>
            <ApprovalControl approval={activeData.approval} notes={activeData.approval_notes} readOnly={readOnly}
              onApproval={(v) => patchSection(activeSection.id, { approval: v })}
              onNotes={(v) => patchSection(activeSection.id, { approval_notes: v })} />
          </div>

          {/* prev / next */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 30, paddingTop: 22, borderTop: "1px solid var(--glue-line)" }}>
            <button type="button" className="m-btn m-btn-outline" disabled={activeIdx <= 0}
              onClick={() => goToSection(sections[activeIdx - 1].id)}>
              <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}><Arrow size={16} /></span> Back
            </button>
            <button type="button" className="m-btn m-btn-primary" disabled={activeIdx >= sections.length - 1}
              onClick={() => goToSection(sections[activeIdx + 1].id)}>
              Save &amp; continue <Arrow />
            </button>
          </div>
          {!readOnly && (
            <div style={{ display: "flex", marginTop: 18 }}>
              <DeleteBriefDialog deleting={del.isPending} onConfirm={deleteBrief} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
