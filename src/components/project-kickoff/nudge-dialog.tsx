"use client";
import { useState } from "react";
import { Bell, Mail } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setMessage(""); }}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" disabled={disabled} />}>
        <Bell />
        Nudge
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nudge {recipientName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              This will send an email to{" "}
              <span className="font-medium text-foreground">{recipientName}</span>{" "}
              reminding them to fill out this section.
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nudge-message">Add a message (optional)</Label>
            <Textarea
              id="nudge-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Anything you'd like to add…"
              className="min-h-[96px]"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="ghost" disabled={sending} />}>
            Cancel
          </DialogClose>
          <Button type="button" onClick={handleSend} disabled={sending}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
