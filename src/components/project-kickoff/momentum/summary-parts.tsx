"use client";
// ===========================================================================
// Momentum kickoff — read-only Summary (document view) presentational parts.
// Pure UI for KickoffDocument: sticky subnav, overview/meta card, numbered
// collapsible section cards, label/value grid, avatar chip. Tokens come from
// the `.momentum-kickoff` scope in globals.css.
// ===========================================================================
import { Fragment, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { initials } from "./parts";
import type { Kickoff } from "@/lib/project-kickoff/types";

/** "M/D/YYYY · h:mmam/pm" — client-side only (callers guard hydration). */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;
  const mm = String(minutes).padStart(2, "0");
  return `${month}/${day}/${year} · ${hours}:${mm}${ampm}`;
}

export function Avatar({ name }: { name: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <span className="m-avatar">{initials(name)}</span>
      {name}
    </span>
  );
}

export type Row = { label: string; node: React.ReactNode };

export function RowGrid({ rows }: { rows: Row[] }) {
  return (
    <div className="m-rows">
      {rows.map((r, i) => (
        <Fragment key={`${r.label}-${i}`}>
          {i > 0 && <div className="m-rowsep" />}
          <div className="m-label">{r.label}</div>
          <div className="m-val">{r.node}</div>
        </Fragment>
      ))}
    </div>
  );
}

export function SectionCard({
  id, number, title, complete, defaultOpen = true, children,
}: {
  id: string;
  number?: number;
  title: string;
  complete?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className={`m-card${open ? "" : " is-collapsed"}`}>
      <button type="button" className="m-cardhead" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {number != null && <span className="m-chip-num">{number}</span>}
        <h3>{title}</h3>
        {complete && (
          <span className="m-meter">
            <span className="m-ck"><Check size={11} strokeWidth={3} /></span> Complete
          </span>
        )}
        <ChevronDown className="m-chev" size={20} />
      </button>
      {open && <div className="m-cardbody">{children}</div>}
    </section>
  );
}

export function MetaCard({
  id, kickoff, editorNames,
}: {
  id: string;
  kickoff: Kickoff;
  editorNames: Record<string, string>;
}) {
  const dash = <span style={{ color: "var(--glue-ink-400)" }}>—</span>;
  const rows: Row[] = [
    {
      label: "Submission date",
      node: kickoff.submitted_at
        ? <span suppressHydrationWarning>{formatDate(kickoff.submitted_at)}</span>
        : dash,
    },
  ];
  if (kickoff.submitted_by) {
    rows.push({ label: "Submitted by", node: <Avatar name={editorNames[kickoff.submitted_by] ?? kickoff.submitted_by} /> });
  }
  if (kickoff.status === "approved" && kickoff.approved_at) {
    rows.push({ label: "Approved date", node: <span suppressHydrationWarning>{formatDate(kickoff.approved_at)}</span> });
  }
  if (kickoff.status === "approved" && kickoff.approved_by) {
    rows.push({ label: "Approved by", node: <Avatar name={editorNames[kickoff.approved_by] ?? kickoff.approved_by} /> });
  }

  const attached = (
    [
      ["case_study", "Case Study"],
      ["social", "Social Posts"],
      ["award", "Award Submission"],
    ] as const
  ).filter(([k]) => kickoff.deliverables[k]);

  return (
    <SectionCard id={id} title="Overview">
      <RowGrid rows={rows} />
      {attached.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
          {attached.map(([k, label]) => (
            <span key={k} className="m-deliv-pill">
              <span className="m-ck"><Check size={12} strokeWidth={3} /></span> {label}
            </span>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
