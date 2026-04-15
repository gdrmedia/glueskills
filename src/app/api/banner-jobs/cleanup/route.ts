import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/client";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The cleanup RPC is `security definer`, so it bypasses RLS and can purge
  // any user's expired rows. We call it via the anon client — the cron secret
  // above is what gates access, not Supabase auth.
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc("cleanup_banner_jobs");

  if (error) {
    console.error("cleanup_banner_jobs RPC failed:", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }

  return NextResponse.json(data);
}
