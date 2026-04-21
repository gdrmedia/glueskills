import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase/client";

type RouteCtx = { params: Promise<{ code: string }> };

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { code } = await params;
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.rpc("get_spec_sheet", { sheet_code: code });

  if (error) {
    console.error("get_spec_sheet RPC failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;
  const supabaseToken = await getToken({ template: "supabase" });
  const supabase = createSupabaseClient(supabaseToken ?? undefined);

  const { error } = await supabase
    .from("spec_sheets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("code", code)
    .eq("user_id", userId);

  if (error) {
    console.error("spec_sheets delete failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
