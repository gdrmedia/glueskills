import type { SupabaseClient } from "@supabase/supabase-js";
import type { Kickoff, KickoffSummary } from "./types";
import type { KickoffRepository, KickoffUpdate, ListTab } from "./repository";
import { allEmptySections } from "./merge";
import { progressOf } from "./validation";

const TABLE = "project_kickoffs";

type Row = Omit<Kickoff, never>; // DB row has the same field names as Kickoff
type SummaryRow = Pick<Kickoff, "id" | "title" | "status" | "deliverables" | "sections" | "updated_at">;

function rowToKickoff(r: Row): Kickoff {
  return {
    id: r.id, title: r.title, status: r.status, locked: r.locked,
    deliverables: r.deliverables, sections: r.sections ?? {},
    created_by: r.created_by,
    submitted_by: r.submitted_by, submitted_at: r.submitted_at,
    approved_by: r.approved_by, approved_at: r.approved_at,
    created_at: r.created_at, updated_at: r.updated_at,
  };
}

export function makeSupabaseKickoffRepository(client: SupabaseClient): KickoffRepository {
  return {
    async list(tab: ListTab): Promise<KickoffSummary[]> {
      const statuses = tab === "approved" ? ["approved"] : ["draft", "under_review"];
      const { data, error } = await client
        .from(TABLE)
        .select("id, title, status, deliverables, sections, updated_at")
        .in("status", statuses)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as SummaryRow[]).map((r) => ({
        id: r.id, title: r.title, status: r.status,
        deliverables: r.deliverables, updated_at: r.updated_at,
        progress: progressOf(r.deliverables, r.sections ?? {}),
      }));
    },

    async get(id: string): Promise<Kickoff | null> {
      const { data, error } = await client
        .from(TABLE).select("*").eq("id", id).is("deleted_at", null).single();
      if (error) {
        if (error.code === "PGRST116") return null; // no rows
        throw error;
      }
      return rowToKickoff(data as Row);
    },

    async create(createdBy: string): Promise<string> {
      const { data, error } = await client
        .from(TABLE)
        .insert({ created_by: createdBy, sections: allEmptySections() })
        .select("id").single();
      if (error) throw error;
      return (data as { id: string }).id;
    },

    async update(id: string, patch: KickoffUpdate): Promise<Kickoff> {
      const { data, error } = await client
        .from(TABLE).update(patch).eq("id", id).select("*").single();
      if (error) throw error;
      return rowToKickoff(data as Row);
    },

    async softDelete(id: string): Promise<void> {
      const { error } = await client
        .from(TABLE).update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
  };
}
