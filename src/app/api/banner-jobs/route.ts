// src/app/api/banner-jobs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase/client";
import { generateJobCode } from "@/lib/banner-jobs/code-generator";
import { bannerJobConfigSchema, jobNameSchema } from "@/lib/banner-jobs/job-config";

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

  const { name, config } = (body ?? {}) as { name?: unknown; config?: unknown };

  const nameResult = jobNameSchema.safeParse(name);
  if (!nameResult.success) {
    return NextResponse.json({ error: "Invalid name", issues: nameResult.error.format() }, { status: 400 });
  }
  const configResult = bannerJobConfigSchema.safeParse(config);
  if (!configResult.success) {
    return NextResponse.json({ error: "Invalid config", issues: configResult.error.format() }, { status: 400 });
  }

  // Use Clerk's Supabase JWT so RLS sees the user_id claim and allows the insert.
  const supabaseToken = await getToken({ template: "supabase" });
  const supabase = createSupabaseClient(supabaseToken ?? undefined);

  // Rate limit: 10 jobs per user per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("banner_jobs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneHourAgo);

  if (countError) {
    console.error("rate limit count failed:", countError);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return NextResponse.json(
      { error: `Rate limit: max ${RATE_LIMIT_PER_HOUR} jobs per hour` },
      { status: 429 }
    );
  }

  const code = generateJobCode();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error: insertError } = await supabase.from("banner_jobs").insert({
    code,
    user_id: userId,
    name: nameResult.data,
    config: configResult.data,
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error("banner_jobs insert failed:", insertError);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }

  return NextResponse.json({ code, expiresAt });
}
