"use client";

import { useState } from "react";
import { UploadForm } from "@/components/spec-sheet-reviewer/upload-form";
import { SheetsList } from "@/components/spec-sheet-reviewer/sheets-list";
import { Button, buttonVariants } from "@/components/ui/button";
import { toast } from "sonner";
import { FileSpreadsheet, Copy, ExternalLink } from "lucide-react";

export default function SpecSheetReviewerPage() {
  const [justCreated, setJustCreated] = useState<string | null>(null);

  function shareUrl(code: string) {
    return `${window.location.origin}/s/${code}`;
  }

  if (justCreated) {
    const url = shareUrl(justCreated);
    return (
      <div className="space-y-8">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-orange-100 p-3 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
            <FileSpreadsheet className="size-6" />
          </div>
          <div>
            <h1 className="font-headline text-3xl font-extrabold tracking-tight">Viewer ready</h1>
            <p className="mt-1.5 text-muted-foreground">Share this link — anyone with it can view the spec sheet.</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 font-mono text-sm">
            <span className="flex-1 truncate">{url}</span>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(url); toast.success("Copied"); }}>
              <Copy className="size-4" />
            </Button>
          </div>
          <div className="mt-4 flex gap-2">
            <a
              href={`/s/${justCreated}`}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "default" })}
            >
              Open viewer <ExternalLink className="ml-2 size-4" />
            </a>
            <Button variant="outline" onClick={() => setJustCreated(null)}>Create another</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-orange-100 p-3 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
          <FileSpreadsheet className="size-6" />
        </div>
        <div>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight">Banner Spec Sheet Reviewer</h1>
          <p className="mt-1.5 text-muted-foreground">
            Upload a client media spec sheet. We'll turn it into a shareable web viewer.
          </p>
        </div>
      </div>

      <UploadForm onCreated={setJustCreated} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">My spec sheets</h2>
        <SheetsList />
      </section>
    </div>
  );
}
