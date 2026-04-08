"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageSquare, Bug, Lightbulb } from "lucide-react";
import { toast } from "sonner";

type FeedbackType = "bug" | "feature" | null;

export function FeedbackDialog() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!type || !message.trim()) return;

    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message: message.trim() }),
      });

      if (res.ok) {
        toast.success("Feedback sent — thank you!");
        setType(null);
        setMessage("");
        setOpen(false);
      } else {
        toast.error("Failed to send feedback. Please try again.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setType(null); setMessage(""); } }}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <MessageSquare className="mr-1.5 h-4 w-4" />
        Feedback
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>What type of feedback?</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setType("bug")}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                  type === "bug"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <Bug className={`h-6 w-6 ${type === "bug" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">Report a Bug</span>
              </button>
              <button
                onClick={() => setType("feature")}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                  type === "feature"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <Lightbulb className={`h-6 w-6 ${type === "feature" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">Request a Feature</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-message">
              {type === "bug" ? "Describe the bug" : type === "feature" ? "Describe the feature" : "Details"}
            </Label>
            <Textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                type === "bug"
                  ? "What happened? What did you expect?"
                  : type === "feature"
                    ? "What would you like to see?"
                    : "Select a type above, then describe..."
              }
              className="min-h-[120px]"
            />
          </div>

          <Button
            className="w-full"
            disabled={!type || !message.trim() || sending}
            onClick={handleSend}
          >
            {sending ? "Sending..." : "Send Feedback"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
