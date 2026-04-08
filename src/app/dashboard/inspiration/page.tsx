"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  INSPIRATION_SOURCES,
  DEFAULT_ENABLED_SOURCES,
} from "@/lib/inspiration/sources";
import { useSupabase } from "@/lib/supabase/use-supabase";
import { InspirationSearch } from "@/components/inspiration/inspiration-search";
import { SourceCarousel } from "@/components/inspiration/source-carousel";
import { SourceSettings } from "@/components/inspiration/source-settings";

export default function InspirationPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { getClient } = useSupabase();
  const queryClient = useQueryClient();

  // Load user preferences
  const { data: prefs } = useQuery({
    queryKey: ["inspiration-preferences"],
    queryFn: async () => {
      const client = await getClient();
      const { data } = await client
        .from("inspiration_preferences")
        .select("enabled_sources")
        .single();
      return (data?.enabled_sources as string[]) ?? DEFAULT_ENABLED_SOURCES;
    },
    staleTime: 5 * 60 * 1000,
  });

  const enabledSources = prefs ?? DEFAULT_ENABLED_SOURCES;

  // Save preferences mutation
  const savePrefsMutation = useMutation({
    mutationFn: async (newSources: string[]) => {
      const client = await getClient();
      const { error } = await client.from("inspiration_preferences").upsert(
        {
          user_id: "current_user", // RLS handles the actual user_id
          enabled_sources: newSources,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      return newSources;
    },
    onMutate: async (newSources) => {
      await queryClient.cancelQueries({
        queryKey: ["inspiration-preferences"],
      });
      const previous = queryClient.getQueryData(["inspiration-preferences"]);
      queryClient.setQueryData(["inspiration-preferences"], newSources);
      return { previous };
    },
    onError: (_err, _newSources, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["inspiration-preferences"],
          context.previous
        );
      }
    },
  });

  const handleToggle = useCallback(
    (sourceId: string) => {
      const current = enabledSources;
      const next = current.includes(sourceId)
        ? current.filter((id) => id !== sourceId)
        : [...current, sourceId];
      // Don't allow disabling all sources
      if (next.length === 0) return;
      savePrefsMutation.mutate(next);
    },
    [enabledSources, savePrefsMutation]
  );

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const activeSources = INSPIRATION_SOURCES.filter((s) =>
    enabledSources.includes(s.id)
  );

  const [visibleCount, setVisibleCount] = useState(0);
  const visibleRef = useRef(new Set<string>());

  const handleVisibilityChange = useCallback(
    (sourceId: string, hasResults: boolean) => {
      const set = visibleRef.current;
      if (hasResults) {
        set.add(sourceId);
      } else {
        set.delete(sourceId);
      }
      setVisibleCount(set.size);
    },
    []
  );

  return (
    <div className="space-y-8">
      {/* Search + Settings row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <InspirationSearch onSearchChange={handleSearchChange} />
        </div>
        <SourceSettings
          enabledSources={enabledSources}
          onToggle={handleToggle}
        />
      </div>

      {/* Carousels */}
      <div className="space-y-8">
        {activeSources.map((source) => (
          <SourceCarousel
            key={source.id}
            source={source}
            searchQuery={searchQuery}
            onVisibilityChange={handleVisibilityChange}
          />
        ))}

        {searchQuery && visibleCount === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-lg font-medium text-muted-foreground">
              No items match &ldquo;{searchQuery}&rdquo;
            </p>
            <p className="text-sm text-muted-foreground/70">
              Try a different search term or browse by source
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
