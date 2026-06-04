import { describe, it, expect } from "vitest";
import { mergeKickoffTabs } from "./merge-tabs";
import type { KickoffSummary } from "./types";

function brief(id: string, updated_at: string, status: KickoffSummary["status"] = "draft"): KickoffSummary {
  return {
    id, title: id, status,
    deliverables: { case_study: false, social: false, award: false },
    progress: { done: 0, total: 1 },
    updated_at,
  };
}

describe("mergeKickoffTabs", () => {
  it("dedupes a brief that appears in two tab lists", () => {
    const a = brief("x", "2026-06-04T10:00:00Z", "draft");
    const b = brief("x", "2026-06-04T11:00:00Z", "under_review");
    const out = mergeKickoffTabs([a], [b], []);
    expect(out).toHaveLength(1);
    expect(out.map((k) => k.id)).toEqual(["x"]);
  });

  it("keeps the freshest entry on collision (latest updated_at), regardless of list order", () => {
    const stale = brief("x", "2026-06-04T10:00:00Z", "draft");
    const fresh = brief("x", "2026-06-04T11:00:00Z", "under_review");
    expect(mergeKickoffTabs([stale], [fresh], [])[0].status).toBe("under_review");
    expect(mergeKickoffTabs([fresh], [stale], [])[0].status).toBe("under_review");
  });

  it("sorts by updated_at descending", () => {
    const out = mergeKickoffTabs(
      [brief("a", "2026-06-01T00:00:00Z")],
      [brief("b", "2026-06-03T00:00:00Z")],
      [brief("c", "2026-06-02T00:00:00Z")],
    );
    expect(out.map((k) => k.id)).toEqual(["b", "c", "a"]);
  });

  it("produces unique ids across all three lists", () => {
    const out = mergeKickoffTabs(
      [brief("x", "2026-06-04T10:00:00Z")],
      [brief("x", "2026-06-04T10:00:00Z"), brief("y", "2026-06-04T09:00:00Z")],
      [brief("x", "2026-06-04T08:00:00Z"), brief("z", "2026-06-04T07:00:00Z")],
    );
    const ids = out.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(new Set(["x", "y", "z"]));
  });

  it("handles empty lists", () => {
    expect(mergeKickoffTabs([], [], [])).toEqual([]);
  });
});
