import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase/client";
import { generateSheetCode } from "@/lib/spec-sheets/code-generator";
import { createSpecSheetSchema } from "@/lib/spec-sheets/schema";

const RATE_LIMIT_PER_HOUR = 10;

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSpecSheetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.format() }, { status: 400 });
  }

  const supabaseToken = await getToken({ template: "supabase" });
  const supabase = createSupabaseClient(supabaseToken ?? undefined);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("spec_sheets")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneHourAgo);

  if (countError) {
    console.error("spec_sheets rate limit count failed:", countError);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return NextResponse.json(
      { error: `Rate limit: max ${RATE_LIMIT_PER_HOUR} sheets per hour` },
      { status: 429 }
    );
  }

  const code = generateSheetCode();
  const { error: insertError } = await supabase.from("spec_sheets").insert({
    code,
    user_id: userId,
    campaign: parsed.data.campaign,
    client: parsed.data.client ?? null,
    placements: parsed.data.placements,
    partners: parsed.data.partners,
    summary: parsed.data.summary,
  });

  if (insertError) {
    console.error("spec_sheets insert failed:", insertError);
    return NextResponse.json({ error: "Failed to create sheet" }, { status: 500 });
  }

  return NextResponse.json({ code });
}

export async function GET() {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabaseToken = await getToken({ template: "supabase" });
  const supabase = createSupabaseClient(supabaseToken ?? undefined);

  const { data, error } = await supabase
    .from("spec_sheets")
    .select("code, campaign, client, created_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("spec_sheets list failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({
    sheets: (data ?? []).map((r) => ({
      code: r.code,
      campaign: r.campaign,
      client: r.client,
      createdAt: r.created_at,
    })),
  });
}
