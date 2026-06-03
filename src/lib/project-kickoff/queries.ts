"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Kickoff, KickoffSummary, Deliverables } from "./types";
import type { TransitionAction } from "./status-machine";
import type { SectionPatch } from "./merge";

async function jsonOrThrow(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error ?? res.statusText), { status: res.status, body });
  }
  return res.json();
}

export function useKickoffList(tab: "active" | "approved") {
  return useQuery({
    queryKey: ["kickoffs", tab],
    queryFn: async (): Promise<KickoffSummary[]> =>
      (await jsonOrThrow(await fetch(`/api/kickoffs?tab=${tab}`))).kickoffs,
    staleTime: 5 * 60 * 1000,
  });
}

export function useKickoff(id: string) {
  return useQuery({
    queryKey: ["kickoff", id],
    queryFn: async (): Promise<Kickoff> =>
      (await jsonOrThrow(await fetch(`/api/kickoffs/${id}`))).kickoff,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateKickoff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<string> =>
      (await jsonOrThrow(await fetch("/api/kickoffs", { method: "POST" }))).id,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kickoffs"] }),
  });
}

export type SavePayload =
  | { section: number; patch: SectionPatch }
  | { deliverables: Deliverables };

export function useSaveKickoff(id: string) {
  return useMutation({
    mutationFn: async (payload: SavePayload): Promise<{ updated_at: string; kickoff: Kickoff }> =>
      jsonOrThrow(await fetch(`/api/kickoffs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })),
  });
}

export function useKickoffTransition(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (action: TransitionAction): Promise<Kickoff> =>
      (await jsonOrThrow(await fetch(`/api/kickoffs/${id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }))).kickoff,
    onSuccess: (k) => {
      qc.setQueryData(["kickoff", id], k);
      qc.invalidateQueries({ queryKey: ["kickoffs"] });
    },
  });
}

export function useDeleteKickoff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => jsonOrThrow(await fetch(`/api/kickoffs/${id}`, { method: "DELETE" })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kickoffs"] }),
  });
}
