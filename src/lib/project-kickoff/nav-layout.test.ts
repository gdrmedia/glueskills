import { describe, it, expect } from "vitest";
import { navLayout } from "./nav-layout";
import type { Deliverables } from "./types";

const none: Deliverables = { case_study: false, social: false, award: false };

describe("navLayout", () => {
  it("partitions into lead (1-3), the three deliverables, and tail (Approvals)", () => {
    const { lead, deliverables, tail, total } = navLayout(none);
    expect(lead.map((r) => r.section.id)).toEqual([1, 2, 3]);
    expect(deliverables.map((d) => d.key)).toEqual(["case_study", "social", "award"]);
    expect(tail.map((r) => r.section.id)).toEqual([7]);
    expect(total).toBe(3);
  });

  it("numbers only active sections; inactive deliverables are null", () => {
    const { lead, deliverables, tail, activeOn, activeTotal } = navLayout(none);
    expect(lead.map((r) => r.number)).toEqual([1, 2, 3]);
    expect(deliverables.map((d) => d.number)).toEqual([null, null, null]);
    expect(tail.map((r) => r.number)).toEqual([4]); // Approvals right after 1-3
    expect(activeOn).toBe(0);
    expect(activeTotal).toBe(4);
  });

  it("worked example: only social on → Social=4, Approvals=5", () => {
    const { deliverables, tail, activeOn, activeTotal } = navLayout({ case_study: false, social: true, award: false });
    const social = deliverables.find((d) => d.key === "social")!;
    const caseStudy = deliverables.find((d) => d.key === "case_study")!;
    expect(social.active).toBe(true);
    expect(social.number).toBe(4);
    expect(caseStudy.number).toBeNull();
    expect(tail[0].number).toBe(5);
    expect(activeOn).toBe(1);
    expect(activeTotal).toBe(5);
  });

  it("all three on → 4,5,6 then Approvals=7", () => {
    const { deliverables, tail, activeOn, activeTotal, total } = navLayout({ case_study: true, social: true, award: true });
    expect(deliverables.map((d) => d.number)).toEqual([4, 5, 6]);
    expect(tail[0].number).toBe(7);
    expect(activeOn).toBe(3);
    expect(activeTotal).toBe(7);
    expect(total).toBe(3);
  });
});
