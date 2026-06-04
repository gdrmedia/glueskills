"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useKickoffList, useCreateKickoff } from "@/lib/project-kickoff/queries";
import type { Deliverables, KickoffStatus, KickoffSummary } from "@/lib/project-kickoff/types";
import type { ListTab } from "@/lib/project-kickoff/repository";
import { mergeKickoffTabs } from "@/lib/project-kickoff/merge-tabs";
import { Ring, Check, Arrow } from "./momentum/parts";

type TabKey = ListTab | "all";

const TABS: { value: TabKey; label: string }[] = [
  { value: "all", label: "All briefs" },
  { value: "drafts", label: "Drafts" },
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
];

const STATUS_META: Record<KickoffStatus, { cls: string; label: string; dot: string }> = {
  draft: { cls: "m-spill-draft", label: "Draft", dot: "var(--glue-ink-400)" },
  under_review: { cls: "m-spill-review", label: "Under review", dot: "var(--glue-amber)" },
  approved: { cls: "m-spill-approved", label: "Approved", dot: "var(--glue-green)" },
};

const DLABEL: Record<keyof Deliverables, string> = { case_study: "Case Study", social: "Social", award: "Award" };
const VERB: Record<KickoffStatus, string> = { draft: "Edited", under_review: "Submitted", approved: "Approved" };
const EMPTY: Record<TabKey, string> = {
  all: "No briefs yet. Create one to get started.",
  drafts: "No drafts yet. Create one to get started.",
  under_review: "No briefs under review.",
  approved: "No approved briefs yet.",
};

function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = 60_000, hr = 60 * min, day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)} min ago`;
  if (diff < day) { const n = Math.floor(diff / hr); return `${n} hour${n > 1 ? "s" : ""} ago`; }
  if (diff < 2 * day) return "yesterday";
  if (diff < 7 * day) return `${Math.floor(diff / day)} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}

function BriefRow({ k, onOpen }: { k: KickoffSummary; onOpen: () => void }) {
  const st = STATUS_META[k.status];
  const delivs = (Object.keys(k.deliverables) as (keyof Deliverables)[]).filter((key) => k.deliverables[key]);
  const { done, total } = k.progress;
  const pct = total ? done / total : 0;
  const complete = pct >= 1;
  const ringColor = complete ? "var(--glue-green)" : pct > 0 ? "var(--glue-primary)" : "var(--glue-ink-200)";
  return (
    <button type="button" className="m-brief" onClick={onOpen}>
      <span className="m-brief-main">
        <span className="m-brief-name">
          {k.title || "Untitled brief"}
          <span className="m-brief-arrow"><Arrow size={18} /></span>
        </span>
        <span className="m-brief-meta">{VERB[k.status]} {formatWhen(k.updated_at)}</span>
      </span>
      {delivs.length ? (
        <span className="m-dchips">{delivs.map((key) => <span key={key} className="m-dchip">{DLABEL[key]}</span>)}</span>
      ) : (
        <span style={{ color: "var(--glue-ink-300)", fontSize: 20, flexShrink: 0 }}>—</span>
      )}
      <span className={`m-spill ${st.cls}`}><span className="m-dot" style={{ background: st.dot }} />{st.label}</span>
      <span style={{ position: "relative", width: 46, height: 46, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Ring pct={pct} size={46} stroke={4} color={ringColor} />
        <span className="m-num" style={{ position: "absolute", fontSize: 12, fontWeight: 700, color: complete ? "var(--glue-green)" : "var(--glue-ink)" }}>
          {complete ? <Check size={16} /> : `${done}/${total}`}
        </span>
      </span>
    </button>
  );
}

export function KickoffList() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("all");
  // Load all three tabs so the segmented control can show live counts; cached 5min.
  const drafts = useKickoffList("drafts");
  const review = useKickoffList("under_review");
  const approved = useKickoffList("approved");
  const create = useCreateKickoff();

  const counts: Record<TabKey, number> = {
    all: (drafts.data?.length ?? 0) + (review.data?.length ?? 0) + (approved.data?.length ?? 0),
    drafts: drafts.data?.length ?? 0,
    under_review: review.data?.length ?? 0,
    approved: approved.data?.length ?? 0,
  };
  const isLoading =
    tab === "all" ? drafts.isLoading || review.isLoading || approved.isLoading
    : tab === "drafts" ? drafts.isLoading
    : tab === "under_review" ? review.isLoading
    : approved.isLoading;
  const rows =
    tab === "all"
      ? mergeKickoffTabs(drafts.data ?? [], review.data ?? [], approved.data ?? [])
      : tab === "drafts" ? (drafts.data ?? [])
      : tab === "under_review" ? (review.data ?? [])
      : (approved.data ?? []);

  async function newBrief() {
    const id = await create.mutateAsync();
    router.push(`/dashboard/strategist/project-kickoff/${id}`);
  }

  return (
    <div className="momentum-kickoff" style={{ paddingBottom: 60 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, marginBottom: 30, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 42, fontWeight: 700, letterSpacing: "-.025em", color: "var(--glue-ink)" }}>Creative Kickoff Brief</h1>
          <div style={{ fontSize: 19, color: "var(--glue-ink-500)", marginTop: 8 }}>Capture, hand off, and approve project kickoff briefs.</div>
        </div>
        <button type="button" className="m-btn m-btn-pink" onClick={newBrief} disabled={create.isPending}>
          <Plus size={19} strokeWidth={2.4} /> New brief
        </button>
      </div>

      <div className="m-tabs" role="tablist" style={{ marginBottom: 24, marginLeft: -5 }}>
        {TABS.map((t) => (
          <button key={t.value} type="button" role="tab" aria-selected={tab === t.value}
            className={`m-tab${tab === t.value ? " is-active" : ""}`} onClick={() => setTab(t.value)}>
            {t.label} <span className="m-tab-count">{counts[t.value]}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="m-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="m-brief" style={{ cursor: "default" }}>
              <span className="m-brief-main">
                <span style={{ display: "block", height: 18, width: "38%", background: "var(--glue-ink-100)", borderRadius: 6 }} />
                <span style={{ display: "block", height: 12, width: "24%", background: "var(--glue-ink-100)", borderRadius: 6, marginTop: 10 }} />
              </span>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="m-list"><div className="m-empty">{EMPTY[tab]}</div></div>
      ) : (
        <div className="m-list">
          {rows.map((k) => (
            <BriefRow key={k.id} k={k} onOpen={() => router.push(`/dashboard/strategist/project-kickoff/${k.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
