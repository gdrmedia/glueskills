"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function simplify(w: number, h: number): string {
  if (w <= 0 || h <= 0) return "—";
  const d = gcd(w, h);
  return `${w / d}:${h / d}`;
}

const presets = [
  { label: "16:9", w: 1920, h: 1080, desc: "HD / YouTube" },
  { label: "9:16", w: 1080, h: 1920, desc: "Stories / Reels" },
  { label: "4:3", w: 1600, h: 1200, desc: "Classic monitor" },
  { label: "1:1", w: 1080, h: 1080, desc: "Instagram post" },
  { label: "4:5", w: 1080, h: 1350, desc: "Instagram portrait" },
  { label: "21:9", w: 2560, h: 1080, desc: "Ultrawide" },
  { label: "2:3", w: 1000, h: 1500, desc: "Pinterest" },
  { label: "1.91:1", w: 1200, h: 628, desc: "Facebook / OG" },
];

export default function AspectRatioPage() {
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [targetW, setTargetW] = useState<number | "">("");
  const [targetH, setTargetH] = useState<number | "">("");

  const ratio = simplify(width, height);
  const decimal = height > 0 ? (width / height).toFixed(4) : "—";

  // Calculate missing dimension from target
  const calcTargetH = targetW && width > 0 && height > 0
    ? Math.round((Number(targetW) / width) * height)
    : null;
  const calcTargetW = targetH && width > 0 && height > 0
    ? Math.round((Number(targetH) / height) * width)
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Aspect Ratio Calculator</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dimensions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ar-w">Width</Label>
                <Input
                  id="ar-w"
                  type="number"
                  value={width || ""}
                  onChange={(e) => setWidth(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ar-h">Height</Label>
                <Input
                  id="ar-h"
                  type="number"
                  value={height || ""}
                  onChange={(e) => setHeight(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="default" className="text-lg px-3 py-1">
                {ratio}
              </Badge>
              <span className="text-sm text-muted-foreground">({decimal})</span>
            </div>

            {/* Visual preview */}
            <div className="flex items-center justify-center rounded-lg border bg-muted/30 p-6">
              <div
                className="rounded border-2 border-primary/30 bg-primary/10"
                style={{
                  width: `${Math.min(200, 200 * (width / Math.max(width, height)))}px`,
                  height: `${Math.min(200, 200 * (height / Math.max(width, height)))}px`,
                }}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scale to New Size</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Enter target width to get height</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="New width"
                    value={targetW}
                    onChange={(e) => {
                      setTargetW(e.target.value ? Number(e.target.value) : "");
                      setTargetH("");
                    }}
                  />
                  <span className="text-sm text-muted-foreground">=</span>
                  <div className="text-sm font-medium">
                    {calcTargetH ? `${targetW} x ${calcTargetH}` : "—"}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Enter target height to get width</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="New height"
                    value={targetH}
                    onChange={(e) => {
                      setTargetH(e.target.value ? Number(e.target.value) : "");
                      setTargetW("");
                    }}
                  />
                  <span className="text-sm text-muted-foreground">=</span>
                  <div className="text-sm font-medium">
                    {calcTargetW ? `${calcTargetW} x ${targetH}` : "—"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Common Presets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => {
                      setWidth(p.w);
                      setHeight(p.h);
                    }}
                    className="flex flex-col items-start rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <span className="font-medium">{p.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.w}x{p.h} — {p.desc}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
