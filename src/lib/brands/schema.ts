import { z } from "zod";
import { MAX_SLUG_LENGTH } from "./slug";

export const MAX_BRAND_NAME_LENGTH = 80;
export const MAX_IMAGES = 5;

const hex = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex color");

const slugSchema = z
  .string()
  .min(1)
  .max(MAX_SLUG_LENGTH)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Must be lowercase kebab-case");

const paletteSchema = z
  .object({
    primary: hex,
    secondary: hex,
    accent: hex.optional(),
    neutral: hex.optional(),
  })
  .strict();

const fontSchema = z
  .object({
    family: z.string().trim().min(1).max(80),
    fallback: z.string().trim().min(1).max(80),
    weights: z
      .object({
        bold: z.string().trim().min(1).max(60),
        semi: z.string().trim().min(1).max(60),
        regular: z.string().trim().min(1).max(60),
      })
      .strict(),
  })
  .strict();

const imageSchema = z
  .object({
    url: z.string().url(),
    label: z.string().trim().max(80).optional(),
    sort_order: z.number().int().min(0).max(MAX_IMAGES - 1),
  })
  .strict();

export const brandPackInputSchema = z
  .object({
    slug: slugSchema,
    name: z.string().trim().min(1).max(MAX_BRAND_NAME_LENGTH),
    palette: paletteSchema,
    font: fontSchema,
    logo_primary_url: z.string().url().min(1),
    logo_alt_url: z.string().url().nullable().optional(),
    images: z.array(imageSchema).max(MAX_IMAGES).nullable().optional(),
  })
  .strict();

export type BrandPackInput = z.infer<typeof brandPackInputSchema>;
export type BrandPalette = z.infer<typeof paletteSchema>;
export type BrandFont = z.infer<typeof fontSchema>;
export type BrandImage = z.infer<typeof imageSchema>;

/**
 * Canonical BrandPack shape (matches the `brands` row + the plugin type).
 */
export type BrandPack = BrandPackInput & {
  id: string;
  created_at: string;
  updated_at: string;
};
