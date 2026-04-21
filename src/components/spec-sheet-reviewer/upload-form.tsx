"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseXlsx } from "@/lib/spec-sheets/parse-xlsx";
import { enrichPlacements, buildPartners, buildSummary } from "@/lib/spec-sheets/enrich";
import { toast } from "sonner";
import { UploadCloud, Loader2 } from "lucide-react";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

type Props = {
  onCreated: (code: string) => void;
};

export function UploadForm({ onCreated }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [campaign, setCampaign] = useState("");
  const [client, setClient] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleFile(f: File | null) {
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      toast.error("File is too large. Max 5 MB.");
      return;
    }
    setFile(f);
    if (!campaign) {
      const base = f.name.replace(/\.[^.]+$/, "");
      setCampaign(base);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { toast.error("Pick a spec sheet file first."); return; }
    if (!campaign.trim()) { toast.error("Campaign name is required."); return; }

    setSubmitting(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const parseResult = parseXlsx(buf);

      for (const w of parseResult.warnings) {
        if (/multiple sheets|using "/i.test(w)) toast.warning(w);
      }
      if (parseResult.placements.length === 0) {
        toast.error("This doesn't look like a media spec sheet. Expected a 'Partner' column header.");
        return;
      }

      const placements = enrichPlacements(parseResult.placements);
      const partners = buildPartners(placements);
      const summary = buildSummary(placements, { campaign: campaign.trim(), client: client.trim() || null });

      const res = await fetch("/api/spec-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign: campaign.trim(),
          client: client.trim() || null,
          placements,
          partners,
          summary,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error || "Failed to create sheet");
        return;
      }

      const data = await res.json();
      onCreated(data.code);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error && err.message.includes("invalid") ? "Could not read file — is it a valid .xlsx?" : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border bg-card p-6">
      <div className="space-y-2">
        <Label htmlFor="spec-file">Spec sheet (.xlsx, max 5 MB)</Label>
        <Input
          id="spec-file"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        {file && <p className="text-xs text-muted-foreground">Selected: {file.name}</p>}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="campaign">Campaign name</Label>
          <Input id="campaign" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="H1 2026 Media" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="client">Client name <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input id="client" value={client} onChange={(e) => setClient(e.target.value)} placeholder="ACME" />
        </div>
      </div>

      <Button type="submit" disabled={submitting || !file} className="w-full sm:w-auto">
        {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UploadCloud className="mr-2 size-4" />}
        {submitting ? "Generating..." : "Generate viewer"}
      </Button>
    </form>
  );
}
