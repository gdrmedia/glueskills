// src/lib/banner-jobs/iab-sizes.test.ts
import { describe, expect, it } from "vitest";
import { IAB_SIZES, IAB_GROUPS } from "./iab-sizes";

describe("IAB_SIZES", () => {
  it("contains all 14 standard IAB sizes from the spec", () => {
    expect(IAB_SIZES).toHaveLength(14);
  });

  it("includes the Medium Rectangle (300x250)", () => {
    const mediumRect = IAB_SIZES.find((s) => s.width === 300 && s.height === 250);
    expect(mediumRect).toBeDefined();
    expect(mediumRect?.label).toBe("Medium Rectangle");
    expect(mediumRect?.group).toBe("desktop");
  });

  it("includes the Mobile Banner (320x50)", () => {
    const mobile = IAB_SIZES.find((s) => s.width === 320 && s.height === 50);
    expect(mobile?.group).toBe("mobile");
  });

  it("has all sizes with positive dimensions and a non-empty label", () => {
    for (const size of IAB_SIZES) {
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
      expect(size.label.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate sizes", () => {
    const keys = IAB_SIZES.map((s) => `${s.width}x${s.height}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("IAB_GROUPS", () => {
  it("has exactly the three groups: desktop, mobile, square", () => {
    expect(Object.keys(IAB_GROUPS).sort()).toEqual(["desktop", "mobile", "square"]);
  });
});
