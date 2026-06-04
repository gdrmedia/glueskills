"use client";
import { ChevronDown } from "lucide-react";
import { FieldInput } from "./field-input";
import { ApprovalControl } from "./approval-control";
import { NudgeDialog } from "./nudge-dialog";
import type { SectionDef, SectionData, ApprovalValue, SectionStatus, KickoffUser } from "@/lib/project-kickoff/types";
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
  users: KickoffUser[];
  nudging: boolean;
  onNudge: (message: string) => Promise<void>;
  onToggleOpen: () => void;
  onPatch: (patch: SectionPatch) => void;
}

export function SectionCard({ section, data, open, readOnly, missingKeys, editorNames, users, nudging, onNudge, onToggleOpen, onPatch }: Props) {
  // Keep the <select> controlled even if the stored owner isn't in the current
  // roster (e.g. a legacy free-text owner or a since-removed user).
  const ownerId = data.owner ?? "";
  const ownerInRoster = ownerId === "" || users.some((u) => u.id === ownerId);
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
            <select
              value={ownerId} disabled={readOnly}
              onChange={(e) => onPatch({ owner: e.target.value || null })}
              aria-label="Section owner"
              className="rounded-lg border bg-background px-2 py-1 text-sm disabled:opacity-60">
              <option value="">Owner — unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
              {!ownerInRoster && (
                <option value={ownerId}>{editorNames[ownerId] ?? ownerId}</option>
              )}
            </select>
            <NudgeDialog
              recipientName={data.owner ? (editorNames[data.owner] ?? data.owner) : ""}
              disabled={readOnly || !data.owner}
              sending={nudging}
              onSend={onNudge} />
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
