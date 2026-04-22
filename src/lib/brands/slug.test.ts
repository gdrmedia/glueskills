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

  it("strips diacritics via NFKD normalization", () => {
    expect(toSlug("Café Déjà Vu")).toBe("cafe-deja-vu");
    expect(toSlug("Ñoño")).toBe("nono");
  });

  it("truncates to MAX_SLUG_LENGTH and produces round-trip-valid output", () => {
    const long = "The Extremely Long Official Company Name of Acme International Holdings LLC";
    const slug = toSlug(long);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
    expect(isValidSlug(slug)).toBe(true);
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
