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
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/inspiration", label: "Inspiration", icon: Sparkles },
  { href: "/dashboard/designer", label: "Designer", icon: Paintbrush },
  { href: "/dashboard/copywriter", label: "Copywriter", icon: PenTool },
  { href: "/dashboard/strategist", label: "Strategist", icon: Target },
  { href: "/dashboard/seo", label: "SEO", icon: Search },
];

export { sections };

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:bg-transparent md:shrink-0" style={{ padding: "20px" }}>
      <div className="flex h-16 items-center">
        <a href="/dashboard"><img src="/glueskills-logo.svg" alt="GlueSkills" className="h-[3rem]" /></a>
      </div>
      <nav className="flex flex-col gap-0.5 py-2">
        {sections.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>
    </aside>
  );
}
