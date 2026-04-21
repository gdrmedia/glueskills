// src/lib/banner-jobs/format-countdown.test.ts
import { describe, expect, it } from "vitest";
import { formatCountdown } from "./format-countdown";

describe("formatCountdown", () => {
  it("formats hours and minutes when over an hour", () => {
    expect(formatCountdown(3 * 3600 * 1000 + 17 * 60 * 1000)).toBe("3h 17m");
  });

  it("formats minutes and seconds when under an hour", () => {
    expect(formatCountdown(45 * 60 * 1000 + 12 * 1000)).toBe("45m 12s");
  });

  it("formats just seconds when under a minute", () => {
    expect(formatCountdown(42 * 1000)).toBe("42s");
  });

  it("returns 'Expired' for zero or negative values", () => {
    expect(formatCountdown(0)).toBe("Expired");
    expect(formatCountdown(-1000)).toBe("Expired");
  });

  it("pads single-digit minutes/seconds when paired with a larger unit", () => {
    expect(formatCountdown(3600 * 1000 + 5 * 60 * 1000)).toBe("1h 05m");
    expect(formatCountdown(60 * 1000 + 7 * 1000)).toBe("1m 07s");
  });
});
