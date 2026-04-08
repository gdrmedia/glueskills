"use client";

import { Settings2 } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { INSPIRATION_SOURCES } from "@/lib/inspiration/sources";

interface SourceSettingsProps {
  enabledSources: string[];
  onToggle: (sourceId: string) => void;
}

export function SourceSettings({
  enabledSources,
  onToggle,
}: SourceSettingsProps) {
  return (
    <Dialog>
      <DialogTrigger className="flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
        <Settings2 className="h-3.5 w-3.5" />
        Sources
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Sources</DialogTitle>
          <DialogDescription>
            Choose which design feeds appear on your Inspiration page.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          {INSPIRATION_SOURCES.map((source) => {
            const enabled = enabledSources.includes(source.id);
            return (
              <button
                key={source.id}
                onClick={() => onToggle(source.id)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${source.colorBg}`}
                  />
                  <span className="font-medium">{source.name}</span>
                </div>
                {/* Toggle pill */}
                <div
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    enabled ? "bg-indigo-500" : "bg-muted-foreground/20"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      enabled ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
