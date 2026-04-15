import { describe, expect, it } from "vitest";
import { generateJobCode, JOB_CODE_ALPHABET, JOB_CODE_LENGTH } from "./code-generator";

describe("generateJobCode", () => {
  it(`returns a string of length ${6}`, () => {
    const code = generateJobCode();
    expect(code).toHaveLength(JOB_CODE_LENGTH);
    expect(JOB_CODE_LENGTH).toBe(6);
  });

  it("only uses characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateJobCode();
      for (const char of code) {
        expect(JOB_CODE_ALPHABET).toContain(char);
      }
    }
  });

  it("never includes ambiguous characters (0, O, I, 1, l)", () => {
    for (const banned of ["0", "O", "I", "1", "L"]) {
      expect(JOB_CODE_ALPHABET).not.toContain(banned);
    }
  });

  it("returns uppercase only", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateJobCode();
      expect(code).toBe(code.toUpperCase());
    }
  });

  it("produces low collision rate over 5,000 codes", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      codes.add(generateJobCode());
    }
    // With 30^6 = ~729M possibilities, 5000 codes should have ~0 collisions
    expect(codes.size).toBeGreaterThanOrEqual(4999);
  });
});
