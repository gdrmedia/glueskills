"use client";

import { ToolGrid } from "@/components/dashboard/tool-grid";
import { ImageDown, Palette, RulerDimensionLine, Contrast, Blend, Type, Fingerprint, FileImage, LayoutPanelLeft } from "lucide-react";

const tools = [
  {
    href: "/dashboard/designer/brand-extractor",
    label: "Brand Extractor",
    description: "Extract logos, colors, and fonts from any website",
    icon: Fingerprint,
  },
  {
    href: "/dashboard/designer/banner-resizer",
    label: "Banner Resizer",
    description: "Generate IAB banner size variants from your Figma source frames — starting point, not a finished deliverable",
    icon: LayoutPanelLeft,
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
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-extrabold tracking-tight">Designer Tools</h1>
        <p className="mt-1.5 text-muted-foreground">Streamline your visual workflow with professional creative utilities.</p>
      </div>
      <ToolGrid tools={tools} color="purple" />
    </div>
  );
}
