"use client";

import { useState } from "react";
import type React from "react";
import type { Partner } from "@/lib/spec-sheets/enrich";
import type { HydratedPlacement } from "./spec-viewer";
import {
  asArray,
  daysUntil,
  dueDisplay,
  partnerById,
  primary,
  urgencyOf,
} from "./helpers";

export function SpecPreview({
  placement,
  maxW = 160,
  maxH = 120,
}: {
  placement: Pick<HydratedPlacement, "dimensions">;
  maxW?: number;
  maxH?: number;
}): React.ReactElement {
  const dims = asArray(placement.dimensions);
  const allSizes: Array<[number, number]> = dims
    .map((d): [number, number] | null => {
      const m = String(d).match(/(\d+)\s*[×x]\s*(\d+)/);
      return m ? [Number(m[1]), Number(m[2])] : null;
    })
    .filter((v): v is [number, number] => v !== null);

  if (!allSizes.length) {
    return (
      <div
        className="bsd-preview bsd-preview-empty"
        style={{ width: maxW, height: maxH }}
      >
        <span>{primary(placement.dimensions) || "—"}</span>
      </div>
    );
  }

  const maxDim = allSizes.reduce((m, [w, h]) => Math.max(m, w, h), 0);
  const scale = (Math.min(maxW, maxH) / maxDim) * 0.9;

  if (allSizes.length === 1) {
    const [w, h] = allSizes[0];
    const ratio = w / h;
    let dw = maxW;
    let dh = maxW / ratio;
    if (dh > maxH) {
      dh = maxH;
      dw = maxH * ratio;
    }
    return (
      <div className="bsd-preview-wrap" style={{ width: maxW, height: maxH }}>
        <div className="bsd-preview" style={{ width: dw, height: dh }}>
          <div className="bsd-preview-crosshair" />
          <span className="bsd-preview-dim">
            {w}
            <span>×</span>
            {h}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bsd-preview-wrap bsd-preview-multi"
      style={{ width: maxW, height: maxH }}
    >
      {allSizes.slice(0, 4).map(([w, h], i) => (
        <div
          key={i}
          className="bsd-preview-layer"
          style={{
            width: w * scale,
            height: h * scale,
            zIndex: allSizes.length - i,
            opacity: 1 - i * 0.18,
          }}
        />
      ))}
      <span className="bsd-preview-dim bsd-preview-dim-multi">
        {allSizes.length} sizes
      </span>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "urgent" | "overdue" | "soon" | "safe" | "tbd";
}): React.ReactElement {
  return (
    <div className={`bsd-kpi bsd-kpi-${tone}`}>
      <div className="bsd-kpi-label">{label}</div>
      <div className="bsd-kpi-value">{value}</div>
      {sub && <div className="bsd-kpi-sub">{sub}</div>}
    </div>
  );
}

function DetailSection({
  title,
  items,
}: {
  title: string;
  items: Array<[string, unknown]>;
}): React.ReactElement {
  return (
    <div className="bsd-dsec">
      <div className="bsd-dsec-title">{title}</div>
      <div className="bsd-dsec-grid">
        {items.map(([k, v]) => {
          const arr = asArray(v as unknown);
          const isEmpty =
            !arr.length ||
            arr.every(
              (x) => x == null || x === "" || x === "—" || x === "N/A",
            );
          const isMulti = arr.length > 1;
          return (
            <div
              key={k}
              className={`bsd-dsec-row ${isEmpty ? "is-empty" : ""}`}
            >
              <div className="bsd-dsec-k">{k}</div>
              <div className="bsd-dsec-v">
                {isEmpty && "—"}
                {!isEmpty && !isMulti && String(arr[0])}
                {!isEmpty && isMulti && (
                  <div className="bsd-dsec-chips">
                    {arr.map((x, i) => (
                      <span key={i} className="bsd-dsec-chip">
                        {String(x)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DetailView({
  placement,
  partners,
  partnerColor,
  modal = false,
}: {
  placement: HydratedPlacement;
  partners: Partner[];
  partnerColor: string;
  modal?: boolean;
}): React.ReactElement | null {
  const p = partnerById(placement.partner, partners);
  const [copied, setCopied] = useState(false);

  if (!p) return null;

  function copySpec() {
    const fmt = (v: unknown): string =>
      Array.isArray(v) ? v.join(", ") : v == null ? "—" : String(v);
    const text = `${placement.name} — ${p!.name}
Dimensions: ${fmt(placement.dimensions)}
Format: ${fmt(placement.fileFormat)}
Max size: ${fmt(placement.maxFileSize)}
Headline: ${placement.headlineLimit ?? "—"}
CTA: ${placement.cta ?? "—"}
Due: ${dueDisplay(placement)}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const dims = asArray(placement.dimensions);
  const dueTone: "default" | "urgent" | "overdue" | "soon" | "safe" | "tbd" =
    placement.dueTBD ? "tbd" : urgencyOf(placement.creativeDue).key;

  const days = placement.creativeDue ? daysUntil(placement.creativeDue) : null;

  return (
    <div className={`bsd-detail ${modal ? "is-modal" : ""}`}>
      <div className="bsd-detail-head">
        <div>
          <div className="bsd-eyebrow" style={{ color: partnerColor }}>
            <span
              className="bsd-pdot"
              style={{ background: partnerColor, width: 8, height: 8 }}
            />
            {p.name}
          </div>
          <h2 className="bsd-detail-title">{placement.name}</h2>
          {(placement.adFormat || placement.adPlacement) && (
            <div className="bsd-detail-sub">
              {[placement.adFormat, placement.adPlacement]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
        </div>
        <div className="bsd-detail-actions">
          <button className="bsd-btn" onClick={copySpec}>
            {copied ? "✓ Copied" : "Copy spec"}
          </button>
          <button className="bsd-btn" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>

      <div className="bsd-detail-hero">
        <div className="bsd-detail-preview-col">
          <SpecPreview placement={placement} maxW={260} maxH={180} />
          <div className="bsd-detail-hero-meta">
            <div>
              <strong>
                {dims.length > 1
                  ? `${dims.length} sizes`
                  : primary(placement.dimensions) || "—"}
              </strong>
            </div>
            {placement.ratio && (
              <div>{asArray(placement.ratio).join(" · ")} aspect</div>
            )}
          </div>
        </div>
        <div className="bsd-detail-kpis">
          <Kpi
            label="Creative due"
            value={dueDisplay(placement)}
            sub={
              placement.creativeDue && days != null ? `in ${days} days` : null
            }
            tone={dueTone}
          />
          <Kpi
            label={dims.length > 1 ? "Sizes" : "Size"}
            value={
              dims.length > 1 ? (
                <div className="bsd-kpi-chips">
                  {dims.map((d, i) => (
                    <span key={i} className="bsd-kpi-chip">
                      {d}
                    </span>
                  ))}
                </div>
              ) : (
                primary(placement.dimensions) || "—"
              )
            }
            sub={
              dims.length > 1
                ? `${dims.length} sizes`
                : placement.ratio
                  ? `${primary(placement.ratio)} aspect`
                  : null
            }
          />
          <Kpi
            label="CTA"
            value={placement.cta || "—"}
            sub={
              placement.headlineLimit
                ? `Headline ${placement.headlineLimit}`
                : null
            }
          />
        </div>
      </div>

      <div className="bsd-detail-sections">
        <DetailSection
          title="Creative"
          items={[
            ["Ad Format", placement.adFormat],
            ["Creative Type", placement.creativeType],
            ["Dimensions", placement.dimensions],
            ["Aspect Ratio", placement.ratio],
            ["File Format", placement.fileFormat],
            ["Max File Size", placement.maxFileSize],
            ["Frame Rate", placement.frameRate],
            ["Bitrate", placement.bitrate],
            ["Audio", placement.audio],
            ["Animation", placement.animation],
            ["Backup Image", placement.backupImage],
          ]}
        />
        <DetailSection
          title="Copy"
          items={[
            ["Headline Limit", placement.headlineLimit],
            ["Description Limit", placement.descriptionLimit],
            ["CTA", placement.cta],
            ["Clickthrough URL", placement.clickthroughUrl],
            ["Font & Branding", placement.fontBranding],
          ]}
        />
        <DetailSection
          title="Delivery"
          items={[
            ["Partner", p.name],
            ["Flight Dates", placement.flightDatesRaw],
            ["Creative Due Date", dueDisplay(placement)],
            ["Market", placement.market],
            ["Who Builds", placement.whoBuilds],
            ["Ad Placement", placement.adPlacement],
          ]}
        />
        <DetailSection
          title="Compliance & Tracking"
          items={[
            ["3rd Party Ad Tags", placement.thirdPartyTags],
            ["Serving Type", placement.servingType],
            ["Site Served", placement.siteServed],
            ["Viewability", placement.viewability],
            ["GDPR / CCPA", placement.gdprCcpa],
            ["Tracking", placement.tracking],
            ["Adserving Allowed", placement.adservingAllowed],
            ["Approval Deadline", placement.creativeApprovalDeadline],
            ["Additional Info", placement.additionalInformation],
            ...Object.entries(placement.otherFields || {}),
          ]}
        />
      </div>
    </div>
  );
}
