"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, buttonVariants } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, ExternalLink, Trash2 } from "lucide-react";

type SheetSummary = {
  code: string;
  campaign: string;
  client: string | null;
  createdAt: string;
};

async function fetchSheets(): Promise<SheetSummary[]> {
  const res = await fetch("/api/spec-sheets");
  if (!res.ok) throw new Error("Failed to load sheets");
  const data = await res.json();
  return data.sheets;
}

async function deleteSheet(code: string): Promise<void> {
  const res = await fetch(`/api/spec-sheets/${code}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Delete failed");
}

export function SheetsList() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["spec-sheets"],
    queryFn: fetchSheets,
    staleTime: 5 * 60 * 1000,
  });

  const del = useMutation({
    mutationFn: deleteSheet,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spec-sheets"] });
      toast.success("Deleted");
    },
    onError: () => toast.error("Could not delete — try again"),
  });

  function copyLink(code: string) {
    const url = `${window.location.origin}/s/${code}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  }

  if (isLoading) {
    return <div className="rounded-xl border p-6 text-sm text-muted-foreground">Loading your sheets…</div>;
  }
  if (error) {
    return <div className="rounded-xl border p-6 text-sm text-destructive">Could not load sheets.</div>;
  }
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border p-6 text-sm text-muted-foreground">
        No sheets yet. Upload one above to get started.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="text-left">
            <th className="px-4 py-2 font-medium">Campaign</th>
            <th className="px-4 py-2 font-medium">Client</th>
            <th className="px-4 py-2 font-medium">Created</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {data.map((s) => (
            <tr key={s.code} className="border-t">
              <td className="px-4 py-3">{s.campaign}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.client || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(s.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => copyLink(s.code)} aria-label="Copy link">
                    <Copy className="size-4" />
                  </Button>
                  <a
                    href={`/s/${s.code}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open viewer"
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                  >
                    <ExternalLink className="size-4" />
                  </a>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { if (confirm(`Delete "${s.campaign}"?`)) del.mutate(s.code); }}
                    disabled={del.isPending}
                    aria-label="Delete sheet"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
