import { describe, expect, it } from "vitest";
import { generateSheetCode, SHEET_CODE_ALPHABET, SHEET_CODE_LENGTH } from "./code-generator";

describe("generateSheetCode", () => {
  it("returns a string of length 6", () => {
    expect(generateSheetCode()).toHaveLength(SHEET_CODE_LENGTH);
    expect(SHEET_CODE_LENGTH).toBe(6);
  });

  it("only uses characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateSheetCode();
      for (const char of code) expect(SHEET_CODE_ALPHABET).toContain(char);
    }
  });

  it("excludes ambiguous characters (0, O, I, 1, L)", () => {
    for (const banned of ["0", "O", "I", "1", "L"]) {
      expect(SHEET_CODE_ALPHABET).not.toContain(banned);
    }
  });

  it("produces low collision rate over 5,000 codes", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 5000; i++) codes.add(generateSheetCode());
    expect(codes.size).toBeGreaterThanOrEqual(4999);
  });
});
