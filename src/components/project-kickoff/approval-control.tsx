"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApprovalValue } from "@/lib/project-kickoff/types";

const OPTIONS: { value: Exclude<ApprovalValue, null>; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "partial", label: "Partial" },
];

interface Props {
  approval: ApprovalValue;
  notes: string;
  readOnly: boolean;
  onApproval: (v: ApprovalValue) => void;
  onNotes: (v: string) => void;
}

export function ApprovalControl({ approval, notes, readOnly, onApproval, onNotes }: Props) {
  return (
    <div className="rounded-xl bg-amber-50 p-4 dark:bg-amber-950/20 space-y-3">
      <div className="space-y-1.5">
        <Label className="text-sm">Client approval required?</Label>
        <div role="group" aria-label="Client approval required?" className="flex gap-2">
          {OPTIONS.map((o) => {
            const active = approval === o.value;
            return (
              <button key={o.value} type="button" disabled={readOnly} aria-pressed={active}
                onClick={() => onApproval(active ? null : o.value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-amber-500 text-white" : "bg-white text-foreground hover:bg-amber-100 dark:bg-background"
                } disabled:opacity-60`}>
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ck-approval-notes" className="text-sm">Approval contact / notes</Label>
        <Input id="ck-approval-notes" value={notes} disabled={readOnly}
          onChange={(e) => onNotes(e.target.value)} />
      </div>
    </div>
  );
}
