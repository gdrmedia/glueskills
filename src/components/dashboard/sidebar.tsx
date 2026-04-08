"use client";

import { NavLink } from "./nav-link";
import {
  Paintbrush,
  PenTool,
  Target,
  Search,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

const sections = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/designer", label: "Designer", icon: Paintbrush },
  { href: "/dashboard/copywriter", label: "Copywriter", icon: PenTool },
  { href: "/dashboard/strategist", label: "Strategist", icon: Target },
  { href: "/dashboard/seo", label: "SEO", icon: Search },
  { href: "/dashboard/inspiration", label: "Inspiration", icon: Sparkles },
];

export { sections };

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:bg-card">
      <div className="flex h-14 items-center px-4 font-semibold tracking-tight">
        <img src="/glueskills-logo.png" alt="GlueSkills" className="h-[2.5rem]" />
      </div>
      <Separator />
      <nav className="flex flex-col gap-1 p-3">
        {sections.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>
    </aside>
  );
}
