"use client";

import { useMemo } from "react";
import type { Partner, Summary } from "@/lib/spec-sheets/enrich";
import { daysUntil, formatShortDate } from "./helpers";
import { PartnerIcon } from "./partner-icons";

type UrgencyFilter = "all" | "overdue" | "urgent" | "soon" | "safe";
type LayoutKey = "rows" | "cards" | "timeline";

type HeaderProps = {
  summary: Summary;
  partners: Partner[];
  activePartner: string | null;
  setActivePartner: (p: string | null) => void;
  activeUrgency: UrgencyFilter;
  setActiveUrgency: (u: UrgencyFilter) => void;
  counts: {
    total: number;
    byPartner: Record<string, number>;
    byUrg: { overdue: number; urgent: number; soon: number; safe: number };
  };
  layout: LayoutKey;
  setLayout: (l: LayoutKey) => void;
};

type StatTone = "default" | "urgent" | "overdue";

type StatProps = {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: StatTone;
};

function Stat({ label, value, sub, tone = "default" }: StatProps) {
  return (
    <div className={`bsd-stat bsd-stat-${tone}`}>
      <div className="bsd-stat-label">{label}</div>
      <div className="bsd-stat-value">{value}</div>
      {sub && <div className="bsd-stat-sub">{sub}</div>}
    </div>
  );
}

export function ViewerHeader({
  summary,
  partners,
  activePartner,
  setActivePartner,
  activeUrgency,
  setActiveUrgency,
  counts,
  layout,
  setLayout,
}: HeaderProps) {
  const today = useMemo(() => new Date(), []);
  const earliest = summary.earliestDue ? new Date(summary.earliestDue) : null;
  const daysToEarliest = daysUntil(earliest, today);
  const earliestTone: StatTone =
    earliest == null || daysToEarliest == null
      ? "default"
      : daysToEarliest < 0
        ? "overdue"
        : daysToEarliest <= 7
          ? "urgent"
          : "default";

  return (
    <>
      <header className="bsd-hero">
        <div className="bsd-hero-top">
          <div>
            <div className="bsd-eyebrow">Creative Spec Workspace</div>
            <h1 className="bsd-hero-title">{summary.templateName}</h1>
            {summary.client && <div className="bsd-hero-sub">{summary.client}</div>}
          </div>
          <div className="bsd-hero-stats">
            <Stat label="Placements" value={counts.total} />
            <Stat
              label="Due in ≤ 7d"
              value={counts.byUrg.urgent}
              tone={counts.byUrg.urgent > 0 ? "urgent" : "default"}
            />
            <Stat
              label="Overdue"
              value={counts.byUrg.overdue}
              tone={counts.byUrg.overdue > 0 ? "overdue" : "default"}
            />
            {earliest && (
              <Stat
                label="Earliest due"
                value={formatShortDate(earliest)}
                sub={`${daysToEarliest}d · ${earliest.toLocaleDateString("en-US", { weekday: "short" })}`}
                tone={earliestTone}
              />
            )}
          </div>
        </div>

        <div className="bsd-hero-bottom">
          <div className="bsd-chip-row">
            <button
              className={`bsd-chip ${!activePartner ? "is-active" : ""}`}
              onClick={() => setActivePartner(null)}
            >
              All partners <span className="bsd-chip-count">{counts.total}</span>
            </button>
            {partners.map((p) => {
              const count = counts.byPartner[p.id] || 0;
              if (!count) return null;
              const active = activePartner === p.id;
              return (
                <button
                  key={p.id}
                  className={`bsd-chip ${active ? "is-active" : ""}`}
                  onClick={() => setActivePartner(active ? null : p.id)}
                  style={active ? { background: p.color, borderColor: p.color, color: "#fff" } : {}}
                >
                  <span
                    className="bsd-chip-icon"
                    style={active ? { color: "#fff" } : { color: p.color }}
                  >
                    <PartnerIcon iconId={p.iconId} size={14} />
                  </span>
                  {p.name}
                  <span className="bsd-chip-count">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="bsd-urg-filter">
            <span className="bsd-urg-filter-label">Due date</span>
            {(["all", "overdue", "urgent", "soon", "safe"] as const).map((k) => (
              <button
                key={k}
                className={`bsd-urg-btn bsd-urg-btn-${k} ${activeUrgency === k ? "is-active" : ""}`}
                onClick={() => setActiveUrgency(k)}
              >
                {k === "all"
                  ? "All"
                  : k === "urgent"
                    ? "≤ 7d"
                    : k === "soon"
                      ? "≤ 21d"
                      : k === "safe"
                        ? "> 21d"
                        : "Overdue"}
                {k !== "all" && (
                  <span className="bsd-urg-btn-count">{counts.byUrg[k] || 0}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="bsd-toolbar">
        <div className="bsd-toolbar-spacer" />
        <div className="bsd-layout-switch">
          {(
            [
              ["rows", "Rows"],
              ["cards", "Cards"],
              ["timeline", "Timeline"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              className={`bsd-layout-btn ${layout === k ? "is-active" : ""}`}
              onClick={() => setLayout(k)}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="bsd-print-btn" onClick={() => window.print()}>
          Print
        </button>
      </div>
    </>
  );
}
