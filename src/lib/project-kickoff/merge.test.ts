import { describe, it, expect } from "vitest";
import { emptySectionData, mergeSection, allEmptySections } from "./merge";
import type { Sections } from "./types";

describe("mergeSection", () => {
  it("merges answers into the target section and stamps editor + time", () => {
    const before: Sections = { "2": emptySectionData() };
    const after = mergeSection(before, 2, { answers: { creative_idea: "Big idea" } }, "user_x", "2026-06-02T00:00:00Z");
    expect(after["2"].answers.creative_idea).toBe("Big idea");
    expect(after["2"].last_edited_by).toBe("user_x");
    expect(after["2"].last_edited_at).toBe("2026-06-02T00:00:00Z");
  });

  it("does not mutate the input", () => {
    const before: Sections = { "2": emptySectionData() };
    mergeSection(before, 2, { answers: { x: "y" } }, "user_x", "t");
    expect(before["2"].answers).toEqual({});
  });

  it("preserves sibling sections", () => {
    const before: Sections = { "1": { ...emptySectionData(), owner: "user_a" }, "2": emptySectionData() };
    const after = mergeSection(before, 2, { section_status: "done" }, "user_x", "t");
    expect(after["1"].owner).toBe("user_a");
    expect(after["2"].section_status).toBe("done");
  });

  it("creates the section if absent", () => {
    const after = mergeSection({}, 5, { approval: "partial" }, "user_x", "t");
    expect(after["5"].approval).toBe("partial");
  });

  it("merges answers additively (keeps prior keys)", () => {
    let s: Sections = { "1": emptySectionData() };
    s = mergeSection(s, 1, { answers: { a: "1" } }, "u", "t");
    s = mergeSection(s, 1, { answers: { b: "2" } }, "u", "t");
    expect(s["1"].answers).toEqual({ a: "1", b: "2" });
  });
});

describe("allEmptySections", () => {
  it("returns 7 empty sections keyed 1..7", () => {
    const s = allEmptySections();
    expect(Object.keys(s).sort()).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    expect(s["1"].section_status).toBe("not_started");
  });
});
