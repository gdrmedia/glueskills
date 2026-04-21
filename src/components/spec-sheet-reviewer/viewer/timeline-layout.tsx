"use client";

import { useMemo } from "react";
import type React from "react";
import type { Partner } from "@/lib/spec-sheets/enrich";
import type { HydratedPlacement } from "./spec-viewer";
import {
  daysUntil,
  formatShortDate,
  partnerById,
  primary,
  urgencyOf,
  type UrgencyKey,
} from "./helpers";
import { Urgency } from "./urgency";

type DatedPlacement = HydratedPlacement & { creativeDue: Date };

export function TimelineLayout({
  placements,
  partners,
  onExpand,
}: {
  placements: HydratedPlacement[];
  partners: Partner[];
  onExpand: (id: string) => void;
}): React.ReactElement {
  const buckets = useMemo(() => {
    const dated: DatedPlacement[] = placements
      .filter((p): p is DatedPlacement => !p.dueTBD && p.creativeDue != null)
      .sort((a, b) => a.creativeDue.getTime() - b.creativeDue.getTime());
    const tbd = placements.filter((p) => p.dueTBD || !p.creativeDue);
    const weeks: Record<string, { start: Date; items: DatedPlacement[] }> = {};
    dated.forEach((p) => {
      const d = new Date(p.creativeDue);
      const day = (d.getDay() + 6) % 7;
      const monday = new Date(d);
      monday.setDate(d.getDate() - day);
      const key = monday.toISOString().slice(0, 10);
      (weeks[key] ||= { start: monday, items: [] }).items.push(p);
    });
    const ordered = Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b));
    return { ordered, tbd };
  }, [placements]);

  return (
    <div className="bsd-timeline">
      {buckets.ordered.map(([key, { start, items }]) => {
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const daysToStart = daysUntil(start) ?? 0;
        const weekLabel =
          daysToStart < -6
            ? "Past"
            : daysToStart < 0
              ? "This week"
              : daysToStart < 7
                ? "Next week"
                : `Week of ${formatShortDate(start)}`;
        const order: Record<UrgencyKey, number> = {
          overdue: 4,
          urgent: 3,
          soon: 2,
          safe: 1,
        };
        const worst = items.reduce<UrgencyKey>((w, p) => {
          const u = urgencyOf(p.creativeDue);
          return order[u.key] > order[w] ? u.key : w;
        }, "safe");
        return (
          <section key={key} className={`bsd-tl-week bsd-tl-week-${worst}`}>
            <header className="bsd-tl-week-head">
              <div>
                <div className="bsd-tl-week-label">{weekLabel}</div>
                <div className="bsd-tl-week-range">
                  {formatShortDate(start)} – {formatShortDate(end)}
                </div>
              </div>
              <div className="bsd-tl-week-count">{items.length}</div>
            </header>
            <div className="bsd-tl-lane">
              {items.map((pl) => {
                const p = partnerById(pl.partner, partners);
                if (!p) return null;
                return (
                  <button
                    key={pl.id}
                    className="bsd-tl-card"
                    onClick={() => onExpand(pl.id)}
                  >
                    <div className="bsd-tl-card-head">
                      <span
                        className="bsd-pdot"
                        style={{ background: p.color, width: 8, height: 8 }}
                      />
                      <span className="bsd-tl-partner">{p.name}</span>
                      <span className="bsd-tl-date">
                        {formatShortDate(pl.creativeDue)}
                      </span>
                    </div>
                    <div className="bsd-tl-card-title">{pl.name}</div>
                    <div className="bsd-tl-card-specs">
                      <span>{primary(pl.dimensions) || "—"}</span>
                      <span>·</span>
                      <span>{primary(pl.fileFormat) || "—"}</span>
                    </div>
                    <Urgency placement={pl} />
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      {buckets.tbd.length > 0 && (
        <section className="bsd-tl-week bsd-tl-week-tbd">
          <header className="bsd-tl-week-head">
            <div>
              <div className="bsd-tl-week-label">Date TBD</div>
              <div className="bsd-tl-week-range">Awaiting confirmation</div>
            </div>
            <div className="bsd-tl-week-count">{buckets.tbd.length}</div>
          </header>
          <div className="bsd-tl-lane">
            {buckets.tbd.map((pl) => {
              const p = partnerById(pl.partner, partners);
              if (!p) return null;
              return (
                <button
                  key={pl.id}
                  className="bsd-tl-card bsd-tl-card-tbd"
                  onClick={() => onExpand(pl.id)}
                >
                  <div className="bsd-tl-card-head">
                    <span
                      className="bsd-pdot"
                      style={{ background: p.color, width: 8, height: 8 }}
                    />
                    <span className="bsd-tl-partner">{p.name}</span>
                    <span className="bsd-tl-date">
                      {pl.creativeDueRaw != null ? String(pl.creativeDueRaw) : "TBD"}
                    </span>
                  </div>
                  <div className="bsd-tl-card-title">{pl.name}</div>
                  <div className="bsd-tl-card-specs">
                    <span>{primary(pl.dimensions) || "—"}</span>
                    <span>·</span>
                    <span>{primary(pl.fileFormat) || "—"}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
