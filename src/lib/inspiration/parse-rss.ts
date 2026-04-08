import { XMLParser } from "fast-xml-parser";
import type { FeedItem } from "./sources";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
});

function extractMediaUrl(media: unknown): string | null {
  // Handle array of media:content (e.g. SiteInspire provides multiple sizes)
  if (Array.isArray(media)) {
    for (const entry of media) {
      const url = (entry as Record<string, string>)?.["@_url"];
      if (url) return url;
    }
    return null;
  }
  // Handle single media:content object
  if (media && typeof media === "object") {
    return (media as Record<string, string>)["@_url"] ?? null;
  }
  return null;
}

function extractEnclosureImage(enclosure: unknown): string | null {
  // Handle array of enclosures (e.g. Codrops has multiple video enclosures)
  if (Array.isArray(enclosure)) {
    for (const entry of enclosure) {
      const e = entry as Record<string, string>;
      if (e["@_url"] && e["@_type"]?.startsWith("image/")) return e["@_url"];
    }
    return null;
  }
  // Handle single enclosure
  if (enclosure && typeof enclosure === "object") {
    const e = enclosure as Record<string, string>;
    if (e["@_url"] && e["@_type"]?.startsWith("image/")) return e["@_url"];
  }
  return null;
}

function extractThumbnail(item: Record<string, unknown>): string | null {
  // 1. media:content or media:thumbnail (handles both single and array)
  const mediaUrl =
    extractMediaUrl(item["media:content"]) ??
    extractMediaUrl(item["media:thumbnail"]);
  if (mediaUrl) return mediaUrl;

  // 2. enclosure with image type (handles both single and array)
  const enclosureUrl = extractEnclosureImage(item["enclosure"]);
  if (enclosureUrl) return enclosureUrl;

  // 3. First <img src="..."> in content:encoded or description
  //    Check content:encoded FIRST — it typically has richer HTML with images,
  //    while description is often a plain-text summary.
  const contentEncoded = item["content:encoded"];
  const description = item["description"];
  const htmlSources = [contentEncoded, description];

  for (const html of htmlSources) {
    if (typeof html === "string") {
      const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch?.[1]) return imgMatch[1];
    }
  }

  return null;
}

function extractLink(item: Record<string, unknown>): string {
  // RSS 2.0: <link>text</link>
  if (typeof item["link"] === "string") return item["link"];

  // Atom: <link href="..." rel="alternate">
  const link = item["link"] as Record<string, string> | Record<string, string>[] | undefined;
  if (Array.isArray(link)) {
    const alt = link.find((l) => l["@_rel"] === "alternate");
    return alt?.["@_href"] ?? link[0]?.["@_href"] ?? "";
  }
  if (link && typeof link === "object") {
    return link["@_href"] ?? "";
  }

  return "";
}

export function parseRSS(xml: string, sourceId: string): FeedItem[] {
  const parsed = parser.parse(xml);

  // RSS 2.0
  const rssItems = parsed?.rss?.channel?.item;
  // Atom
  const atomEntries = parsed?.feed?.entry;

  const rawItems: Record<string, unknown>[] = rssItems ?? atomEntries ?? [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  return items.slice(0, 20).map((item) => {
    const rawDesc =
      (item["content:encoded"] as string) ??
      (item["description"] as string) ??
      null;
    // Strip HTML tags to get plain text for search
    const description = typeof rawDesc === "string"
      ? rawDesc.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 300)
      : null;

    return {
      title:
        typeof item["title"] === "string"
          ? item["title"]
          : (item["title"] as Record<string, string>)?.["#text"] ?? "Untitled",
      link: extractLink(item),
      thumbnail: extractThumbnail(item),
      description,
      pubDate:
        (item["pubDate"] as string) ??
        (item["published"] as string) ??
        (item["updated"] as string) ??
        null,
      source: sourceId,
    };
  });
}
