export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")        // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 60;

export function isValidSlug(value: string): boolean {
  if (typeof value !== "string") return false;
  if (value.length < 1 || value.length > MAX_SLUG_LENGTH) return false;
  return SLUG_RE.test(value);
}
