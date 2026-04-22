"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
};

export function ColorInput({ id, label, value, onChange, required, error }: Props) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {!required && <span className="text-muted-foreground font-normal"> (optional)</span>}
      </Label>
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-9 shrink-0 rounded border border-border"
          style={{ backgroundColor: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value) ? value : "transparent" }}
        />
        <Input
          id={id}
          type="text"
          placeholder="#RRGGBB"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
