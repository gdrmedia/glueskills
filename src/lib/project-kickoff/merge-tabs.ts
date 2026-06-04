import type { KickoffSummary } from "./types";

/**
 * Merge the three list-tab results for the "All briefs" view into one list,
 * deduped by id (keeping the freshest entry by updated_at) and sorted by
 * updated_at descending. Dedup matters: the three tab queries refetch
 * independently after a status change, so the same brief can momentarily appear
 * in two of them — without dedup that yields duplicate React keys.
 */
export function mergeKickoffTabs(...lists: KickoffSummary[][]): KickoffSummary[] {
  const byId = new Map<string, KickoffSummary>();
  for (const list of lists) {
    for (const k of list) {
      const existing = byId.get(k.id);
      if (!existing || k.updated_at > existing.updated_at) byId.set(k.id, k);
    }
  }
  return [...byId.values()].sort((a, b) =>
    a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0
  );
}
