"use client";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { BannerJobOptions } from "@/lib/banner-jobs/job-config";

export type OptionsFormProps = {
  value: BannerJobOptions;
  onChange: (next: BannerJobOptions) => void;
};

export function OptionsForm({ value, onChange }: OptionsFormProps) {
  return (
    <div className="space-y-5">
      {/* Placement toggle */}
      <div className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4">
        <div>
          <Label htmlFor="opt-new-page" className="text-sm font-semibold tracking-tight">
            Place on a new page
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            New frames go on a dedicated page named after the job. Off → appended below source frames on the current page.
          </p>
        </div>
        <input
          id="opt-new-page"
          type="checkbox"
          checked={value.placeOnNewPage}
          onChange={(e) => onChange({ ...value, placeOnNewPage: e.target.checked })}
          className="mt-1 h-4 w-4"
        />
      </div>

      {/* Naming pattern */}
      <div className="rounded-lg border bg-card p-4">
        <Label htmlFor="opt-naming" className="text-sm font-semibold tracking-tight">
          Frame naming pattern
        </Label>
        <select
          id="opt-naming"
          value={value.namingPattern}
          onChange={(e) =>
            onChange({ ...value, namingPattern: e.target.value as BannerJobOptions["namingPattern"] })
          }
          className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="size">728x90</option>
          <option value="size-job">728x90 — [Job name]</option>
          <option value="size-source">728x90 — [Source frame name]</option>
        </select>
      </div>

      {/* Locked: AI polish */}
      <div className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4 opacity-60">
        <div>
          <div className="flex items-center gap-2">
            <Label className="text-sm font-semibold tracking-tight">AI polish</Label>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Use vision AI to refine the auto-resize layout. Reserved for v2.
          </p>
        </div>
        <input type="checkbox" disabled className="mt-1 h-4 w-4" />
      </div>
    </div>
  );
}
