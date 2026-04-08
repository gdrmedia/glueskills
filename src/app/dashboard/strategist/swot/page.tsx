"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";

type Quadrant = "strengths" | "weaknesses" | "opportunities" | "threats";

const quadrants: { key: Quadrant; label: string; color: string; placeholder: string }[] = [
  { key: "strengths", label: "Strengths", color: "border-green-500/30 bg-green-500/5", placeholder: "Internal advantages...\n• Brand recognition\n• Unique capabilities" },
  { key: "weaknesses", label: "Weaknesses", color: "border-red-500/30 bg-red-500/5", placeholder: "Internal limitations...\n• Resource gaps\n• Skill shortages" },
  { key: "opportunities", label: "Opportunities", color: "border-blue-500/30 bg-blue-500/5", placeholder: "External possibilities...\n• Market trends\n• New channels" },
  { key: "threats", label: "Threats", color: "border-yellow-500/30 bg-yellow-500/5", placeholder: "External risks...\n• Competitors\n• Regulation changes" },
];

export default function SwotPage() {
  const [data, setData] = useState<Record<Quadrant, string>>({
    strengths: "",
    weaknesses: "",
    opportunities: "",
    threats: "",
  });

  function exportText() {
    const text = quadrants
      .map((q) => `## ${q.label}\n${data[q.key] || "(empty)"}`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("SWOT copied to clipboard");
  }

  function exportMarkdown() {
    const md = `# SWOT Analysis\n\n${quadrants
      .map((q) => `## ${q.label}\n${data[q.key] || "—"}`)
      .join("\n\n")}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "swot-analysis.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">SWOT Builder</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportText}>
            <Copy className="mr-1 h-4 w-4" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={exportMarkdown}>
            <Download className="mr-1 h-4 w-4" />
            Export .md
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {quadrants.map((q) => (
          <Card key={q.key} className={`border-2 ${q.color}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{q.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={data[q.key]}
                onChange={(e) => setData({ ...data, [q.key]: e.target.value })}
                placeholder={q.placeholder}
                className="min-h-[150px] resize-y border-0 bg-transparent p-0 focus-visible:ring-0"
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
