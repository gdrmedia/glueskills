"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Copy, Download } from "lucide-react";
import { toast } from "sonner";

interface Competitor {
  id: string;
  name: string;
  website: string;
  strengths: string;
  weaknesses: string;
  positioning: string;
  notes: string;
}

function newCompetitor(): Competitor {
  return {
    id: crypto.randomUUID(),
    name: "",
    website: "",
    strengths: "",
    weaknesses: "",
    positioning: "",
    notes: "",
  };
}

export default function CompetitorTrackerPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([newCompetitor()]);

  function update(id: string, field: keyof Competitor, value: string) {
    setCompetitors((list) =>
      list.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  }

  function add() {
    setCompetitors((list) => [...list, newCompetitor()]);
  }

  function remove(id: string) {
    setCompetitors((list) => list.filter((c) => c.id !== id));
  }

  function toMarkdown() {
    return `# Competitive Analysis\n\n${competitors
      .map(
        (c, i) =>
          `## ${i + 1}. ${c.name || "Unnamed"}\n**Website:** ${c.website || "—"}\n\n**Strengths:** ${c.strengths || "—"}\n\n**Weaknesses:** ${c.weaknesses || "—"}\n\n**Positioning:** ${c.positioning || "—"}\n\n**Notes:** ${c.notes || "—"}`
      )
      .join("\n\n---\n\n")}`;
  }

  function handleExport() {
    const blob = new Blob([toMarkdown()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "competitive-analysis.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Competitor Tracker</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(toMarkdown());
              toast.success("Copied");
            }}
          >
            <Copy className="mr-1 h-4 w-4" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-4 w-4" />
            Export
          </Button>
          <Button size="sm" onClick={add}>
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {competitors.map((comp, i) => (
          <Card key={comp.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">
                <Badge variant="outline" className="mr-2">{i + 1}</Badge>
                {comp.name || "New Competitor"}
              </CardTitle>
              {competitors.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(comp.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={comp.name}
                    onChange={(e) => update(comp.id, "name", e.target.value)}
                    placeholder="Competitor name"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Website</Label>
                  <Input
                    value={comp.website}
                    onChange={(e) => update(comp.id, "website", e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Strengths</Label>
                  <Textarea
                    value={comp.strengths}
                    onChange={(e) => update(comp.id, "strengths", e.target.value)}
                    placeholder="What they do well..."
                    className="min-h-[60px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Weaknesses</Label>
                  <Textarea
                    value={comp.weaknesses}
                    onChange={(e) => update(comp.id, "weaknesses", e.target.value)}
                    placeholder="Where they fall short..."
                    className="min-h-[60px]"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Positioning</Label>
                <Input
                  value={comp.positioning}
                  onChange={(e) => update(comp.id, "positioning", e.target.value)}
                  placeholder="How they position themselves in the market"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={comp.notes}
                  onChange={(e) => update(comp.id, "notes", e.target.value)}
                  placeholder="Additional observations..."
                  className="min-h-[60px]"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
