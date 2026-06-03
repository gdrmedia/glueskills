import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase/client";
import { makeSupabaseKickoffRepository } from "@/lib/project-kickoff/repository.supabase";
import type { ListTab } from "@/lib/project-kickoff/repository";

async function authedRepo() {
  const { userId, getToken } = await auth();
  if (!userId) return null;
  const token = await getToken({ template: "supabase" });
  return { userId, repo: makeSupabaseKickoffRepository(createSupabaseClient(token ?? undefined)) };
}

export async function GET(req: NextRequest) {
  const ctx = await authedRepo();
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
  const ctx = await authedRepo();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const id = await ctx.repo.create(ctx.userId);
    return NextResponse.json({ id });
  } catch (e) {
    console.error("kickoff create failed:", e);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
