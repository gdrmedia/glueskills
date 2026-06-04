"use client";
import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

interface Props {
  deleting: boolean;
  disabled?: boolean;
  /** Delete the brief. Should reject on failure so the dialog stays open. */
  onConfirm: () => Promise<void>;
}

export function DeleteBriefDialog({ deleting, disabled, onConfirm }: Props) {
  const [open, setOpen] = useState(false);

  async function handleConfirm() {
    try {
      await onConfirm();
      setOpen(false);
    } catch {
      // Keep the dialog open on failure; the caller surfaces the error toast.
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger render={<button type="button" className="m-btn m-btn-dangerghost" disabled={disabled} />}>
        <Trash2 size={16} />
        Delete brief
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="ck-nudge-backdrop" />
        <DialogPrimitive.Popup className="momentum-kickoff ck-nudge-popup">
          <DialogPrimitive.Close render={<button type="button" aria-label="Close" className="ck-nudge-x" />}>
            <X size={20} />
          </DialogPrimitive.Close>
          <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 16, paddingRight: 28 }}>
            <span style={{
              width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
              background: "#fdecec", color: "#e5484d",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              <Trash2 size={20} />
            </span>
            <DialogPrimitive.Title style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.01em", color: "var(--glue-ink)" }}>
              Delete this brief?
            </DialogPrimitive.Title>
          </div>

          <p style={{ margin: "0 0 22px", fontSize: 15, lineHeight: 1.5, color: "var(--glue-ink-600)" }}>
            This removes it from your briefs and can't be undone from here.
          </p>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <DialogPrimitive.Close render={<button type="button" className="m-btn m-btn-ghost" disabled={deleting} />}>
              Cancel
            </DialogPrimitive.Close>
            <button type="button" className="m-btn m-btn-danger" onClick={handleConfirm} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete brief"}
            </button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
