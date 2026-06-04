import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedRepo } from "@/lib/project-kickoff/authed-repo";
import { notifySectionOwner } from "@/lib/project-kickoff/notify";

type Ctx = { params: Promise<{ id: string }> };
const bodySchema = z.object({
  sectionId: z.number().int().min(1).max(7),
  message: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: Ctx) {
  const ctx = await getAuthedRepo();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid sectionId" }, { status: 400 });

  try {
    const kickoff = await ctx.repo.get(id);
    if (!kickoff) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const ownerId = kickoff.sections[String(parsed.data.sectionId)]?.owner;
    if (!ownerId) return NextResponse.json({ error: "No owner assigned" }, { status: 400 });

    // Awaited so the serverless function doesn't terminate mid-send, but notify
    // self-catches so this never throws and never affects the response.
    await notifySectionOwner({
      kickoff,
      sectionId: parsed.data.sectionId,
      ownerId,
      origin: new URL(req.url).origin,
      message: parsed.data.message,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("kickoff nudge failed:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
