import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { INSPIRATION_SOURCES } from "@/lib/inspiration/sources";
import { parseRSS } from "@/lib/inspiration/parse-rss";
import { getCachedFeed, setCachedFeed } from "@/lib/inspiration/cache";
import type { FeedItem } from "@/lib/inspiration/sources";

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "GlueSkills/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    ) ?? html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
    );
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function backfillThumbnails(items: FeedItem[]): Promise<FeedItem[]> {
  const needsBackfill = items.some((item) => !item.thumbnail);
  if (!needsBackfill) return items;

  const results = await Promise.allSettled(
    items.map(async (item) => {
      if (item.thumbnail || !item.link) return item;
      const ogImage = await fetchOgImage(item.link);
      return ogImage ? { ...item, thumbnail: ogImage } : item;
    })
  );

  return results.map((r, i) => (r.status === "fulfilled" ? r.value : items[i]));
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sourceId = req.nextUrl.searchParams.get("source");
  const source = INSPIRATION_SOURCES.find((s) => s.id === sourceId);

  if (!source) {
    return NextResponse.json(
      { error: "Invalid source" },
      { status: 400 }
    );
  }

  // Check server-side cache
  const cached = getCachedFeed(source.id);
  if (cached) {
    return NextResponse.json(
      { source: source.id, items: cached },
      {
        headers: { "Cache-Control": "public, s-maxage=300" },
      }
    );
  }

  try {
    const res = await fetch(source.feedUrl, {
      headers: {
        "User-Agent": "GlueSkills/1.0",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { source: source.id, items: [], error: `Feed returned ${res.status}` },
        { status: 200 } // graceful degradation — don't fail the client
      );
    }

    const xml = await res.text();
    let items = parseRSS(xml, source.id);

    // For feeds without thumbnails (e.g. Codrops), scrape OG images from article pages
    items = await backfillThumbnails(items);

    setCachedFeed(source.id, items);

    return NextResponse.json(
      { source: source.id, items },
      {
        headers: { "Cache-Control": "public, s-maxage=300" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch feed";
    return NextResponse.json(
      { source: source.id, items: [], error: message },
      { status: 200 } // graceful degradation
    );
  }
}
