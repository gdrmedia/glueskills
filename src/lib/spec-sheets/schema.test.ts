import { describe, expect, it } from "vitest";
import { createSpecSheetSchema, MAX_CAMPAIGN_LENGTH, MAX_CLIENT_LENGTH } from "./schema";

const validPlacement = { id: "meta-0", partner: "meta", partnerName: "Meta", name: "Reels", otherFields: {} };

describe("createSpecSheetSchema", () => {
  const base = {
    campaign: "Campaign A",
    client: "ACME",
    placements: [validPlacement],
    partners: [{ id: "meta", name: "Meta", color: "#0866FF", iconId: "meta" }],
    summary: { templateName: "Campaign A", client: "ACME", totalPlacements: 1, earliestDue: null, period: "" },
  };

  it("accepts a valid payload", () => {
    expect(() => createSpecSheetSchema.parse(base)).not.toThrow();
  });

  it("rejects empty campaign", () => {
    expect(() => createSpecSheetSchema.parse({ ...base, campaign: "" })).toThrow();
  });

  it("rejects overly long campaign", () => {
    expect(() =>
      createSpecSheetSchema.parse({ ...base, campaign: "x".repeat(MAX_CAMPAIGN_LENGTH + 1) })
    ).toThrow();
  });

  it("rejects overly long client", () => {
    expect(() =>
      createSpecSheetSchema.parse({ ...base, client: "x".repeat(MAX_CLIENT_LENGTH + 1) })
    ).toThrow();
  });

  it("allows null client", () => {
    expect(() => createSpecSheetSchema.parse({ ...base, client: null })).not.toThrow();
  });

  it("rejects zero placements", () => {
    expect(() => createSpecSheetSchema.parse({ ...base, placements: [] })).toThrow();
  });
});
