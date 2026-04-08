"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SectionColor = "purple" | "teal" | "orange" | "rose";

const colorMap: Record<SectionColor, { iconBg: string; iconText: string; btnGradient: string }> = {
  purple: {
    iconBg: "bg-purple-500/12 group-hover:bg-purple-500/20",
    iconText: "text-purple-600",
    btnGradient: "from-purple-600 to-purple-400",
  },
  teal: {
    iconBg: "bg-teal-500/12 group-hover:bg-teal-500/20",
    iconText: "text-teal-600",
    btnGradient: "from-teal-600 to-teal-400",
  },
  orange: {
    iconBg: "bg-orange-500/12 group-hover:bg-orange-500/20",
    iconText: "text-orange-600",
    btnGradient: "from-orange-600 to-orange-400",
  },
  rose: {
    iconBg: "bg-rose-500/12 group-hover:bg-rose-500/20",
    iconText: "text-rose-600",
    btnGradient: "from-rose-600 to-rose-400",
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
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => (
        <Link
          key={tool.href}
          href={tool.href}
          prefetch={true}
          className="group relative flex flex-col gap-5 rounded-2xl bg-card p-7 shadow-[0px_4px_20px_0px_rgba(44,47,48,0.05)] hover:-translate-y-1 hover:shadow-[0px_8px_30px_0px_rgba(44,47,48,0.08)] transition-all duration-300"
        >
          <div className={`flex h-13 w-13 items-center justify-center rounded-xl ${c.iconBg} ${c.iconText} transition-all duration-300 group-hover:scale-110`}>
            <tool.icon className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <div className="font-headline text-base font-bold tracking-tight">{tool.label}</div>
            <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {tool.description}
            </div>
          </div>
          <div className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-br ${c.btnGradient} text-white text-sm font-semibold opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300`}>
            Open Tool <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </Link>
      ))}
    </div>
  );
}
