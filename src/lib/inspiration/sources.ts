export type InspirationSource = {
  id: string;
  name: string;
  feedUrl: string;
  siteUrl: string;
  color: string;
  colorBg: string;
};

export type FeedItem = {
  title: string;
  link: string;
  thumbnail: string | null;
  description: string | null;
  pubDate: string | null;
  source: string;
};

export const INSPIRATION_SOURCES: InspirationSource[] = [
  {
    id: "awwwards",
    name: "Awwwards",
    feedUrl: "https://www.awwwards.com/blog/feed/",
    siteUrl: "https://www.awwwards.com",
    color: "text-yellow-500",
    colorBg: "bg-yellow-500",
  },
  {
    id: "codrops",
    name: "Codrops",
    feedUrl: "https://tympanus.net/codrops/feed/",
    siteUrl: "https://tympanus.net/codrops",
    color: "text-pink-500",
    colorBg: "bg-pink-500",
  },
  {
    id: "onepagelove",
    name: "One Page Love",
    feedUrl: "https://onepagelove.com/feed",
    siteUrl: "https://onepagelove.com",
    color: "text-sky-500",
    colorBg: "bg-sky-500",
  },
  {
    id: "behance",
    name: "Behance",
    feedUrl: "https://www.behance.net/feeds/projects",
    siteUrl: "https://www.behance.net",
    color: "text-blue-500",
    colorBg: "bg-blue-500",
  },
  {
    id: "siteinspire",
    name: "SiteInspire",
    feedUrl: "https://www.siteinspire.com/websites/feed",
    siteUrl: "https://www.siteinspire.com",
    color: "text-emerald-500",
    colorBg: "bg-emerald-500",
  },
];

export const DEFAULT_ENABLED_SOURCES = INSPIRATION_SOURCES.map((s) => s.id);
export const SOURCE_IDS = new Set(DEFAULT_ENABLED_SOURCES);

export function getSourceById(id: string) {
  return INSPIRATION_SOURCES.find((s) => s.id === id);
}
