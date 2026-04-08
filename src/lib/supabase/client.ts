import { createClient } from "@supabase/supabase-js";

export function createSupabaseClient(supabaseToken?: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    supabaseToken
      ? {
          global: {
            headers: { Authorization: `Bearer ${supabaseToken}` },
          },
        }
      : undefined
  );
}
