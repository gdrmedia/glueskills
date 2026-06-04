"use client";
import { useState } from "react";
import { Bell, Mail, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

interface Props {
  recipientName: string;
  disabled: boolean;
  sending: boolean;
  /** Send the nudge. Should reject on failure so the dialog stays open. */
  onSend: (message: string) => Promise<void>;
}

export function NudgeDialog({ recipientName, disabled, sending, onSend }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSend() {
    try {
      await onSend(message.trim());
      setMessage("");
      setOpen(false);
    } catch {
      // Keep the dialog open on failure; the caller surfaces the error toast.
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) setMessage(""); }}>
      <DialogPrimitive.Trigger render={<button type="button" className="m-control m-nudge" disabled={disabled} />}>
        <Bell size={16} />
        Nudge
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
              background: "var(--glue-primary-50)", color: "var(--glue-primary)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              <Bell size={20} />
            </span>
            <DialogPrimitive.Title style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.01em", color: "var(--glue-ink)" }}>
              Nudge {recipientName}
            </DialogPrimitive.Title>
          </div>

          <div style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            background: "var(--glue-surface-alt)", borderRadius: 12, padding: "12px 14px", marginBottom: 18,
          }}>
            <Mail size={16} style={{ marginTop: 2, color: "var(--glue-ink-500)", flexShrink: 0 }} />
            <span style={{ fontSize: 14, lineHeight: 1.5, color: "var(--glue-ink-600)" }}>
              This will send an email to{" "}
              <strong style={{ color: "var(--glue-ink)", fontWeight: 600 }}>{recipientName}</strong>{" "}
              reminding them to fill out this section.
            </span>
          </div>

          <label htmlFor="ck-nudge-message" style={{ display: "block", fontSize: 16, fontWeight: 600, color: "var(--glue-ink)", marginBottom: 10 }}>
            Add a message (optional)
          </label>
          <textarea id="ck-nudge-message" className="m-input" rows={4} value={message}
            placeholder="Anything you'd like to add…"
            onChange={(e) => setMessage(e.target.value)} />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
            <DialogPrimitive.Close render={<button type="button" className="m-btn m-btn-ghost" disabled={sending} />}>
              Cancel
            </DialogPrimitive.Close>
            <button type="button" className="m-btn m-btn-pink" onClick={handleSend} disabled={sending}>
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
