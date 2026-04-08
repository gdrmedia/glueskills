"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hex1: string, hex2: string): number | null {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return null;
  const l1 = relativeLuminance(...rgb1);
  const l2 = relativeLuminance(...rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function PassFail({ pass, label }: { pass: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <Badge variant={pass ? "default" : "destructive"}>
        {pass ? "Pass" : "Fail"}
      </Badge>
    </div>
  );
}

export default function ContrastCheckerPage() {
  const [fg, setFg] = useState("#000000");
  const [bg, setBg] = useState("#ffffff");

  const ratio = useMemo(() => contrastRatio(fg, bg), [fg, bg]);
  const ratioStr = ratio ? ratio.toFixed(2) : "—";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Contrast Checker</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Colors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <div className="space-y-2">
                <Label>Foreground</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={fg}
                    onChange={(e) => setFg(e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded border-0"
                  />
                  <Input
                    value={fg}
                    onChange={(e) => setFg(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="mb-0.5"
                onClick={() => { setFg(bg); setBg(fg); }}
              >
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
              <div className="space-y-2">
                <Label>Background</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={bg}
                    onChange={(e) => setBg(e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded border-0"
                  />
                  <Input
                    value={bg}
                    onChange={(e) => setBg(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className="text-4xl font-bold">{ratioStr}:1</div>
              <div className="text-sm text-muted-foreground">Contrast Ratio</div>
            </div>

            <div className="space-y-2">
              <PassFail pass={!!ratio && ratio >= 4.5} label="AA Normal Text (4.5:1)" />
              <PassFail pass={!!ratio && ratio >= 3} label="AA Large Text (3:1)" />
              <PassFail pass={!!ratio && ratio >= 7} label="AAA Normal Text (7:1)" />
              <PassFail pass={!!ratio && ratio >= 4.5} label="AAA Large Text (4.5:1)" />
              <PassFail pass={!!ratio && ratio >= 3} label="AA UI Components (3:1)" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl p-6 space-y-4" style={{ backgroundColor: bg, color: fg }}>
              <h2 className="text-2xl font-bold">Heading Text</h2>
              <p className="text-base">
                This is how normal body text looks with your selected color combination.
                Make sure it is readable and comfortable for extended reading.
              </p>
              <p className="text-sm">
                Smaller text like captions and labels needs higher contrast to remain legible.
              </p>
              <div className="flex gap-2">
                <span
                  className="rounded-full px-4 py-1.5 text-sm font-medium"
                  style={{ backgroundColor: fg, color: bg }}
                >
                  Button
                </span>
                <span
                  className="rounded-full border px-4 py-1.5 text-sm font-medium"
                  style={{ borderColor: fg }}
                >
                  Outline
                </span>
              </div>
            </div>

            <div className="rounded-xl p-6 space-y-4" style={{ backgroundColor: fg, color: bg }}>
              <h2 className="text-2xl font-bold">Inverted</h2>
              <p className="text-base">
                Same colors, swapped — foreground becomes background and vice versa.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
