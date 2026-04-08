"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function CarouselSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-[200px] w-[280px] shrink-0 rounded-xl"
        />
      ))}
    </div>
  );
}
