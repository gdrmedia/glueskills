"use client";

import { ToolGrid } from "@/components/dashboard/tool-grid";
import { ImageDown, Palette, RulerDimensionLine, Contrast, Blend, Type, Fingerprint, FileImage } from "lucide-react";

const tools = [
  {
    href: "/dashboard/designer/brand-extractor",
    label: "Brand Extractor",
    description: "Extract logos, colors, and fonts from any website",
    icon: Fingerprint,
  },
  {
    href: "/dashboard/designer/image-resizer",
    label: "Image Resizer",
    description: "Resize images with presets for social media and web",
    icon: ImageDown,
  },
  {
    href: "/dashboard/designer/image-compressor",
    label: "Image Compressor",
    description: "Compress PNG, JPG, and WebP images — no uploads, runs in browser",
    icon: FileImage,
  },
  {
    href: "/dashboard/designer/color-palette",
    label: "Color Palette",
    description: "Generate harmonious color palettes from a base color",
    icon: Palette,
  },
  {
    href: "/dashboard/designer/aspect-ratio",
    label: "Aspect Ratio",
    description: "Calculate and scale aspect ratios with common presets",
    icon: RulerDimensionLine,
  },
  {
    href: "/dashboard/designer/contrast-checker",
    label: "Contrast Checker",
    description: "Check WCAG AA/AAA color contrast compliance",
    icon: Contrast,
  },
  {
    href: "/dashboard/designer/gradient-generator",
    label: "Gradient Generator",
    description: "Build CSS gradients with visual controls and presets",
    icon: Blend,
  },
  {
    href: "/dashboard/designer/font-pairer",
    label: "Font Pairer",
    description: "Browse and preview Google Font combinations",
    icon: Type,
  },
];

export default function DesignerPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Designer Tools</h1>
      <ToolGrid tools={tools} color="purple" />
    </div>
  );
}
