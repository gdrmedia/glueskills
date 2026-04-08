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
    <aside className="hidden md:flex md:w-64 md:flex-col md:bg-background md:shrink-0">
      <div className="flex h-16 items-center px-6">
        <img src="/glueskills-logo.png" alt="GlueSkills" className="h-[2.5rem]" />
      </div>
      <nav className="flex flex-col gap-0.5 px-4 py-2">
        {sections.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>
    </aside>
  );
}
