"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Copy, Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface BriefData {
  projectName: string;
  objective: string;
  targetAudience: string;
  keyMessage: string;
  deliverables: string;
  budget: string;
  timeline: string;
  mandatories: string;
  successMetrics: string;
}

const emptyBrief: BriefData = {
  projectName: "",
  objective: "",
  targetAudience: "",
  keyMessage: "",
  deliverables: "",
  budget: "",
  timeline: "",
  mandatories: "",
  successMetrics: "",
};

const fields: { key: keyof BriefData; label: string; type: "text" | "textarea"; placeholder: string }[] = [
  { key: "projectName", label: "Project Name", type: "text", placeholder: "Q3 Brand Campaign" },
  { key: "objective", label: "Objective", type: "textarea", placeholder: "What is the goal of this project? What problem are we solving?" },
  { key: "targetAudience", label: "Target Audience", type: "textarea", placeholder: "Who are we speaking to? Demographics, psychographics, behaviors..." },
  { key: "keyMessage", label: "Key Message", type: "textarea", placeholder: "What is the single most important thing we want the audience to take away?" },
  { key: "deliverables", label: "Deliverables", type: "textarea", placeholder: "List all required outputs:\n• 3x social posts\n• 1x landing page\n• 1x email" },
  { key: "budget", label: "Budget", type: "text", placeholder: "$10,000" },
  { key: "timeline", label: "Timeline", type: "text", placeholder: "Brief due May 1, Launch June 15" },
  { key: "mandatories", label: "Mandatories & Constraints", type: "textarea", placeholder: "Brand guidelines, legal requirements, do's and don'ts..." },
  { key: "successMetrics", label: "Success Metrics", type: "textarea", placeholder: "How will we measure success? KPIs, targets..." },
];

export default function BriefBuilderPage() {
  const [brief, setBrief] = useState<BriefData>(emptyBrief);

  function update(key: keyof BriefData, value: string) {
    setBrief((b) => ({ ...b, [key]: value }));
  }

  function toMarkdown() {
    return `# Creative Brief: ${brief.projectName || "Untitled"}\n\n${fields
      .map((f) => `## ${f.label}\n${brief[f.key] || "—"}`)
      .join("\n\n")}`;
  }

  function handleCopy() {
    navigator.clipboard.writeText(toMarkdown());
    toast.success("Brief copied to clipboard");
  }

  function handleExport() {
    const blob = new Blob([toMarkdown()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brief-${brief.projectName?.toLowerCase().replace(/\s+/g, "-") || "untitled"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Brief Builder</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setBrief(emptyBrief)}>
            <RotateCcw className="mr-1 h-4 w-4" />
            Clear
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="mr-1 h-4 w-4" />
            Copy
          </Button>
          <Button size="sm" onClick={handleExport}>
            <Download className="mr-1 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {fields.map((f) => (
          <Card key={f.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{f.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {f.type === "textarea" ? (
                <Textarea
                  value={brief[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="min-h-[80px] resize-y"
                />
              ) : (
                <Input
                  value={brief[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
