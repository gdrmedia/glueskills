"use client";

import { ToolGrid } from "@/components/dashboard/tool-grid";
import { Globe, BarChart3, Tags, Braces, Eye } from "lucide-react";

const tools = [
  {
    href: "/dashboard/seo/web-scraper",
    label: "Web Scraper",
    description: "Scrape any URL for meta tags, headings, and SEO issues",
    icon: Globe,
  },
  {
    href: "/dashboard/seo/keyword-density",
    label: "Keyword Density",
    description: "Analyze word frequency and keyword density in your content",
    icon: BarChart3,
  },
  {
    href: "/dashboard/seo/meta-tags",
    label: "Meta Tag Preview",
    description: "Preview how your page looks on Google and social media",
    icon: Tags,
  },
  {
    href: "/dashboard/seo/schema-generator",
    label: "Schema Generator",
    description: "Generate JSON-LD for Article, FAQ, Product, and more",
    icon: Braces,
  },
  {
    href: "/dashboard/seo/og-debugger",
    label: "OG Debugger",
    description: "See how your URL renders on Facebook, Twitter, and Google",
    icon: Eye,
  },
];

export default function SeoPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">SEO Tools</h1>
      <ToolGrid tools={tools} color="rose" />
    </div>
  );
}
