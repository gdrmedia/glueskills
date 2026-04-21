import { customAlphabet } from "nanoid";

export const SHEET_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const SHEET_CODE_LENGTH = 6;

const generator = customAlphabet(SHEET_CODE_ALPHABET, SHEET_CODE_LENGTH);

export function generateSheetCode(): string {
  return generator();
}
