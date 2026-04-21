import { z } from "zod";

export const MAX_CAMPAIGN_LENGTH = 120;
export const MAX_CLIENT_LENGTH = 120;
export const MAX_PLACEMENTS = 500;

// Permissive: these objects are produced entirely by our own enrichment code.
// We validate shape-level invariants (non-empty, length caps) but not every field.
const placementSchema = z.object({
  id: z.string(),
  partner: z.string(),
  partnerName: z.string(),
  name: z.string(),
}).passthrough();

const partnerSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  iconId: z.string(),
});

const summarySchema = z.object({
  templateName: z.string(),
  client: z.string(),
  totalPlacements: z.number().int().nonnegative(),
  earliestDue: z.string().nullable(),
  period: z.string(),
});

export const createSpecSheetSchema = z.object({
  campaign: z.string().trim().min(1, "Campaign is required").max(MAX_CAMPAIGN_LENGTH),
  client: z.string().trim().max(MAX_CLIENT_LENGTH).nullable().optional(),
  placements: z.array(placementSchema).min(1).max(MAX_PLACEMENTS),
  partners: z.array(partnerSchema),
  summary: summarySchema,
});

export type CreateSpecSheetInput = z.infer<typeof createSpecSheetSchema>;
