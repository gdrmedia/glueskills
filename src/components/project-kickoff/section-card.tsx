"use client";
import { ChevronDown } from "lucide-react";
import { FieldInput } from "./field-input";
import { ApprovalControl } from "./approval-control";
import type { SectionDef, SectionData, ApprovalValue, SectionStatus } from "@/lib/project-kickoff/types";
import type { SectionPatch } from "@/lib/project-kickoff/merge";

const STATUS_OPTIONS: { value: SectionStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

interface Props {
  section: SectionDef;
  data: SectionData;
  open: boolean;
  readOnly: boolean;
  missingKeys: Set<string>;
  editorNames: Record<string, string>;
  onToggleOpen: () => void;
  onPatch: (patch: SectionPatch) => void;
}

export function SectionCard({ section, data, open, readOnly, missingKeys, editorNames, onToggleOpen, onPatch }: Props) {
  return (
    <section id={`ck-section-${section.id}`} className="overflow-hidden rounded-2xl bg-card shadow-sm">
      <button type="button" onClick={onToggleOpen}
        className="flex w-full items-center justify-between px-6 py-4 text-left">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Section {section.id} / 7
          </div>
          <h3 className="font-headline text-lg font-bold">{section.title}</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {data.last_edited_by ? `edited · ${editorNames[data.last_edited_by] ?? data.last_edited_by}` : "—"}
          </span>
          <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="space-y-5 px-6 pb-6">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={data.section_status} disabled={readOnly}
              onChange={(e) => onPatch({ section_status: e.target.value as SectionStatus })}
              className="rounded-lg border bg-background px-2 py-1 text-sm disabled:opacity-60">
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input
              type="text" placeholder="Owner (e.g. Strategy)" defaultValue={data.owner ?? ""}
              disabled={readOnly}
              onBlur={(e) => onPatch({ owner: e.target.value.trim() || null })}
              className="rounded-lg border bg-background px-2 py-1 text-sm disabled:opacity-60" />
          </div>

          {section.fields.map((f) => (
            <FieldInput key={f.key} field={f} readOnly={readOnly}
              value={data.answers[f.key] ?? ""} missing={missingKeys.has(f.key)}
              onChange={(v) => onPatch({ answers: { [f.key]: v } })} />
          ))}

          <ApprovalControl
            approval={data.approval} notes={data.approval_notes} readOnly={readOnly}
            onApproval={(v: ApprovalValue) => onPatch({ approval: v })}
            onNotes={(v) => onPatch({ approval_notes: v })} />
        </div>
      )}
    </section>
  );
}
