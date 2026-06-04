"use client";
import { Check, Loader2, AlertCircle } from "lucide-react";
import type { SaveState } from "./use-autosave";

export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const map = {
    saving: { icon: Loader2, text: "Saving…", cls: "text-muted-foreground", spin: true },
    saved: { icon: Check, text: "Saved", cls: "text-emerald-600", spin: false },
    error: { icon: AlertCircle, text: "Couldn't save — retry", cls: "text-rose-600", spin: false },
  }[state];
  const Icon = map.icon;
  return (
    <span aria-live="polite" className={`inline-flex items-center gap-1.5 text-xs font-medium ${map.cls}`}>
      <Icon className={`h-3.5 w-3.5 ${map.spin ? "animate-spin" : ""}`} />
      {map.text}
    </span>
  );
}
