import { describe, it, expect } from "vitest";
import { applyTransition } from "./status-machine";

describe("applyTransition", () => {
  it("submit: draft → under_review when required complete, sets locked", () => {
    const r = applyTransition("submit", { status: "draft", isApprover: false, requiredComplete: true });
    expect(r).toMatchObject({ ok: true, nextStatus: "under_review", locked: true });
  });
  it("submit: blocked when required incomplete", () => {
    const r = applyTransition("submit", { status: "draft", isApprover: false, requiredComplete: false });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("required_incomplete");
  });
  it("submit: only from draft", () => {
    expect(applyTransition("submit", { status: "approved", isApprover: false, requiredComplete: true }).ok).toBe(false);
  });

  it("approve: under_review → approved only for approver", () => {
    expect(applyTransition("approve", { status: "under_review", isApprover: true, requiredComplete: true }))
      .toMatchObject({ ok: true, nextStatus: "approved", locked: true });
    const denied = applyTransition("approve", { status: "under_review", isApprover: false, requiredComplete: true });
    expect(denied.ok).toBe(false);
    expect(denied.code).toBe("forbidden");
  });

  it("reopen: under_review → draft for any user, clears lock", () => {
    expect(applyTransition("reopen", { status: "under_review", isApprover: false, requiredComplete: true }))
      .toMatchObject({ ok: true, nextStatus: "draft", locked: false });
  });
  it("reopen: approved → draft only for approver", () => {
    expect(applyTransition("reopen", { status: "approved", isApprover: true, requiredComplete: true }))
      .toMatchObject({ ok: true, nextStatus: "draft", locked: false });
    expect(applyTransition("reopen", { status: "approved", isApprover: false, requiredComplete: true }).code)
      .toBe("forbidden");
  });
  it("reopen: invalid from draft", () => {
    expect(applyTransition("reopen", { status: "draft", isApprover: true, requiredComplete: true }).ok).toBe(false);
  });
});
