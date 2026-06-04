"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSaveKickoff, type SavePayload } from "@/lib/project-kickoff/queries";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Debounced autosave. Each queued payload carries a FULL slice (an entire section, or
 * the deliverables object), so coalescing by replacement never drops a field. Switching
 * target (a different section, or deliverables) flushes the pending one first so it isn't
 * lost. Concurrency is last-write-wins: the PATCH route always merges onto the latest DB
 * row, so edits to different sections never clobber each other. A live "someone else
 * edited — reload" nudge is intentionally deferred (see spec §7 / non-goals); a user sees
 * others' changes on next load.
 */
export function useAutosave(id: string) {
  const { mutateAsync } = useSaveKickoff(id);
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingKey = useRef<string | null>(null);
  const pendingPayload = useRef<SavePayload | null>(null);

  const flush = useCallback(async (payload: SavePayload) => {
    setState("saving");
    try {
      await mutateAsync(payload);
      setState("saved");
    } catch {
      setState("error");
    }
  }, [mutateAsync]);

  const queue = useCallback((payload: SavePayload) => {
    const key = "section" in payload ? `s${payload.section}` : "deliverables";
    if (timer.current) {
      clearTimeout(timer.current);
      // target switched before the pending save fired — flush it so it isn't dropped
      if (pendingKey.current && pendingKey.current !== key && pendingPayload.current) {
        void flush(pendingPayload.current);
      }
    }
    pendingKey.current = key;
    pendingPayload.current = payload;
    timer.current = setTimeout(() => {
      timer.current = null;
      pendingKey.current = null;
      pendingPayload.current = null;
      void flush(payload);
    }, 800);
  }, [flush]);

  // Do not flush on unmount — just cancel the pending timer.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { queue, flush, state };
}
