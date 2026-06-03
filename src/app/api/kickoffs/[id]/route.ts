import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedRepo } from "@/lib/project-kickoff/authed-repo";
import { mergeSection } from "@/lib/project-kickoff/merge";
import type { KickoffUpdate } from "@/lib/project-kickoff/repository";

type Ctx = { params: Promise<{ id: string }> };

const sectionPatchSchema = z.object({
  answers: z.record(z.string(), z.string()).optional(),
  approval: z.enum(["yes", "no", "partial"]).nullable().optional(),
  approval_notes: z.string().optional(),
  owner: z.string().nullable().optional(),
  section_status: z.enum(["not_started", "in_progress", "done"]).optional(),
});

const patchSchema = z.object({
  section: z.number().int().min(1).max(7).optional(),
  patch: sectionPatchSchema.optional(),
  deliverables: z.object({
    case_study: z.boolean(), social: z.boolean(), award: z.boolean(),
  }).optional(),
}).refine((b) => (b.section === undefined) === (b.patch === undefined), {
  message: "section and patch must be provided together",
});

export async function GET(_req: NextRequest, { params }: Ctx) {
  const ctx = await getAuthedRepo();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const kickoff = await ctx.repo.get(id);
    if (!kickoff) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ kickoff });
  } catch (e) {
    console.error("kickoff get failed:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const ctx = await getAuthedRepo();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.format() }, { status: 400 });
  }

  try {
    const current = await ctx.repo.get(id);
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (current.locked) return NextResponse.json({ error: "Locked" }, { status: 403 });

    const update: KickoffUpdate = {};
    if (parsed.data.deliverables) update.deliverables = parsed.data.deliverables;
    if (parsed.data.section !== undefined && parsed.data.patch) {
      const now = new Date().toISOString();
      update.sections = mergeSection(current.sections, parsed.data.section, parsed.data.patch, ctx.userId, now);
      const campaign = parsed.data.patch.answers?.campaign_name;
      if (parsed.data.section === 1 && campaign !== undefined) {
        update.title = campaign.trim() || "Untitled brief";
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ updated_at: current.updated_at, kickoff: current });
    }

    const fresh = await ctx.repo.update(id, update);
    return NextResponse.json({ updated_at: fresh.updated_at, kickoff: fresh });
  } catch (e) {
    console.error("kickoff patch failed:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const ctx = await getAuthedRepo();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const current = await ctx.repo.get(id);
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (current.status !== "draft") return NextResponse.json({ error: "Only drafts can be deleted" }, { status: 409 });
    await ctx.repo.softDelete(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("kickoff delete failed:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
