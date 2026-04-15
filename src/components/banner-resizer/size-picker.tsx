"use client";

import { useState } from "react";
import { IAB_SIZES, IAB_GROUPS, type IabGroup, type IabSize } from "@/lib/banner-jobs/iab-sizes";
import { MAX_TARGETS, MIN_DIMENSION, MAX_DIMENSION, type BannerJobTarget } from "@/lib/banner-jobs/job-config";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

export type SizePickerProps = {
  selected: BannerJobTarget[];
  onChange: (next: BannerJobTarget[]) => void;
};

function targetKey(t: { width: number; height: number }): string {
  return `${t.width}x${t.height}`;
}

export function SizePicker({ selected, onChange }: SizePickerProps) {
  const [customW, setCustomW] = useState("");
  const [customH, setCustomH] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);

  const selectedKeys = new Set(selected.map(targetKey));
  const atMax = selected.length >= MAX_TARGETS;

  function togglePreset(size: IabSize) {
    const key = targetKey(size);
    if (selectedKeys.has(key)) {
      onChange(selected.filter((t) => targetKey(t) !== key));
    } else {
      if (atMax) return;
      onChange([
        ...selected,
        { width: size.width, height: size.height, label: size.label, isCustom: false },
      ]);
    }
  }

  function addCustom() {
    setCustomError(null);
    if (customW.includes(".") || customW.toLowerCase().includes("e") ||
        customH.includes(".") || customH.toLowerCase().includes("e")) {
      setCustomError("Width and height must be whole numbers.");
      return;
    }
    const w = Number(customW);
    const h = Number(customH);
    if (!Number.isInteger(w) || !Number.isInteger(h)) {
      setCustomError("Width and height must be whole numbers.");
      return;
    }
    if (w < MIN_DIMENSION || h < MIN_DIMENSION) {
      setCustomError(`Minimum ${MIN_DIMENSION}px per side.`);
      return;
    }
    if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
      setCustomError(`Maximum ${MAX_DIMENSION}px per side.`);
      return;
    }
    if (selectedKeys.has(targetKey({ width: w, height: h }))) {
      setCustomError("That size is already added.");
      return;
    }
    if (atMax) {
      setCustomError(`Maximum ${MAX_TARGETS} sizes per job.`);
      return;
    }
    onChange([...selected, { width: w, height: h, isCustom: true }]);
    setCustomW("");
    setCustomH("");
  }

  function removeTarget(t: BannerJobTarget) {
    onChange(selected.filter((s) => targetKey(s) !== targetKey(t)));
  }

  const groups = (Object.keys(IAB_GROUPS) as IabGroup[]).map((g) => ({
    group: g,
    label: IAB_GROUPS[g],
    sizes: IAB_SIZES.filter((s) => s.group === g),
  }));

  const customTargets = selected.filter((s) => s.isCustom);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.group}>
          <h3 className="mb-3 text-sm font-semibold tracking-tight">{group.label}</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {group.sizes.map((s) => {
              const checked = selectedKeys.has(targetKey(s));
              const disabled = !checked && atMax;
              return (
                <label
                  key={`${s.width}x${s.height}`}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition ${
                    checked ? "border-purple-500 bg-purple-500/5" : "border-border bg-card"
                  } ${disabled ? "cursor-not-allowed opacity-50" : "hover:border-purple-400"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => togglePreset(s)}
                    className="h-4 w-4"
                  />
                  <span className="font-mono">{s.width}×{s.height}</span>
                  <span className="text-muted-foreground">{s.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-tight">Custom size</h3>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="custom-w" className="text-xs">Width</Label>
            <Input
              id="custom-w"
              type="number"
              inputMode="numeric"
              placeholder="e.g. 480"
              value={customW}
              onChange={(e) => setCustomW(e.target.value)}
              className="w-28"
            />
          </div>
          <div className="pb-2 text-muted-foreground">×</div>
          <div>
            <Label htmlFor="custom-h" className="text-xs">Height</Label>
            <Input
              id="custom-h"
              type="number"
              inputMode="numeric"
              placeholder="e.g. 200"
              value={customH}
              onChange={(e) => setCustomH(e.target.value)}
              className="w-28"
            />
          </div>
          <Button type="button" onClick={addCustom} disabled={atMax || !customW || !customH}>
            Add
          </Button>
        </div>
        {customError && <p className="mt-2 text-sm text-rose-600">{customError}</p>}

        {customTargets.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {customTargets.map((s) => (
              <span
                key={targetKey(s)}
                className="inline-flex items-center gap-2 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-700"
              >
                {s.width}×{s.height}
                <button
                  type="button"
                  onClick={() => removeTarget(s)}
                  className="hover:text-purple-900"
                  aria-label={`Remove ${s.width}x${s.height}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <p className={`text-sm ${atMax ? "text-rose-600 font-medium" : "text-muted-foreground"}`}>
        {selected.length} of {MAX_TARGETS} sizes selected
        {atMax && " — Maximum reached."}
      </p>
    </div>
  );
}
