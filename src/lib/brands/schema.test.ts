import { describe, expect, it } from "vitest";
import { brandPackInputSchema } from "./schema";

const valid = {
  slug: "acme",
  name: "ACME",
  palette: { primary: "#ff0000", secondary: "#00ff00" },
  font: {
    family: "Inter",
    fallback: "Arial",
    weights: { bold: "Bold", semi: "Semi Bold", regular: "Regular" },
  },
  logo_primary_url: "https://example.com/p.png",
  logo_alt_url: null,
  images: null,
};

describe("brandPackInputSchema", () => {
  it("accepts a minimal valid record", () => {
    expect(brandPackInputSchema.safeParse(valid).success).toBe(true);
  });

  it("requires primary and secondary hex colors", () => {
    const bad = { ...valid, palette: { primary: "red", secondary: "#00ff00" } };
    expect(brandPackInputSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts 3-digit and 6-digit hex", () => {
    const ok = { ...valid, palette: { primary: "#f00", secondary: "#00ff00" } };
    expect(brandPackInputSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects unknown palette keys", () => {
    const bad = {
      ...valid,
      palette: { primary: "#f00", secondary: "#0f0", wild: "#000" },
    };
    expect(brandPackInputSchema.safeParse(bad).success).toBe(false);
  });

  it("requires a valid slug", () => {
    expect(brandPackInputSchema.safeParse({ ...valid, slug: "ACME" }).success).toBe(false);
    expect(brandPackInputSchema.safeParse({ ...valid, slug: "" }).success).toBe(false);
  });

  it("caps images at 5 entries", () => {
    const images = Array.from({ length: 6 }, (_, i) => ({
      url: `https://x/${i}.png`,
      sort_order: i,
    }));
    expect(brandPackInputSchema.safeParse({ ...valid, images }).success).toBe(false);
  });

  it("requires logo_primary_url", () => {
    const bad = { ...valid, logo_primary_url: "" };
    expect(brandPackInputSchema.safeParse(bad).success).toBe(false);
  });
});
