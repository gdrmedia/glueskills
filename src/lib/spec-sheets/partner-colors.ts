// Partner name → { id, color } mapping. Match by regex against raw partner name.

type Entry = { match: RegExp; id: string; color: string };

const MAP: Entry[] = [
  { match: /^meta/i,           id: "meta",       color: "#0866FF" },
  { match: /^facebook/i,       id: "meta",       color: "#0866FF" },
  { match: /^instagram/i,      id: "meta",       color: "#E4405F" },
  { match: /^reddit/i,         id: "reddit",     color: "#FF4500" },
  { match: /^tiktok/i,         id: "tiktok",     color: "#13131A" },
  { match: /youtube.*ctv/i,    id: "youtubectv", color: "#FF0000" },
  { match: /youtube.*olv/i,    id: "youtubeolv", color: "#EF4444" },
  { match: /^youtube/i,        id: "youtubectv", color: "#FF0000" },
  { match: /^google/i,         id: "google",     color: "#4285F4" },
  { match: /directv/i,         id: "directv",    color: "#E11D48" },
  { match: /spotify/i,         id: "spotify",    color: "#1DB954" },
  { match: /pandora/i,         id: "pandora",    color: "#005483" },
  { match: /yelp/i,            id: "yelp",       color: "#D32323" },
  { match: /transmit/i,        id: "transmit",   color: "#7C3AED" },
  { match: /pubmatic/i,        id: "pubmatic",   color: "#A855F7" },
  { match: /^pmp/i,            id: "pmp",        color: "#9333EA" },
  { match: /^dmv/i,            id: "dmv",        color: "#8B5CF6" },
  { match: /smartly|display/i, id: "smartly",    color: "#6B5AED" },
  { match: /ctv/i,             id: "transmit",   color: "#7C3AED" },
  { match: /twitter|^x$/i,     id: "twitter",    color: "#1DA1F2" },
  { match: /linkedin/i,        id: "linkedin",   color: "#0A66C2" },
  { match: /snap/i,            id: "snap",       color: "#FFFC00" },
  { match: /pinterest/i,       id: "pinterest",  color: "#E60023" },
];

export const FALLBACK = { id: "generic", color: "#9E9E9E" } as const;

function lookup(partner: string | null | undefined): { id: string; color: string } {
  if (!partner) return FALLBACK;
  for (const entry of MAP) if (entry.match.test(partner)) return entry;
  return FALLBACK;
}

export function colorFor(partner: string | null | undefined): string {
  return lookup(partner).color;
}

export function iconIdFor(partner: string | null | undefined): string {
  return lookup(partner).id;
}
