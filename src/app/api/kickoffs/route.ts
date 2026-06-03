import { NextRequest, NextResponse } from "next/server";
import { getAuthedRepo } from "@/lib/project-kickoff/authed-repo";
import type { ListTab } from "@/lib/project-kickoff/repository";

export async function GET(req: NextRequest) {
  const ctx = await getAuthedRepo();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const raw = new URL(req.url).searchParams.get("tab");
  const tab: ListTab = raw === "approved" ? "approved" : "active";
  try {
    const kickoffs = await ctx.repo.list(tab);
    return NextResponse.json({ kickoffs });
  } catch (e) {
    console.error("kickoffs list failed:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST() {
  const ctx = await getAuthedRepo();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const id = await ctx.repo.create(ctx.userId);
    return NextResponse.json({ id });
  } catch (e) {
    console.error("kickoff create failed:", e);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
