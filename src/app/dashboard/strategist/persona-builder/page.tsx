"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Copy, Download, User } from "lucide-react";
import { toast } from "sonner";

interface Persona {
  id: string;
  name: string;
  age: string;
  occupation: string;
  location: string;
  bio: string;
  goals: string;
  painPoints: string;
  motivations: string;
  channels: string;
  quote: string;
}

function emptyPersona(): Persona {
  return {
    id: crypto.randomUUID(),
    name: "",
    age: "",
    occupation: "",
    location: "",
    bio: "",
    goals: "",
    painPoints: "",
    motivations: "",
    channels: "",
    quote: "",
  };
}

const fields: { key: keyof Persona; label: string; type: "text" | "textarea"; placeholder: string; half?: boolean }[] = [
  { key: "name", label: "Name", type: "text", placeholder: "Sarah Chen", half: true },
  { key: "age", label: "Age", type: "text", placeholder: "32", half: true },
  { key: "occupation", label: "Occupation", type: "text", placeholder: "Marketing Manager", half: true },
  { key: "location", label: "Location", type: "text", placeholder: "New York, NY", half: true },
  { key: "bio", label: "Bio", type: "textarea", placeholder: "A short description of who this person is..." },
  { key: "goals", label: "Goals", type: "textarea", placeholder: "What are they trying to achieve?\n• Grow brand awareness\n• Increase engagement" },
  { key: "painPoints", label: "Pain Points", type: "textarea", placeholder: "What frustrates them?\n• Limited budget\n• Too many tools" },
  { key: "motivations", label: "Motivations", type: "textarea", placeholder: "What drives their decisions?\n• Data-driven results\n• Peer recommendations" },
  { key: "channels", label: "Preferred Channels", type: "text", placeholder: "Instagram, LinkedIn, Email, Podcasts" },
  { key: "quote", label: "Quote", type: "text", placeholder: "\"I just want something that works without 10 steps.\"" },
];

export default function PersonaBuilderPage() {
  const [personas, setPersonas] = useState<Persona[]>([emptyPersona()]);
  const [active, setActive] = useState(0);

  const persona = personas[active];

  function update(key: keyof Persona, value: string) {
    setPersonas((list) =>
      list.map((p, i) => (i === active ? { ...p, [key]: value } : p))
    );
  }

  function add() {
    setPersonas((list) => [...list, emptyPersona()]);
    setActive(personas.length);
  }

  function remove(index: number) {
    if (personas.length <= 1) return;
    setPersonas((list) => list.filter((_, i) => i !== index));
    setActive(Math.max(0, active - 1));
  }

  function toMarkdown() {
    return personas
      .map(
        (p, i) =>
          `# Persona ${i + 1}: ${p.name || "Unnamed"}\n\n` +
          `**Age:** ${p.age || "—"} | **Occupation:** ${p.occupation || "—"} | **Location:** ${p.location || "—"}\n\n` +
          `**Bio:** ${p.bio || "—"}\n\n` +
          `**Goals:**\n${p.goals || "—"}\n\n` +
          `**Pain Points:**\n${p.painPoints || "—"}\n\n` +
          `**Motivations:**\n${p.motivations || "—"}\n\n` +
          `**Channels:** ${p.channels || "—"}\n\n` +
          `**Quote:** ${p.quote || "—"}`
      )
      .join("\n\n---\n\n");
  }

  function handleExport() {
    const blob = new Blob([toMarkdown()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "personas.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Persona Builder</h1>
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
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {personas.map((p, i) => (
          <div key={p.id} className="flex items-center">
            <button
              onClick={() => setActive(i)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active === i ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"
              }`}
            >
              <User className="h-3.5 w-3.5" />
              {p.name || `Persona ${i + 1}`}
            </button>
            {personas.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-0.5 h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => remove(i)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={add}>
          <Plus className="mr-1 h-3 w-3" />
          Add Persona
        </Button>
      </div>

      {/* Form */}
      <div className="space-y-3">
        {/* Half-width fields in a grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.filter((f) => f.half).map((f) => (
            <Card key={f.key}>
              <CardContent className="pt-4 pb-3">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  value={persona[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="mt-1"
                />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Full-width fields */}
        {fields.filter((f) => !f.half).map((f) => (
          <Card key={f.key}>
            <CardContent className="pt-4 pb-3">
              <Label className="text-xs">{f.label}</Label>
              {f.type === "textarea" ? (
                <Textarea
                  value={persona[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="mt-1 min-h-[80px]"
                />
              ) : (
                <Input
                  value={persona[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="mt-1"
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
