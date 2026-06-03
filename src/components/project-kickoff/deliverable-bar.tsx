"use client";
import { FileText, Share2, Award } from "lucide-react";
import type { Deliverables, DeliverableKey } from "@/lib/project-kickoff/types";

const PILLS: { key: DeliverableKey; label: string; icon: typeof FileText }[] = [
  { key: "case_study", label: "Case Study", icon: FileText },
  { key: "social", label: "Social Posts", icon: Share2 },
  { key: "award", label: "Award Submission", icon: Award },
];

interface Props {
  deliverables: Deliverables;
  readOnly: boolean;
  onToggle: (key: DeliverableKey, next: boolean) => void;
}

export function DeliverableBar({ deliverables, readOnly, onToggle }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {PILLS.map(({ key, label, icon: Icon }) => {
        const on = deliverables[key];
        return (
          <button key={key} type="button" disabled={readOnly} aria-pressed={on}
            onClick={() => onToggle(key, !on)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              on ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
            } disabled:opacity-60`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        );
      })}
    </div>
  );
}
