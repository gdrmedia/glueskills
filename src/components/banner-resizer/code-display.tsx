// src/components/banner-resizer/code-display.tsx
"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import { formatCountdown } from "@/lib/banner-jobs/format-countdown";

export type CodeDisplayProps = {
  code: string;
  expiresAt: string; // ISO timestamp
};

export function CodeDisplay({ code, expiresAt }: CodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [remainingMs, setRemainingMs] = useState(() => Date.parse(expiresAt) - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setRemainingMs(Date.parse(expiresAt) - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Code copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the code manually");
    }
  }

  const expired = remainingMs <= 0;

  return (
    <div className="space-y-6">
      {/* Code + actions */}
      <div className="rounded-2xl border bg-card p-8 text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Pickup code</p>
        <div className="mt-3 font-mono text-5xl font-bold tracking-[0.2em]">{code}</div>
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button onClick={copyCode} variant="outline">
            {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
            {copied ? "Copied" : "Copy code"}
          </Button>
        </div>
        <p className={`mt-3 text-xs ${expired ? "text-rose-600 font-medium" : "text-muted-foreground"}`}>
          {expired ? "Expired — generate a new job" : `Expires in ${formatCountdown(remainingMs)}`}
        </p>
      </div>

      {/* Instructions + QR */}
      <div className="grid gap-6 md:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border bg-card p-6">
          <h3 className="text-sm font-semibold tracking-tight">How to use the code</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Open your Figma file with the source banners.</li>
            <li>
              Run the GlueSkills Banner Resizer plugin (Plugins menu → Development → GlueSkills Banner Resizer
              during preview, or Community → search "GlueSkills Banner Resizer" once published).
            </li>
            <li>Paste this code into the plugin and follow the prompts.</li>
          </ol>
        </div>
        <div className="flex items-center justify-center rounded-2xl border bg-card p-6">
          <div className="text-center">
            <QRCodeSVG value={code} size={120} />
            <p className="mt-2 text-xs text-muted-foreground">QR — scan to copy</p>
          </div>
        </div>
      </div>
    </div>
  );
}
