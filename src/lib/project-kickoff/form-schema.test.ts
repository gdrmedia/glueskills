import { describe, it, expect } from "vitest";
import { KICKOFF_FORM } from "./form-schema";

describe("KICKOFF_FORM", () => {
  it("has 7 sections with ids 1..7", () => {
    expect(KICKOFF_FORM.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("marks §1,2,3,7 as always and §4,5,6 as deliverable-gated", () => {
    const always = KICKOFF_FORM.filter((s) => s.always).map((s) => s.id);
    expect(always).toEqual([1, 2, 3, 7]);
    const s4 = KICKOFF_FORM.find((s) => s.id === 4);
    const s5 = KICKOFF_FORM.find((s) => s.id === 5);
    const s6 = KICKOFF_FORM.find((s) => s.id === 6);
    expect(s4 && !s4.always ? s4.deliverable : undefined).toBe("case_study");
    expect(s5 && !s5.always ? s5.deliverable : undefined).toBe("social");
    expect(s6 && !s6.always ? s6.deliverable : undefined).toBe("award");
  });

  it("has globally-unique field keys", () => {
    const keys = KICKOFF_FORM.flatMap((s) => s.fields.map((f) => f.key));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("includes the production-spec fields on each deliverable section", () => {
    const keysOf = (id: number) =>
      KICKOFF_FORM.find((s) => s.id === id)!.fields.map((f) => f.key);

    expect(keysOf(4)).toEqual(
      expect.arrayContaining([
        "case_link_assets", "case_format_specs", "case_quantity", "case_delivery",
      ])
    );
    expect(keysOf(5)).toEqual(
      expect.arrayContaining([
        "social_link_assets", "social_format_specs", "social_quantity",
        "social_usage_context", "social_delivery",
      ])
    );
    expect(keysOf(6)).toEqual(
      expect.arrayContaining([
        "award_link_assets", "award_format_specs", "award_delivery",
      ])
    );

    // production-spec fields stay optional
    const specKeys = [
      "case_link_assets", "case_format_specs", "case_quantity", "case_delivery",
      "social_link_assets", "social_format_specs", "social_quantity",
      "social_usage_context", "social_delivery",
      "award_link_assets", "award_format_specs", "award_delivery",
    ];
    const required = KICKOFF_FORM.flatMap((s) =>
      s.fields.filter((f) => f.required).map((f) => f.key)
    );
    for (const k of specKeys) expect(required).not.toContain(k);
  });

  it("marks the known required fields", () => {
    const required = KICKOFF_FORM.flatMap((s) =>
      s.fields.filter((f) => f.required).map((f) => f.key)
    );
    expect(required).toContain("client_brand");
    expect(required).toContain("campaign_name");
    expect(required).toContain("social_platforms"); // §5 required
    expect(required).toContain("award_shows");      // §6 required
    expect(required).not.toContain("case_narrative"); // §4 has no required fields
  });
});
