"use client";
// Rendered inside the `.momentum-kickoff` editor — uses the scoped Momentum
// tokens/classes so it reads as part of the same family as the field inputs.
import type { ApprovalValue } from "@/lib/project-kickoff/types";

const OPTIONS: { value: Exclude<ApprovalValue, null>; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "partial", label: "Partial" },
  { value: "no", label: "No" },
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
    <div style={{ background: "var(--glue-surface-alt)", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label style={{ display: "block", fontSize: 16, fontWeight: 600, color: "var(--glue-ink)", marginBottom: 10 }}>
          Client approval required?
        </label>
        <div role="group" aria-label="Client approval required?" style={{ display: "flex", gap: 8 }}>
          {OPTIONS.map((o) => {
            const active = approval === o.value;
            const activeBg = o.value === "yes" ? "var(--glue-primary)" : "var(--glue-ink)";
            return (
              <button key={o.value} type="button" disabled={readOnly} aria-pressed={active}
                className={`m-seg${active ? " is-active" : ""}`}
                style={active ? { background: activeBg, borderColor: activeBg, color: "#fff" } : undefined}
                onClick={() => {
                  const next = active ? null : o.value;
                  onApproval(next);
                  if (next === "no") onNotes(""); // a brief needing no approval carries no notes
                }}>
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label htmlFor="ck-approval-notes" style={{ display: "block", fontSize: 16, fontWeight: 600, color: "var(--glue-ink)", marginBottom: 10 }}>
          Approval contact / notes
        </label>
        <input id="ck-approval-notes" className="m-input" value={notes}
          disabled={readOnly || approval === "no"}
          onChange={(e) => onNotes(e.target.value)} />
      </div>
    </div>
  );
}
