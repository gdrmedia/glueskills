import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase/client";
import { brandPackInputSchema } from "@/lib/brands/schema";

type RouteCtx = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { slug } = await params;
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("brand fetch failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

// Partial update at the top level only. Nested objects (palette, font,
// weights, images) must still be sent complete — Zod v4 .partial() does
// not recurse. The admin form always submits full nested objects, so
// this matches current usage; revisit if a field-level edit UI ships.
const brandPackPatchSchema = brandPackInputSchema.partial();

export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = brandPackPatchSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.success ? undefined : parsed.error.format() },
      { status: 400 }
    );
  }

  const supabaseToken = await getToken({ template: "supabase" });
  const supabase = createSupabaseClient(supabaseToken ?? undefined);

  const { error } = await supabase.from("brands").update(parsed.data).eq("slug", slug);

  if (error) {
    console.error("brand update failed:", error);
    return NextResponse.json({ error: "Failed to update brand" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;

  const supabaseToken = await getToken({ template: "supabase" });
  const supabase = createSupabaseClient(supabaseToken ?? undefined);

  const { error } = await supabase.from("brands").delete().eq("slug", slug);

  if (error) {
    console.error("brand delete failed:", error);
    return NextResponse.json({ error: "Failed to delete brand" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
