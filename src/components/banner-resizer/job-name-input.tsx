"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_JOB_NAME_LENGTH } from "@/lib/banner-jobs/job-config";

export type JobNameInputProps = {
  value: string;
  onChange: (next: string) => void;
};

export function JobNameInput({ value, onChange }: JobNameInputProps) {
  const remaining = MAX_JOB_NAME_LENGTH - value.length;
  const overLimit = remaining < 0;

  return (
    <div>
      <Label htmlFor="job-name" className="mb-2 block text-sm font-semibold tracking-tight">
        Job name
      </Label>
      <Input
        id="job-name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Q2 Spring Campaign — Coral CTA"
        maxLength={MAX_JOB_NAME_LENGTH}
      />
      <p className="mt-1.5 text-xs text-muted-foreground">
        Becomes the new Figma page name. <span className={overLimit ? "text-rose-600" : ""}>{remaining} chars left</span>
      </p>
    </div>
  );
}
