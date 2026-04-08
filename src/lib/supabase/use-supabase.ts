"use client";

import { useSession } from "@clerk/nextjs";
import { useMemo } from "react";
import { createSupabaseClient } from "./client";

export function useSupabase() {
  const { session } = useSession();

  return useMemo(() => {
    return {
      client: createSupabaseClient(),
      getClient: async () => {
        const token = await session?.getToken({ template: "supabase" });
        return createSupabaseClient(token ?? undefined);
      },
    };
  }, [session]);
}
