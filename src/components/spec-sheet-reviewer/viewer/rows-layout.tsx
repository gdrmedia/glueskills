"use client";

import { useMemo } from "react";
import type React from "react";
import type { Partner } from "@/lib/spec-sheets/enrich";
import type { HydratedPlacement } from "./spec-viewer";
import { asArray, formatDate, partnerById, urgencyOf } from "./helpers";
import { PartnerIcon } from "./partner-icons";
import { Urgency } from "./urgency";
import { DetailView } from "./detail-view";

export function RowsLayout({
  placements,
  partners,
  expandedId,
  onToggle,
}: {
  placements: HydratedPlacement[];
  partners: Partner[];
  expandedId: string | null;
  onToggle: (id: string) => void;
}): React.ReactElement {
  const grouped = useMemo(() => {
    const m: Record<string, HydratedPlacement[]> = {};
    placements.forEach((pl) => {
      (m[pl.partner] ||= []).push(pl);
    });
    return m;
  }, [placements]);

  return (
    <div className="bsd-rows">
      {Object.entries(grouped).map(([partnerId, items]) => {
        const p = partnerById(partnerId, partners);
        if (!p) return null;
        return (
          <section key={partnerId} className="bsd-group">
            <div className="bsd-group-head">
              <div className="bsd-group-title">
                <span className="bsd-group-icon" style={{ color: p.color }}>
                  <PartnerIcon iconId={p.iconId} size={16} />
                </span>
                <span className="bsd-eyebrow" style={{ color: p.color }}>
                  {p.name}
                </span>
              </div>
              <span className="bsd-group-count">
                {items.length} PLACEMENT{items.length === 1 ? "" : "S"}
              </span>
            </div>
            {items.map((pl) => (
              <RichRow
                key={pl.id}
                placement={pl}
                partners={partners}
                partnerColor={p.color}
                expanded={expandedId === pl.id}
                onToggle={() => onToggle(pl.id)}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function RichRow({
  placement,
  partners,
  partnerColor,
  expanded,
  onToggle,
}: {
  placement: HydratedPlacement;
  partners: Partner[];
  partnerColor: string;
  expanded: boolean;
  onToggle: () => void;
}): React.ReactElement {
  const urg = placement.dueTBD
    ? { key: "tbd" as const }
    : urgencyOf(placement.creativeDue);
  return (
    <article
      className={`bsd-row bsd-row-urg-${urg.key} ${expanded ? "is-expanded" : ""}`}
    >
      <button className="bsd-row-main" onClick={onToggle}>
        <span className="bsd-row-stripe" style={{ background: partnerColor }} />
        <div className="bsd-row-name">
          <div className="bsd-row-title">{placement.name}</div>
          <div className="bsd-row-subtitle">
            {[placement.adFormat, placement.adPlacement]
              .filter(Boolean)
              .join(" · ") || "—"}
          </div>
        </div>

        <div className="bsd-row-boxes">
          {(() => {
            const dims = asArray(placement.dimensions);
            if (!dims.length) {
              return (
                <div className="bsd-infobox bsd-infobox-dim">
                  <div
                    className="bsd-infobox-value"
                    style={{ color: "var(--glue-ink-400)" }}
                  >
                    —
                  </div>
                </div>
              );
            }
            const maxSlots = 5;
            const shown = dims.slice(0, maxSlots);
            const overflow = dims.length - maxSlots;
            return (
              <>
                {shown.map((d, i) => (
                  <div key={i} className="bsd-infobox bsd-infobox-dim">
                    <div className="bsd-infobox-value">{d}</div>
                  </div>
                ))}
                {overflow > 0 && (
                  <div className="bsd-infobox bsd-infobox-dim bsd-infobox-overflow">
                    <div className="bsd-infobox-value">+{overflow}</div>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        <div className="bsd-row-due">
          <Urgency placement={placement} />
          <div className="bsd-row-duedate">
            {placement.dueTBD
              ? placement.creativeDueRaw
                ? `Due ${String(placement.creativeDueRaw)}`
                : "Date TBD"
              : `Due ${formatDate(placement.creativeDue)}`}
          </div>
        </div>
        <span className="bsd-row-caret" aria-hidden>
          {expanded ? "−" : "+"}
        </span>
      </button>
      {expanded && (
        <DetailView
          placement={placement}
          partners={partners}
          partnerColor={partnerColor}
        />
      )}
    </article>
  );
}
