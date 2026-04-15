import { customAlphabet } from "nanoid";

// 31 chars: A-Z minus I, O, L  +  2-9 (no 0, no 1)
export const JOB_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const JOB_CODE_LENGTH = 6;

const generator = customAlphabet(JOB_CODE_ALPHABET, JOB_CODE_LENGTH);

export function generateJobCode(): string {
  return generator();
}
