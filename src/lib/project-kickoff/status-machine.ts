import type { KickoffStatus } from "./types";

export type TransitionAction = "submit" | "approve" | "reopen";

export interface TransitionContext {
  status: KickoffStatus;
  isApprover: boolean;
  requiredComplete: boolean;
}

export type TransitionCode = "ok" | "invalid_transition" | "forbidden" | "required_incomplete";

export interface TransitionResult {
  ok: boolean;
  code: TransitionCode;
  nextStatus?: KickoffStatus;
  locked?: boolean;
}

export function applyTransition(action: TransitionAction, ctx: TransitionContext): TransitionResult {
  switch (action) {
    case "submit":
      if (ctx.status !== "draft") return { ok: false, code: "invalid_transition" };
      if (!ctx.requiredComplete) return { ok: false, code: "required_incomplete" };
      return { ok: true, code: "ok", nextStatus: "under_review", locked: true };

    case "approve":
      if (ctx.status !== "under_review") return { ok: false, code: "invalid_transition" };
      if (!ctx.isApprover) return { ok: false, code: "forbidden" };
      return { ok: true, code: "ok", nextStatus: "approved", locked: true };

    case "reopen":
      if (ctx.status === "under_review") return { ok: true, code: "ok", nextStatus: "draft", locked: false };
      if (ctx.status === "approved") {
        if (!ctx.isApprover) return { ok: false, code: "forbidden" };
        return { ok: true, code: "ok", nextStatus: "draft", locked: false };
      }
      return { ok: false, code: "invalid_transition" };

    default:
      return { ok: false, code: "invalid_transition" };
  }
}
