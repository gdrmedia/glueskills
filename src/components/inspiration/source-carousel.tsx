"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import type { InspirationSource, FeedItem } from "@/lib/inspiration/sources";
import { FeedCard } from "./feed-card";
import { CarouselSkeleton } from "./carousel-skeleton";

interface SourceCarouselProps {
  source: InspirationSource;
  searchQuery: string;
  onVisibilityChange?: (sourceId: string, hasResults: boolean) => void;
}

export function SourceCarousel({ source, searchQuery, onVisibilityChange }: SourceCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<{
    source: string;
    items: FeedItem[];
  }>({
    queryKey: ["inspiration", source.id],
    queryFn: async () => {
      const res = await fetch(`/api/inspiration?source=${source.id}`);
      if (!res.ok) throw new Error("Failed to fetch feed");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 2,
  });

  const items = data?.items ?? [];
  const filtered = searchQuery
    ? items.filter((item) => {
        const words = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
        const text =
          `${item.title} ${item.description ?? ""} ${source.name}`.toLowerCase();
        return words.every((word) => text.includes(word));
      })
    : items;

  const hasResults = !searchQuery || filtered.length > 0;
  useEffect(() => {
    onVisibilityChange?.(source.id, hasResults);
    return () => onVisibilityChange?.(source.id, false);
  }, [source.id, hasResults, onVisibilityChange]);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollButtons();
    el.addEventListener("scroll", updateScrollButtons, { passive: true });
    return () => el.removeEventListener("scroll", updateScrollButtons);
  }, [updateScrollButtons, filtered.length]);

  const scroll = (direction: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: direction === "left" ? -600 : 600,
      behavior: "smooth",
    });
  };

  // Hide entire carousel if search yields no results for this source
  if (!isLoading && searchQuery && filtered.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${source.colorBg}`} />
          <h2 className="text-base font-semibold">{source.name}</h2>
          {!isLoading && (
            <span className="text-xs text-muted-foreground">
              {filtered.length} items
            </span>
          )}
        </div>
        <a
          href={source.siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Visit site
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Carousel */}
      {isLoading ? (
        <CarouselSkeleton />
      ) : error ? (
        <div className="flex h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground">
          <span>Couldn&apos;t load {source.name} feed</span>
          <button
            onClick={() => refetch()}
            className="rounded-md bg-muted px-3 py-1 text-xs font-medium transition-colors hover:bg-muted/80"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="group/carousel relative">
          {/* Left arrow */}
          {canScrollLeft && (
            <button
              onClick={() => scroll("left")}
              className="absolute -left-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border bg-card shadow-md transition-opacity hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}

          {/* Scrollable container */}
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {filtered.map((item, i) => (
              <FeedCard
                key={`${item.link}-${i}`}
                item={item}
                sourceColor={source.colorBg}
                sourceName={source.name}
              />
            ))}
          </div>

          {/* Right arrow */}
          {canScrollRight && (
            <button
              onClick={() => scroll("right")}
              className="absolute -right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border bg-card shadow-md transition-opacity hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
