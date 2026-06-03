import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedRepo } from "@/lib/project-kickoff/authed-repo";
import { applyTransition } from "@/lib/project-kickoff/status-machine";
import { isSubmittable, missingRequired } from "@/lib/project-kickoff/validation";
import { canApprove } from "@/lib/project-kickoff/config";
import type { KickoffUpdate } from "@/lib/project-kickoff/repository";

type Ctx = { params: Promise<{ id: string }> };
const bodySchema = z.object({ action: z.enum(["submit", "approve", "reopen"]) });

export async function POST(req: NextRequest, { params }: Ctx) {
  const ctx = await getAuthedRepo();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  try {
    const current = await ctx.repo.get(id);
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const result = applyTransition(parsed.data.action, {
      status: current.status,
      isApprover: canApprove(ctx.userId),
      requiredComplete: isSubmittable(current.deliverables, current.sections),
    });

    if (!result.ok) {
      if (result.code === "required_incomplete") {
        return NextResponse.json(
          { error: "Required fields incomplete", missing: missingRequired(current.deliverables, current.sections) },
          { status: 422 }
        );
      }
      if (result.code === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.json({ error: "Invalid transition" }, { status: 409 });
    }

    const now = new Date().toISOString();
    const patch: KickoffUpdate = { status: result.nextStatus, locked: result.locked };
    if (parsed.data.action === "submit") { patch.submitted_by = ctx.userId; patch.submitted_at = now; }
    if (parsed.data.action === "approve") { patch.approved_by = ctx.userId; patch.approved_at = now; }

    const fresh = await ctx.repo.update(id, patch);
    return NextResponse.json({ kickoff: fresh });
  } catch (e) {
    console.error("kickoff transition failed:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
