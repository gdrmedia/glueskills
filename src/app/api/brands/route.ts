import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase/client";
import { brandPackInputSchema } from "@/lib/brands/schema";

const RATE_LIMIT_PER_HOUR = 30;

export async function GET() {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("brands")
    .select("slug, name, logo_primary_url")
    .order("name", { ascending: true });

  if (error) {
    console.error("brands list failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({
    brands: (data ?? []).map((r) => ({
      slug: r.slug,
      name: r.name,
      logo_primary_url: r.logo_primary_url,
    })),
  });
}

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

  const parsed = brandPackInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.format() },
      { status: 400 }
    );
  }

  const supabaseToken = await getToken({ template: "supabase" });
  const supabase = createSupabaseClient(supabaseToken ?? undefined);

  // Rate limit is global (not per-user): `brands` has no user_id column —
  // single-tenant admin posture. Revisit if roles/multi-tenancy land.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("brands")
    .select("*", { count: "exact", head: true })
    .gte("created_at", oneHourAgo);

  if (countError) {
    console.error("brands rate limit count failed:", countError);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return NextResponse.json(
      { error: `Rate limit: max ${RATE_LIMIT_PER_HOUR} brands per hour` },
      { status: 429 }
    );
  }

  const input = parsed.data;
  const { error: insertError } = await supabase.from("brands").insert({
    slug: input.slug,
    name: input.name,
    palette: input.palette,
    font: input.font,
    logo_primary_url: input.logo_primary_url,
    logo_alt_url: input.logo_alt_url ?? null,
    images: input.images ?? null,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: `Slug "${input.slug}" already exists` },
        { status: 409 }
      );
    }
    console.error("brands insert failed:", insertError);
    return NextResponse.json({ error: "Failed to create brand" }, { status: 500 });
  }

  return NextResponse.json({ slug: input.slug });
}
