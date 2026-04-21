"use client";

import { useMemo, useState } from "react";
import "./viewer.css";
import type { EnrichedPlacement, Partner, Summary } from "@/lib/spec-sheets/enrich";
import { urgencyOf } from "./helpers";
import { ViewerHeader } from "./header";
import { RowsLayout } from "./rows-layout";
import { CardsLayout } from "./cards-layout";
import { TimelineLayout } from "./timeline-layout";
import { DetailModal } from "./detail-modal";

type Props = {
  placements: EnrichedPlacement[];
  partners: Partner[];
  summary: Summary;
};

type HydratedPlacement = Omit<EnrichedPlacement, "flightStart" | "flightEnd" | "creativeDue"> & {
  flightStart: Date | null;
  flightEnd: Date | null;
  creativeDue: Date | null;
};

export function SpecViewer({ placements, partners, summary }: Props) {
  const hydrated: HydratedPlacement[] = useMemo(
    () =>
      placements.map((p) => ({
        ...p,
        flightStart: p.flightStart ? new Date(p.flightStart) : null,
        flightEnd: p.flightEnd ? new Date(p.flightEnd) : null,
        creativeDue: p.creativeDue ? new Date(p.creativeDue) : null,
      })),
    [placements]
  );

  const today = useMemo(() => new Date(), []);

  const [layout, setLayout] = useState<"rows" | "cards" | "timeline">("rows");
  const [partner, setPartner] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<"all" | "overdue" | "urgent" | "soon" | "safe">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalId, setModalId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return hydrated.filter((pl) => {
      if (partner && pl.partner !== partner) return false;
      if (urgency !== "all") {
        if (pl.dueTBD || !pl.creativeDue) return false;
        if (urgencyOf(pl.creativeDue, today).key !== urgency) return false;
      }
      return true;
    });
  }, [hydrated, partner, urgency, today]);

  const counts = useMemo(() => {
    const byPartner: Record<string, number> = {};
    const byUrg = { overdue: 0, urgent: 0, soon: 0, safe: 0 };
    for (const pl of hydrated) {
      byPartner[pl.partner] = (byPartner[pl.partner] || 0) + 1;
      if (pl.creativeDue && !pl.dueTBD) {
        const key = urgencyOf(pl.creativeDue, today).key;
        if (key in byUrg) byUrg[key as keyof typeof byUrg]++;
      }
    }
    return { total: hydrated.length, byPartner, byUrg };
  }, [hydrated, today]);

  const modalPlacement = modalId ? hydrated.find((p) => p.id === modalId) : null;

  return (
    <div className="viewerRoot">
      <ViewerHeader
        summary={summary}
        partners={partners}
        activePartner={partner}
        setActivePartner={setPartner}
        activeUrgency={urgency}
        setActiveUrgency={setUrgency}
        counts={counts}
        layout={layout}
        setLayout={setLayout}
      />

      {layout === "rows" && (
        <RowsLayout
          placements={filtered}
          partners={partners}
          expandedId={expandedId}
          onToggle={(id) => setExpandedId((cur) => (cur === id ? null : id))}
        />
      )}
      {layout === "cards" && (
        <CardsLayout placements={filtered} partners={partners} onExpand={setModalId} />
      )}
      {layout === "timeline" && (
        <TimelineLayout placements={filtered} partners={partners} onExpand={setModalId} />
      )}

      {modalPlacement && (
        <DetailModal
          placement={modalPlacement}
          partners={partners}
          onClose={() => setModalId(null)}
        />
      )}
    </div>
  );
}

export type { HydratedPlacement };
