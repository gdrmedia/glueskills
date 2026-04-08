"use client";

import Link from "next/link";
import { Paintbrush, PenTool, Target, Search, Sparkles } from "lucide-react";

const categories = [
  {
    href: "/dashboard/designer",
    label: "Designer",
    description: "Image resizer, color palettes, aspect ratio calculator",
    icon: Paintbrush,
    bg: "bg-purple-500/10",
    bgHover: "group-hover:bg-purple-500/20",
    text: "text-purple-500",
    border: "hover:border-purple-500/30",
    glow: "group-hover:shadow-purple-500/5",
  },
  {
    href: "/dashboard/copywriter",
    label: "Copywriter",
    description: "Word counter, headline analyzer, lorem generator",
    icon: PenTool,
    bg: "bg-teal-500/10",
    bgHover: "group-hover:bg-teal-500/20",
    text: "text-teal-500",
    border: "hover:border-teal-500/30",
    glow: "group-hover:shadow-teal-500/5",
  },
  {
    href: "/dashboard/strategist",
    label: "Strategist",
    description: "SWOT builder, brief builder, competitor tracker",
    icon: Target,
    bg: "bg-orange-500/10",
    bgHover: "group-hover:bg-orange-500/20",
    text: "text-orange-500",
    border: "hover:border-orange-500/30",
    glow: "group-hover:shadow-orange-500/5",
  },
  {
    href: "/dashboard/seo",
    label: "SEO",
    description: "Web scraper, keyword density, meta tag previewer",
    icon: Search,
    bg: "bg-rose-500/10",
    bgHover: "group-hover:bg-rose-500/20",
    text: "text-rose-500",
    border: "hover:border-rose-500/30",
    glow: "group-hover:shadow-rose-500/5",
  },
  {
    href: "/dashboard/inspiration",
    label: "Inspiration",
    description: "Curated design feeds from Awwwards, Dribbble, and more",
    icon: Sparkles,
    bg: "bg-indigo-500/10",
    bgHover: "group-hover:bg-indigo-500/20",
    text: "text-indigo-500",
    border: "hover:border-indigo-500/30",
    glow: "group-hover:shadow-indigo-500/5",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {categories.map((cat) => (
          <Link
            key={cat.href}
            href={cat.href}
            prefetch={true}
            className={`group flex flex-col gap-4 rounded-2xl border bg-card p-6 transition-all hover:shadow-lg ${cat.border} ${cat.glow}`}
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${cat.bg} ${cat.bgHover} ${cat.text} transition-colors`}>
              <cat.icon className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <div>
              <div className="text-lg font-semibold">{cat.label}</div>
              <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {cat.description}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
