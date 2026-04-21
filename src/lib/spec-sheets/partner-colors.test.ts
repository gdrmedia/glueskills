import { describe, expect, it } from "vitest";
import { colorFor, iconIdFor, FALLBACK } from "./partner-colors";

describe("colorFor / iconIdFor", () => {
  it("maps Meta variants to Meta color", () => {
    expect(colorFor("Meta")).toBe("#0866FF");
    expect(colorFor("META")).toBe("#0866FF");
    expect(colorFor("Facebook Ads")).toBe("#0866FF");
  });

  it("maps YouTube CTV vs OLV differently", () => {
    expect(iconIdFor("YouTube CTV")).toBe("youtubectv");
    expect(iconIdFor("YouTube OLV")).toBe("youtubeolv");
    expect(iconIdFor("YouTube")).toBe("youtubectv");
  });

  it("returns the fallback for unknown partners", () => {
    expect(colorFor("Acme Advertising Co")).toBe(FALLBACK.color);
    expect(iconIdFor("Acme Advertising Co")).toBe(FALLBACK.id);
  });

  it("returns the fallback for null/empty", () => {
    expect(colorFor(null)).toBe(FALLBACK.color);
    expect(colorFor("")).toBe(FALLBACK.color);
  });
});
