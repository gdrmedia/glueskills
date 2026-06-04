import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase/client";
import { makeSupabaseKickoffRepository } from "./repository.supabase";
import type { KickoffRepository } from "./repository";

export interface AuthedRepo {
  userId: string;
  repo: KickoffRepository;
}

/** Resolve the signed-in user's id + a token-scoped repository, or null if signed out. */
export async function getAuthedRepo(): Promise<AuthedRepo | null> {
  const { userId, getToken } = await auth();
  if (!userId) return null;
  const token = await getToken({ template: "supabase" });
  return {
    userId,
    repo: makeSupabaseKickoffRepository(createSupabaseClient(token ?? undefined)),
  };
}
