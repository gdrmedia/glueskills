import { z } from "zod";

export const MAX_TARGETS = 20;
export const MIN_DIMENSION = 50;
export const MAX_DIMENSION = 4000;
export const MAX_JOB_NAME_LENGTH = 80;

export const jobNameSchema = z
  .string()
  .trim()
  .min(1, "Job name is required")
  .max(MAX_JOB_NAME_LENGTH, `Job name must be ${MAX_JOB_NAME_LENGTH} characters or fewer`);

const targetSchema = z.object({
  width: z.number().int().min(MIN_DIMENSION).max(MAX_DIMENSION),
  height: z.number().int().min(MIN_DIMENSION).max(MAX_DIMENSION),
  label: z.string().optional(),
  isCustom: z.boolean(),
});

const optionsSchema = z.object({
  placeOnNewPage: z.boolean(),
  namingPattern: z.enum(["size", "size-job", "size-source"]),
});

export const bannerJobConfigSchema = z.object({
  version: z.literal(1),
  targets: z.array(targetSchema).min(1).max(MAX_TARGETS),
  options: optionsSchema,
});

export type BannerJobConfig = z.infer<typeof bannerJobConfigSchema>;
export type BannerJobTarget = z.infer<typeof targetSchema>;
export type BannerJobOptions = z.infer<typeof optionsSchema>;
