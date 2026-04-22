import { describe, expect, it } from "vitest";
import { toSlug, isValidSlug } from "./slug";

describe("toSlug", () => {
  it("lowercases, replaces whitespace with hyphens, strips junk", () => {
    expect(toSlug("ACME Corp")).toBe("acme-corp");
    expect(toSlug("  The   Big   Banana  ")).toBe("the-big-banana");
    expect(toSlug("Foo & Bar / Baz!")).toBe("foo-bar-baz");
  });

  it("collapses adjacent hyphens", () => {
    expect(toSlug("a -- b // c")).toBe("a-b-c");
  });

  it("returns '' for input that collapses to nothing", () => {
    expect(toSlug("   ---   ")).toBe("");
  });
});

describe("isValidSlug", () => {
  it("accepts lowercase kebab-case strings of length 1..60", () => {
    expect(isValidSlug("acme")).toBe(true);
    expect(isValidSlug("big-banana-co")).toBe(true);
  });

  it("rejects empty, uppercase, underscores, symbols, or leading/trailing hyphens", () => {
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("ACME")).toBe(false);
    expect(isValidSlug("acme_corp")).toBe(false);
    expect(isValidSlug("-acme")).toBe(false);
    expect(isValidSlug("acme-")).toBe(false);
    expect(isValidSlug("a".repeat(61))).toBe(false);
  });
});
