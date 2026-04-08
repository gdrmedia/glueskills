"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type SectionColor = "purple" | "teal" | "orange" | "rose";

const colorMap: Record<SectionColor, { bg: string; bgHover: string; text: string; border: string; glow: string }> = {
  purple: {
    bg: "bg-purple-500/10",
    bgHover: "group-hover:bg-purple-500/20",
    text: "text-purple-500",
    border: "hover:border-purple-500/30",
    glow: "group-hover:shadow-purple-500/5",
  },
  teal: {
    bg: "bg-teal-500/10",
    bgHover: "group-hover:bg-teal-500/20",
    text: "text-teal-500",
    border: "hover:border-teal-500/30",
    glow: "group-hover:shadow-teal-500/5",
  },
  orange: {
    bg: "bg-orange-500/10",
    bgHover: "group-hover:bg-orange-500/20",
    text: "text-orange-500",
    border: "hover:border-orange-500/30",
    glow: "group-hover:shadow-orange-500/5",
  },
  rose: {
    bg: "bg-rose-500/10",
    bgHover: "group-hover:bg-rose-500/20",
    text: "text-rose-500",
    border: "hover:border-rose-500/30",
    glow: "group-hover:shadow-rose-500/5",
  },
};

interface Tool {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export function ToolGrid({ tools, color = "purple" }: { tools: Tool[]; color?: SectionColor }) {
  const c = colorMap[color];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => (
        <Link
          key={tool.href}
          href={tool.href}
          prefetch={true}
          className={`group relative flex flex-col gap-4 rounded-2xl border bg-card p-6 transition-all ${c.border} ${c.glow} hover:shadow-lg`}
        >
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${c.bg} ${c.bgHover} ${c.text} transition-colors`}>
            <tool.icon className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-base font-semibold">{tool.label}</div>
            <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {tool.description}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
