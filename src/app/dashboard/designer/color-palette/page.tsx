"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Copy, Check } from "lucide-react";
import { toast } from "sonner";

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

type PaletteType = "analogous" | "complementary" | "triadic" | "monochromatic" | "random";

function generatePalette(baseHex: string, type: PaletteType): string[] {
  const [h, s, l] = hexToHsl(baseHex);

  switch (type) {
    case "analogous":
      return [
        hslToHex((h - 30 + 360) % 360, s, l),
        hslToHex((h - 15 + 360) % 360, s, l),
        baseHex,
        hslToHex((h + 15) % 360, s, l),
        hslToHex((h + 30) % 360, s, l),
      ];
    case "complementary":
      return [
        hslToHex(h, s, Math.max(l - 20, 10)),
        hslToHex(h, s, l),
        hslToHex(h, s, Math.min(l + 20, 90)),
        hslToHex((h + 180) % 360, s, l),
        hslToHex((h + 180) % 360, s, Math.min(l + 20, 90)),
      ];
    case "triadic":
      return [
        baseHex,
        hslToHex((h + 120) % 360, s, l),
        hslToHex((h + 240) % 360, s, l),
        hslToHex(h, s, Math.min(l + 15, 90)),
        hslToHex((h + 120) % 360, s, Math.min(l + 15, 90)),
      ];
    case "monochromatic":
      return [
        hslToHex(h, s, 15),
        hslToHex(h, s, 30),
        hslToHex(h, s, 50),
        hslToHex(h, s, 70),
        hslToHex(h, s, 85),
      ];
    case "random":
    default:
      return Array.from({ length: 5 }, () =>
        hslToHex(
          Math.floor(Math.random() * 360),
          40 + Math.floor(Math.random() * 40),
          40 + Math.floor(Math.random() * 30)
        )
      );
  }
}

function ColorSwatch({ color }: { color: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(color);
    setCopied(true);
    toast.success(`Copied ${color}`);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={copy}
      className="group flex flex-1 flex-col items-center gap-2"
    >
      <div
        className="aspect-square w-full rounded-lg shadow-sm transition-transform group-hover:scale-105"
        style={{ backgroundColor: color }}
      />
      <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
        {color.toUpperCase()}
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100" />}
      </div>
    </button>
  );
}

export default function ColorPalettePage() {
  const [baseColor, setBaseColor] = useState("#6366f1");
  const [paletteType, setPaletteType] = useState<PaletteType>("analogous");
  const [colors, setColors] = useState(() =>
    generatePalette("#6366f1", "analogous")
  );

  const regenerate = useCallback(() => {
    setColors(generatePalette(baseColor, paletteType));
  }, [baseColor, paletteType]);

  function handleTypeChange(type: PaletteType) {
    setPaletteType(type);
    setColors(generatePalette(baseColor, type));
  }

  function handleColorChange(hex: string) {
    setBaseColor(hex);
    setColors(generatePalette(hex, paletteType));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Color Palette Generator</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Base Color</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={baseColor}
              onChange={(e) => handleColorChange(e.target.value)}
              className="h-10 w-10 cursor-pointer rounded border-0"
            />
            <Input
              value={baseColor}
              onChange={(e) => {
                if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                  handleColorChange(e.target.value);
                }
                setBaseColor(e.target.value);
              }}
              className="w-32 font-mono"
              placeholder="#6366f1"
            />
            <Button variant="outline" size="icon" onClick={regenerate}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["analogous", "complementary", "triadic", "monochromatic", "random"] as PaletteType[]).map((type) => (
              <Badge
                key={type}
                variant={paletteType === type ? "default" : "outline"}
                className="cursor-pointer capitalize"
                onClick={() => handleTypeChange(type)}
              >
                {type}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            {colors.map((color, i) => (
              <ColorSwatch key={`${color}-${i}`} color={color} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
