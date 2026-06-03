import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { approverIds, canApprove } from "./config";

const ORIG = process.env.KICKOFF_APPROVER_IDS;
afterEach(() => { process.env.KICKOFF_APPROVER_IDS = ORIG; });

describe("config", () => {
  it("parses a comma-separated list, trimming blanks", () => {
    process.env.KICKOFF_APPROVER_IDS = " user_a , user_b ,";
    expect(approverIds()).toEqual(["user_a", "user_b"]);
  });

  it("canApprove is true only for listed ids", () => {
    process.env.KICKOFF_APPROVER_IDS = "user_a";
    expect(canApprove("user_a")).toBe(true);
    expect(canApprove("user_b")).toBe(false);
    expect(canApprove(null)).toBe(false);
  });

  it("returns empty list when unset", () => {
    delete process.env.KICKOFF_APPROVER_IDS;
    expect(approverIds()).toEqual([]);
    expect(canApprove("user_a")).toBe(false);
  });
});
