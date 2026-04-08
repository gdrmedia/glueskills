"use client";

import { ToolGrid } from "@/components/dashboard/tool-grid";
import { LayoutGrid, FileText, Users, UserCircle, Calculator } from "lucide-react";

const tools = [
  {
    href: "/dashboard/strategist/swot",
    label: "SWOT Builder",
    description: "Build and export SWOT analyses with a visual editor",
    icon: LayoutGrid,
  },
  {
    href: "/dashboard/strategist/brief-builder",
    label: "Brief Builder",
    description: "Create structured creative briefs ready to share",
    icon: FileText,
  },
  {
    href: "/dashboard/strategist/competitor-tracker",
    label: "Competitor Tracker",
    description: "Track competitors with strengths, weaknesses, and positioning",
    icon: Users,
  },
  {
    href: "/dashboard/strategist/persona-builder",
    label: "Persona Builder",
    description: "Build detailed audience personas with goals and pain points",
    icon: UserCircle,
  },
  {
    href: "/dashboard/strategist/budget-calculator",
    label: "Budget Calculator",
    description: "Plan campaign budgets with line items and category breakdown",
    icon: Calculator,
  },
];

export default function StrategistPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-extrabold tracking-tight">Strategist Tools</h1>
        <p className="mt-1.5 text-muted-foreground">Think clearly and present sharper with strategic planning tools.</p>
      </div>
      <ToolGrid tools={tools} color="orange" />
    </div>
  );
}
