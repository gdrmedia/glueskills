import type { ParsedPlacement } from "./parse-xlsx";
import { colorFor, iconIdFor } from "./partner-colors";

export type EnrichedPlacement = {
  id: string;
  partner: string;
  partnerName: string;
  name: string;
  description: string | null;
  adFormat: string | null;
  creativeType: string | null;
  dimensions: string | string[] | null;
  ratio: string | string[] | null;
  fileFormat: string | string[] | null;
  maxFileSize: string | string[] | null;
  frameRate: string | null;
  bitrate: string | null;
  audio: string | null;
  animation: string | null;
  backupImage: string | null;
  headlineLimit: string | null;
  descriptionLimit: string | null;
  cta: string | null;
  clickthroughUrl: string | null;
  fontBranding: string | null;
  flightStart: string | null;
  flightEnd: string | null;
  flightDatesRaw: string | null;
  creativeDue: string | null;
  creativeDueRaw: string | number | Date | null;
  dueTBD: boolean;
  market: string | null;
  whoBuilds: string | null;
  adPlacement: string | null;
  thirdPartyTags: string | null;
  servingType: string | null;
  siteServed: string | null;
  viewability: string | null;
  gdprCcpa: string | null;
  tracking: string | null;
  adservingAllowed: string | null;
  creativeApprovalDeadline: string | null;
  additionalInformation: string | null;
  otherFields: Record<string, unknown>;
};

export type Partner = { id: string; name: string; color: string; iconId: string };

export type Summary = {
  templateName: string;
  client: string;
  totalPlacements: number;
  earliestDue: string | null;
  period: string;
};

export function splitMulti(v: unknown): string[] {
  if (v == null) return [];
  return String(v)
    .split(/\s*\n\s*|\s*;\s*/)
    .map(s => s.trim())
    .filter(Boolean);
}

function maybeSingle<T>(arr: T[]): T | T[] | null {
  if (!arr.length) return null;
  if (arr.length === 1) return arr[0];
  return arr;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

function excelSerialToDate(serial: number): Date {
  const utcDays = serial - 25569;
  return new Date(utcDays * 86400 * 1000);
}

export function parseLooseDate(s: unknown, fallbackYear?: number): Date | null {
  if (s == null) return null;
  if (s instanceof Date) return isNaN(s.getTime()) ? null : s;

  if (typeof s === "number") {
    if (s > 10000 && s < 100000) return excelSerialToDate(s);
    return null;
  }

  const str = String(s).trim();
  if (!str) return null;
  if (/^(tbd|tba|pending|n\/a)$/i.test(str) || /tbd|tba/i.test(str)) return null;

  if (/^\d{4,5}(\.\d+)?$/.test(str)) {
    const n = Number(str);
    if (n > 10000 && n < 100000) return excelSerialToDate(n);
  }

  const year = fallbackYear ?? new Date().getFullYear();

  const m1 = str.match(/^(\d{1,2})[-\s]+([A-Za-z]+)$/);
  if (m1) {
    const mon = MONTHS[m1[2].toLowerCase()];
    if (mon != null) return new Date(year, mon, Number(m1[1]));
  }
  const m2 = str.match(/^([A-Za-z]+)[-\s]+(\d{1,2})$/);
  if (m2) {
    const mon = MONTHS[m2[1].toLowerCase()];
    if (mon != null) return new Date(year, mon, Number(m2[2]));
  }

  const m3 = str.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m3) {
    const mo = Number(m3[1]) - 1;
    const day = Number(m3[2]);
    let yr = m3[3] ? Number(m3[3]) : year;
    if (yr < 100) yr += 2000;
    return new Date(yr, mo, day);
  }

  if (/[A-Za-z]{3,}/.test(str) && /[-\/\s]/.test(str)) {
    const direct = new Date(str);
    if (!isNaN(direct.getTime())) return direct;
  }
  if (/\d{4}/.test(str) && /[-\/]/.test(str)) {
    const direct = new Date(str);
    if (!isNaN(direct.getTime())) return direct;
  }

  return null;
}

export function parseFlightDates(s: unknown, fallbackYear?: number): [Date | null, Date | null] {
  if (s == null) return [null, null];
  const str = String(s);
  if (/tbd|tba/i.test(str)) return [null, null];
  const parts = str.split(/\s*[\u2013\u2014\-]\s*/);
  if (parts.length < 2) return [null, null];
  const start = parseLooseDate(parts[0], fallbackYear);
  const end = parseLooseDate(parts.slice(1).join("-"), fallbackYear);
  return [start, end];
}

function slug(s: unknown): string {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "") || "unknown";
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

export function normalizeAspectRatio(val: unknown): string | null {
  if (val == null) return null;
  const str = String(val).trim();
  if (!str) return null;
  const m = str.match(/^(\d+)\s*[×x]\s*(\d+)$/);
  if (!m) return str;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!w || !h) return str;
  const g = gcd(w, h);
  return `${w / g}:${h / g}`;
}

export function enrichPlacements(
  placements: ParsedPlacement[],
  opts: { year?: number } = {},
): EnrichedPlacement[] {
  return placements.map((p, i) => {
    const partnerKey = slug(p.partner);
    const dims = splitMulti(p.adDimensions);
    const formats = splitMulti(p.fileFormat);
    const sizes = splitMulti(p.maxFileSize);
    const ratios = splitMulti(p.aspectRatio).map(r => normalizeAspectRatio(r) ?? r);
    const creativeDue = parseLooseDate(p.creativeDueDate, opts.year);
    const dueTBD = !creativeDue;
    const [flightStart, flightEnd] = parseFlightDates(p.flightDates, opts.year);

    return {
      id: `${partnerKey}-${i}`,
      partner: partnerKey,
      partnerName: p.partner || "Unknown",
      name: p.placementName || "Untitled",
      description: p.description ?? null,
      adFormat: p.adFormat ?? null,
      creativeType: p.creativeType ?? null,
      dimensions: maybeSingle(dims),
      ratio: maybeSingle(ratios),
      fileFormat: maybeSingle(formats),
      maxFileSize: maybeSingle(sizes),
      frameRate: p.frameRate ?? null,
      bitrate: p.bitrate ?? null,
      audio: p.audioSpecs ?? null,
      animation: p.animationLength ?? null,
      backupImage: p.backupImage ?? null,
      headlineLimit: p.headlineTextLimit ?? null,
      descriptionLimit: p.descriptionTextLimit ?? null,
      cta: p.ctaRequirements ?? null,
      clickthroughUrl: p.clickthroughUrl ?? null,
      fontBranding: p.fontBranding ?? null,
      flightStart: flightStart ? flightStart.toISOString() : null,
      flightEnd: flightEnd ? flightEnd.toISOString() : null,
      flightDatesRaw: p.flightDates ?? null,
      creativeDue: creativeDue ? creativeDue.toISOString() : null,
      creativeDueRaw: p.creativeDueDate ?? null,
      dueTBD,
      market: p.market ?? null,
      whoBuilds: p.whoBuilds ?? null,
      adPlacement: p.adPlacement ?? null,
      thirdPartyTags: p.thirdPartyAdTags ?? null,
      servingType: p.thirdPartyServingType ?? null,
      siteServed: p.siteServed ?? null,
      viewability: p.viewabilityRequirements ?? null,
      gdprCcpa: p.gdprCcpaCompliance ?? null,
      tracking: p.trackingRequirements ?? null,
      adservingAllowed: p.adservingAllowed ?? null,
      creativeApprovalDeadline: p.creativeApprovalDeadline ?? null,
      additionalInformation: p.additionalInformation ?? null,
      otherFields: p.otherFields || {},
    };
  });
}

export function buildPartners(enriched: EnrichedPlacement[]): Partner[] {
  const seen = new Map<string, Partner>();
  for (const p of enriched) {
    if (seen.has(p.partner)) continue;
    seen.set(p.partner, {
      id: p.partner,
      name: p.partnerName,
      color: colorFor(p.partnerName),
      iconId: iconIdFor(p.partnerName),
    });
  }
  return [...seen.values()];
}

export function buildSummary(
  enriched: EnrichedPlacement[],
  { campaign, client }: { campaign: string; client?: string | null },
): Summary {
  const dues = enriched
    .map(p => p.creativeDue)
    .filter((d): d is string => Boolean(d))
    .map(s => new Date(s))
    .sort((a, b) => a.getTime() - b.getTime());
  return {
    templateName: campaign,
    client: client || "",
    totalPlacements: enriched.length,
    earliestDue: dues[0] ? dues[0].toISOString() : null,
    period: "",
  };
}
