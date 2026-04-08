"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { FeedItem } from "@/lib/inspiration/sources";

function proxyUrl(url: string): string {
  return `/api/inspiration/image?url=${encodeURIComponent(url)}`;
}

interface FeedCardProps {
  item: FeedItem;
  sourceColor: string;
  sourceName: string;
}

export function FeedCard({ item, sourceColor, sourceName }: FeedCardProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex h-[200px] w-[280px] shrink-0 snap-start overflow-hidden rounded-xl border bg-card transition-all hover:shadow-lg hover:border-indigo-500/30"
    >
      {item.thumbnail && !imgFailed ? (
        <img
          src={proxyUrl(item.thumbnail)}
          alt={item.title}
          onError={() => setImgFailed(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20" />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Source badge */}
      <span
        className={`absolute top-3 right-3 rounded-full ${sourceColor} px-2.5 py-0.5 text-[10px] font-semibold text-white`}
      >
        {sourceName}
      </span>

      {/* External link icon */}
      <ExternalLink className="absolute top-3 left-3 h-4 w-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />

      {/* Title */}
      <div className="relative mt-auto p-4">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-white">
          {item.title}
        </p>
        {item.pubDate && (
          <p className="mt-1 text-[11px] text-white/60">
            {new Date(item.pubDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
        )}
      </div>
    </a>
  );
}
