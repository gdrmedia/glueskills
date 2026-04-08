"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type GradientType = "linear" | "radial" | "conic";

interface ColorStop {
  id: string;
  color: string;
  position: number;
}

export default function GradientGeneratorPage() {
  const [type, setType] = useState<GradientType>("linear");
  const [angle, setAngle] = useState(135);
  const [stops, setStops] = useState<ColorStop[]>([
    { id: "1", color: "#6366f1", position: 0 },
    { id: "2", color: "#ec4899", position: 100 },
  ]);
  const [copied, setCopied] = useState(false);

  function addStop() {
    setStops((s) => [
      ...s,
      { id: crypto.randomUUID(), color: "#10b981", position: 50 },
    ]);
  }

  function removeStop(id: string) {
    if (stops.length <= 2) return;
    setStops((s) => s.filter((st) => st.id !== id));
  }

  function updateStop(id: string, field: "color" | "position", value: string | number) {
    setStops((s) =>
      s.map((st) => (st.id === id ? { ...st, [field]: value } : st))
    );
  }

  const stopsStr = stops
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${s.position}%`)
    .join(", ");

  const cssValue =
    type === "linear"
      ? `linear-gradient(${angle}deg, ${stopsStr})`
      : type === "radial"
        ? `radial-gradient(circle, ${stopsStr})`
        : `conic-gradient(from ${angle}deg, ${stopsStr})`;

  const css = `background: ${cssValue};`;

  function handleCopy() {
    navigator.clipboard.writeText(css);
    setCopied(true);
    toast.success("CSS copied");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Gradient Generator</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {(["linear", "radial", "conic"] as GradientType[]).map((t) => (
                  <Badge
                    key={t}
                    variant={type === t ? "default" : "outline"}
                    className="cursor-pointer capitalize"
                    onClick={() => setType(t)}
                  >
                    {t}
                  </Badge>
                ))}
              </div>

              {(type === "linear" || type === "conic") && (
                <div className="space-y-2">
                  <Label>Angle: {angle}deg</Label>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={angle}
                    onChange={(e) => setAngle(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Color Stops</CardTitle>
              <Button variant="outline" size="sm" onClick={addStop}>
                <Plus className="mr-1 h-3 w-3" />
                Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {stops.map((stop) => (
                <div key={stop.id} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={stop.color}
                    onChange={(e) => updateStop(stop.id, "color", e.target.value)}
                    className="h-9 w-9 cursor-pointer rounded border-0"
                  />
                  <Input
                    value={stop.color}
                    onChange={(e) => updateStop(stop.id, "color", e.target.value)}
                    className="w-24 font-mono text-xs"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={stop.position}
                    onChange={(e) => updateStop(stop.id, "position", Number(e.target.value))}
                    className="w-20 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                  {stops.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeStop(stop.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div
                className="aspect-video rounded-xl"
                style={{ background: cssValue }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">CSS</CardTitle>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                Copy
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 text-sm font-mono">
                {css}
              </pre>
            </CardContent>
          </Card>

          {/* Small previews */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2 text-center">
              <div className="h-20 rounded-xl" style={{ background: cssValue }} />
              <span className="text-xs text-muted-foreground">Card</span>
            </div>
            <div className="space-y-2 text-center">
              <div className="mx-auto h-20 w-20 rounded-full" style={{ background: cssValue }} />
              <span className="text-xs text-muted-foreground">Avatar</span>
            </div>
            <div className="space-y-2 text-center">
              <div className="flex h-20 items-center justify-center rounded-xl" style={{ background: cssValue }}>
                <span className="rounded-full bg-white/90 px-4 py-1.5 text-xs font-medium text-black">
                  Button
                </span>
              </div>
              <span className="text-xs text-muted-foreground">Button BG</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
