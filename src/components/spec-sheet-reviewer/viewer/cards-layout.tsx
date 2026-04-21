"use client";

import { useMemo } from "react";
import type React from "react";
import type { Partner } from "@/lib/spec-sheets/enrich";
import type { HydratedPlacement } from "./spec-viewer";
import { asArray, dueShortDisplay, partnerById, urgencyOf } from "./helpers";
import { PartnerIcon } from "./partner-icons";
import { Urgency } from "./urgency";
import { SpecPreview } from "./detail-view";

export function CardsLayout({
  placements,
  partners,
  onExpand,
}: {
  placements: HydratedPlacement[];
  partners: Partner[];
  onExpand: (id: string) => void;
}): React.ReactElement {
  const grouped = useMemo(() => {
    const m: Record<string, HydratedPlacement[]> = {};
    placements.forEach((pl) => {
      (m[pl.partner] ||= []).push(pl);
    });
    return m;
  }, [placements]);

  return (
    <div className="bsd-cards-wrap">
      {Object.entries(grouped).map(([partnerId, items]) => {
        const p = partnerById(partnerId, partners);
        if (!p) return null;
        return (
          <section key={partnerId} className="bsd-cards-group">
            <header className="bsd-cards-group-head">
              <span className="bsd-group-icon" style={{ color: p.color }}>
                <PartnerIcon iconId={p.iconId} size={16} />
              </span>
              <span className="bsd-eyebrow" style={{ color: p.color }}>
                {p.name}
              </span>
              <span className="bsd-cards-group-count">{items.length}</span>
            </header>
            <div className="bsd-cards-grid">
              {items.map((pl) => (
                <SpecCard
                  key={pl.id}
                  placement={pl}
                  partnerColor={p.color}
                  onClick={() => onExpand(pl.id)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SpecCard({
  placement,
  partnerColor,
  onClick,
}: {
  placement: HydratedPlacement;
  partnerColor: string;
  onClick: () => void;
}): React.ReactElement {
  const urg = placement.dueTBD
    ? { key: "tbd" as const }
    : urgencyOf(placement.creativeDue);
  return (
    <button className={`bsd-card bsd-card-urg-${urg.key}`} onClick={onClick}>
      <div className="bsd-card-topbar" style={{ background: partnerColor }} />
      <div className="bsd-card-preview">
        <SpecPreview placement={placement} maxW={200} maxH={110} />
      </div>
      <div className="bsd-card-body">
        <div className="bsd-card-title">{placement.name}</div>
        <div className="bsd-card-sub">{placement.adFormat || "—"}</div>
        <div className="bsd-card-grid">
          <Kvp k="Dimensions" v={placement.dimensions} />
          <Kvp k="Format" v={placement.fileFormat} />
          <Kvp k="Max size" v={placement.maxFileSize} />
          <Kvp k="CTA" v={placement.cta} />
        </div>
      </div>
      <footer className="bsd-card-foot">
        <Urgency placement={placement} />
        <span className="bsd-card-due">{dueShortDisplay(placement)}</span>
      </footer>
    </button>
  );
}

function Kvp({
  k,
  v,
}: {
  k: string;
  v: string | string[] | null | undefined;
}): React.ReactElement {
  const arr = asArray(v);
  const head = arr[0];
  const more = arr.length - 1;
  return (
    <div className="bsd-kvp">
      <span className="bsd-kvp-k">{k}</span>
      <span className="bsd-kvp-v">
        {head ?? <span style={{ color: "var(--glue-ink-400)" }}>—</span>}
        {more > 0 && <span className="bsd-infobox-more">+{more}</span>}
      </span>
    </div>
  );
}
