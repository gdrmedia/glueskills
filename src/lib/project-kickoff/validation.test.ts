import { describe, it, expect } from "vitest";
import { activeSections, missingRequired, isSubmittable, progressOf } from "./validation";
import type { Deliverables, Sections } from "./types";

const noDeliverables: Deliverables = { case_study: false, social: false, award: false };

function emptySections(): Sections {
  const s: Sections = {};
  for (const id of [1, 2, 3, 4, 5, 6, 7]) {
    s[String(id)] = {
      answers: {}, approval: null, approval_notes: "",
      owner: null, section_status: "not_started",
      last_edited_by: null, last_edited_at: null,
    };
  }
  return s;
}

describe("activeSections", () => {
  it("returns §1,2,3,7 when no deliverables selected", () => {
    expect(activeSections(noDeliverables).map((s) => s.id)).toEqual([1, 2, 3, 7]);
  });
  it("includes §4 when case_study is selected", () => {
    const ids = activeSections({ ...noDeliverables, case_study: true }).map((s) => s.id);
    expect(ids).toEqual([1, 2, 3, 4, 7]);
  });
  it("includes §5 for social and §6 for award", () => {
    expect(activeSections({ case_study: false, social: true, award: false }).map((s) => s.id)).toEqual([1, 2, 3, 5, 7]);
    expect(activeSections({ case_study: false, social: false, award: true }).map((s) => s.id)).toEqual([1, 2, 3, 6, 7]);
  });
});

describe("missingRequired", () => {
  it("lists every empty required field in active sections", () => {
    const missing = missingRequired(noDeliverables, emptySections());
    const keys = missing.map((m) => m.key);
    expect(keys).toContain("client_brand"); // §1
    expect(keys).not.toContain("social_platforms"); // §5 inactive
    expect(isSubmittable(noDeliverables, emptySections())).toBe(false);
  });

  it("is submittable when all active required fields are filled", () => {
    const s = emptySections();
    for (const id of [1, 2, 3, 7]) {
      s[String(id)].answers = {
        client_brand: "x", campaign_name: "x", industry: "x", campaign_summary: "x",
        business_problem: "x", creative_idea: "x", result_business: "x",
        result_audience: "x", approver_internal: "x", approver_client: "x",
      };
    }
    expect(missingRequired(noDeliverables, s)).toEqual([]);
    expect(isSubmittable(noDeliverables, s)).toBe(true);
  });

  it("treats whitespace-only answers as empty", () => {
    const s = emptySections();
    s["1"].answers.client_brand = "   ";
    expect(missingRequired(noDeliverables, s).some((m) => m.key === "client_brand")).toBe(true);
  });
});

describe("progressOf", () => {
  it("counts done sections out of active sections", () => {
    const s = emptySections();
    s["1"].section_status = "done";
    expect(progressOf(noDeliverables, s)).toEqual({ done: 1, total: 4 });
  });
});
