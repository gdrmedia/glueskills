import { describe, expect, it } from "vitest";
import {
  enrichPlacements,
  buildPartners,
  buildSummary,
  splitMulti,
  parseLooseDate,
  parseFlightDates,
  normalizeAspectRatio,
} from "./enrich";
import type { ParsedPlacement } from "./parse-xlsx";

const base: ParsedPlacement = {
  partner: "Meta", flightDates: null, creativeDueDate: null, market: null,
  placementName: "Reels", description: null, adFormat: null, whoBuilds: null,
  siteServed: null, thirdPartyServingType: null, adPlacement: null, creativeType: null,
  adDimensions: null, fileFormat: null, maxFileSize: null, backupImage: null,
  aspectRatio: null, frameRate: null, bitrate: null, audioSpecs: null,
  animationLength: null, clickthroughUrl: null, adservingAllowed: null,
  trackingRequirements: null, headlineTextLimit: null, descriptionTextLimit: null,
  ctaRequirements: null, fontBranding: null, thirdPartyAdTags: null,
  viewabilityRequirements: null, gdprCcpaCompliance: null,
  creativeApprovalDeadline: null, additionalInformation: null, otherFields: {},
};

describe("splitMulti", () => {
  it("splits on newlines and semicolons", () => {
    expect(splitMulti("a\nb")).toEqual(["a", "b"]);
    expect(splitMulti("a; b; c")).toEqual(["a", "b", "c"]);
  });
  it("returns [] for null", () => {
    expect(splitMulti(null)).toEqual([]);
  });
});

describe("parseLooseDate", () => {
  it("parses '10-Dec' with fallback year", () => {
    const d = parseLooseDate("10-Dec", 2026);
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(11);
    expect(d?.getDate()).toBe(10);
  });
  it("parses '3/26/2026'", () => {
    const d = parseLooseDate("3/26/2026", 2026);
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(2);
    expect(d?.getDate()).toBe(26);
  });
  it("returns null for TBD", () => {
    expect(parseLooseDate("TBD Q1", 2026)).toBeNull();
  });
});

describe("parseFlightDates", () => {
  it("splits on hyphen", () => {
    const [start, end] = parseFlightDates("1/4-7/18", 2026);
    expect(start?.getMonth()).toBe(0);
    expect(end?.getMonth()).toBe(6);
  });
  it("returns [null, null] for TBD", () => {
    expect(parseFlightDates("TBD Q1", 2026)).toEqual([null, null]);
  });
});

describe("normalizeAspectRatio", () => {
  it("reduces dimension to ratio", () => {
    expect(normalizeAspectRatio("1920 × 1080")).toBe("16:9");
    expect(normalizeAspectRatio("1080 × 1080")).toBe("1:1");
  });
  it("passes through already-reduced ratios", () => {
    expect(normalizeAspectRatio("16:9")).toBe("16:9");
  });
});

describe("enrichPlacements", () => {
  it("slugs partner name and builds id", () => {
    const [p] = enrichPlacements([base], { year: 2026 });
    expect(p.partner).toBe("meta");
    expect(p.id).toBe("meta-0");
    expect(p.partnerName).toBe("Meta");
  });

  it("splits multi-value dimensions/formats/ratios/sizes", () => {
    const src: ParsedPlacement = {
      ...base,
      adDimensions: "1920 × 1080\n1080 × 1080",
      fileFormat: "JPG or PNG\nMP4",
      aspectRatio: "1920 × 1080\n1080 × 1080",
      maxFileSize: "1 GB: Video\n5 MB: Image",
    };
    const [p] = enrichPlacements([src], { year: 2026 });
    expect(p.dimensions).toEqual(["1920 × 1080", "1080 × 1080"]);
    expect(p.fileFormat).toEqual(["JPG or PNG", "MP4"]);
    expect(p.ratio).toEqual(["16:9", "1:1"]);
    expect(p.maxFileSize).toEqual(["1 GB: Video", "5 MB: Image"]);
  });

  it("returns single values (not arrays) when one entry", () => {
    const src: ParsedPlacement = { ...base, adDimensions: "1080 × 1920" };
    const [p] = enrichPlacements([src], { year: 2026 });
    expect(p.dimensions).toBe("1080 × 1920");
  });

  it("sets dueTBD when creativeDueDate is TBD-ish", () => {
    const src: ParsedPlacement = { ...base, creativeDueDate: "TBD" };
    const [p] = enrichPlacements([src], { year: 2026 });
    expect(p.dueTBD).toBe(true);
    expect(p.creativeDue).toBeNull();
  });
});

describe("buildPartners / buildSummary", () => {
  it("builds unique partner list with color + iconId", () => {
    const enriched = enrichPlacements(
      [{ ...base, partner: "Meta" }, { ...base, partner: "Reddit" }, { ...base, partner: "Meta" }],
      { year: 2026 }
    );
    const partners = buildPartners(enriched);
    expect(partners).toHaveLength(2);
    expect(partners[0].name).toBe("Meta");
    expect(partners[0].color).toBe("#0866FF");
  });

  it("builds summary with totalPlacements", () => {
    const enriched = enrichPlacements([{ ...base }, { ...base }], { year: 2026 });
    const summary = buildSummary(enriched, { campaign: "C1", client: "ACME" });
    expect(summary.totalPlacements).toBe(2);
    expect(summary.templateName).toBe("C1");
    expect(summary.client).toBe("ACME");
  });
});
