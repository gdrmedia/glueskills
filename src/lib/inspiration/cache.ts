import type { FeedItem } from "./sources";

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const cache = new Map<string, { data: FeedItem[]; fetchedAt: number }>();

export function getCachedFeed(sourceId: string): FeedItem[] | null {
  const entry = cache.get(sourceId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(sourceId);
    return null;
  }
  return entry.data;
}

export function setCachedFeed(sourceId: string, data: FeedItem[]): void {
  cache.set(sourceId, { data, fetchedAt: Date.now() });
}
