import { describe, expect, it } from "vitest";
import { bannerJobConfigSchema, jobNameSchema, MAX_TARGETS, MIN_DIMENSION, MAX_DIMENSION } from "./job-config";

describe("bannerJobConfigSchema", () => {
  const validConfig = {
    version: 1 as const,
    targets: [
      { width: 300, height: 250, label: "Medium Rectangle", isCustom: false },
      { width: 728, height: 90, isCustom: false },
    ],
    options: {
      placeOnNewPage: true,
      namingPattern: "size-job" as const,
    },
  };

  it("accepts a valid config", () => {
    expect(() => bannerJobConfigSchema.parse(validConfig)).not.toThrow();
  });

  it("rejects empty targets array", () => {
    expect(() => bannerJobConfigSchema.parse({ ...validConfig, targets: [] })).toThrow();
  });

  it(`rejects more than ${MAX_TARGETS} targets`, () => {
    const tooMany = Array.from({ length: MAX_TARGETS + 1 }, (_, i) => ({
      width: 100 + i,
      height: 100,
      isCustom: true,
    }));
    expect(() => bannerJobConfigSchema.parse({ ...validConfig, targets: tooMany })).toThrow();
  });

  it("rejects target dimensions below the minimum", () => {
    const tooSmall = { ...validConfig, targets: [{ width: MIN_DIMENSION - 1, height: 100, isCustom: true }] };
    expect(() => bannerJobConfigSchema.parse(tooSmall)).toThrow();
  });

  it("rejects target dimensions above the maximum", () => {
    const tooBig = { ...validConfig, targets: [{ width: MAX_DIMENSION + 1, height: 100, isCustom: true }] };
    expect(() => bannerJobConfigSchema.parse(tooBig)).toThrow();
  });

  it("rejects unknown namingPattern values", () => {
    const bad = { ...validConfig, options: { ...validConfig.options, namingPattern: "weird" } };
    expect(() => bannerJobConfigSchema.parse(bad)).toThrow();
  });

  it("rejects version != 1", () => {
    expect(() => bannerJobConfigSchema.parse({ ...validConfig, version: 2 })).toThrow();
  });

  it("rejects non-integer dimensions", () => {
    const fractional = { ...validConfig, targets: [{ width: 300.5, height: 250, isCustom: true }] };
    expect(() => bannerJobConfigSchema.parse(fractional)).toThrow();
  });
});

describe("jobNameSchema", () => {
  it("accepts a 1-80 char name", () => {
    expect(() => jobNameSchema.parse("Q2 Spring Campaign")).not.toThrow();
    expect(() => jobNameSchema.parse("X")).not.toThrow();
    expect(() => jobNameSchema.parse("X".repeat(80))).not.toThrow();
  });

  it("rejects empty / whitespace-only names", () => {
    expect(() => jobNameSchema.parse("")).toThrow();
    expect(() => jobNameSchema.parse("   ")).toThrow();
  });

  it("rejects names longer than 80 chars", () => {
    expect(() => jobNameSchema.parse("X".repeat(81))).toThrow();
  });
});
