"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Search as SearchIcon,
  Command,
  Paintbrush,
  PenTool,
  Target,
  Search,
  Sparkles,
  Fingerprint,
  ImageDown,
  FileImage,
  Palette,
  RulerDimensionLine,
  Contrast,
  Blend,
  Type,
  LetterText,
  TextCursorInput,
  BookOpen,
  Mail,
  LayoutGrid,
  FileText,
  Users,
  UserCircle,
  Calculator,
  Globe,
  BarChart3,
  Tags,
  Braces,
  Eye,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ── All platform tools ── */

interface ToolEntry {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  section: string;
  sectionColor: string;
  iconBg: string;
  iconText: string;
}

const allTools: ToolEntry[] = [
  // Designer
  { href: "/dashboard/designer/brand-extractor", label: "Brand Extractor", description: "Extract logos, colors, and fonts from any website", icon: Fingerprint, section: "Designer", sectionColor: "text-purple-500", iconBg: "bg-purple-500/12", iconText: "text-purple-600" },
  { href: "/dashboard/designer/image-resizer", label: "Image Resizer", description: "Resize images with presets for social media and web", icon: ImageDown, section: "Designer", sectionColor: "text-purple-500", iconBg: "bg-purple-500/12", iconText: "text-purple-600" },
  { href: "/dashboard/designer/image-compressor", label: "Image Compressor", description: "Compress PNG, JPG, and WebP images — no uploads, runs in browser", icon: FileImage, section: "Designer", sectionColor: "text-purple-500", iconBg: "bg-purple-500/12", iconText: "text-purple-600" },
  { href: "/dashboard/designer/color-palette", label: "Color Palette", description: "Generate harmonious color palettes from a base color", icon: Palette, section: "Designer", sectionColor: "text-purple-500", iconBg: "bg-purple-500/12", iconText: "text-purple-600" },
  { href: "/dashboard/designer/aspect-ratio", label: "Aspect Ratio", description: "Calculate and scale aspect ratios with common presets", icon: RulerDimensionLine, section: "Designer", sectionColor: "text-purple-500", iconBg: "bg-purple-500/12", iconText: "text-purple-600" },
  { href: "/dashboard/designer/contrast-checker", label: "Contrast Checker", description: "Check WCAG AA/AAA color contrast compliance", icon: Contrast, section: "Designer", sectionColor: "text-purple-500", iconBg: "bg-purple-500/12", iconText: "text-purple-600" },
  { href: "/dashboard/designer/gradient-generator", label: "Gradient Generator", description: "Build CSS gradients with visual controls and presets", icon: Blend, section: "Designer", sectionColor: "text-purple-500", iconBg: "bg-purple-500/12", iconText: "text-purple-600" },
  { href: "/dashboard/designer/font-pairer", label: "Font Pairer", description: "Browse and preview Google Font combinations", icon: Type, section: "Designer", sectionColor: "text-purple-500", iconBg: "bg-purple-500/12", iconText: "text-purple-600" },
  // Copywriter
  { href: "/dashboard/copywriter/word-counter", label: "Word Counter", description: "Count words, characters, and check platform limits", icon: LetterText, section: "Copywriter", sectionColor: "text-teal-500", iconBg: "bg-teal-500/12", iconText: "text-teal-600" },
  { href: "/dashboard/copywriter/headline-analyzer", label: "Headline Analyzer", description: "Score your headlines for impact and engagement", icon: Sparkles, section: "Copywriter", sectionColor: "text-teal-500", iconBg: "bg-teal-500/12", iconText: "text-teal-600" },
  { href: "/dashboard/copywriter/lorem-generator", label: "Lorem Generator", description: "Generate placeholder text by paragraphs, sentences, or words", icon: TextCursorInput, section: "Copywriter", sectionColor: "text-teal-500", iconBg: "bg-teal-500/12", iconText: "text-teal-600" },
  { href: "/dashboard/copywriter/readability-score", label: "Readability Score", description: "Flesch-Kincaid, Gunning Fog, and grade level analysis", icon: BookOpen, section: "Copywriter", sectionColor: "text-teal-500", iconBg: "bg-teal-500/12", iconText: "text-teal-600" },
  { href: "/dashboard/copywriter/email-subject-tester", label: "Email Subject Tester", description: "Test subject lines for open rates and spam triggers", icon: Mail, section: "Copywriter", sectionColor: "text-teal-500", iconBg: "bg-teal-500/12", iconText: "text-teal-600" },
  // Strategist
  { href: "/dashboard/strategist/swot", label: "SWOT Builder", description: "Build and export SWOT analyses with a visual editor", icon: LayoutGrid, section: "Strategist", sectionColor: "text-orange-500", iconBg: "bg-orange-500/12", iconText: "text-orange-600" },
  { href: "/dashboard/strategist/brief-builder", label: "Brief Builder", description: "Create structured creative briefs ready to share", icon: FileText, section: "Strategist", sectionColor: "text-orange-500", iconBg: "bg-orange-500/12", iconText: "text-orange-600" },
  { href: "/dashboard/strategist/competitor-tracker", label: "Competitor Tracker", description: "Track competitors with strengths, weaknesses, and positioning", icon: Users, section: "Strategist", sectionColor: "text-orange-500", iconBg: "bg-orange-500/12", iconText: "text-orange-600" },
  { href: "/dashboard/strategist/persona-builder", label: "Persona Builder", description: "Build detailed audience personas with goals and pain points", icon: UserCircle, section: "Strategist", sectionColor: "text-orange-500", iconBg: "bg-orange-500/12", iconText: "text-orange-600" },
  { href: "/dashboard/strategist/budget-calculator", label: "Budget Calculator", description: "Plan campaign budgets with line items and category breakdown", icon: Calculator, section: "Strategist", sectionColor: "text-orange-500", iconBg: "bg-orange-500/12", iconText: "text-orange-600" },
  // SEO
  { href: "/dashboard/seo/web-scraper", label: "Web Scraper", description: "Scrape any URL for meta tags, headings, and SEO issues", icon: Globe, section: "SEO", sectionColor: "text-rose-500", iconBg: "bg-rose-500/12", iconText: "text-rose-600" },
  { href: "/dashboard/seo/keyword-density", label: "Keyword Density", description: "Analyze word frequency and keyword density in your content", icon: BarChart3, section: "SEO", sectionColor: "text-rose-500", iconBg: "bg-rose-500/12", iconText: "text-rose-600" },
  { href: "/dashboard/seo/meta-tags", label: "Meta Tag Preview", description: "Preview how your page looks on Google and social media", icon: Tags, section: "SEO", sectionColor: "text-rose-500", iconBg: "bg-rose-500/12", iconText: "text-rose-600" },
  { href: "/dashboard/seo/schema-generator", label: "Schema Generator", description: "Generate JSON-LD for Article, FAQ, Product, and more", icon: Braces, section: "SEO", sectionColor: "text-rose-500", iconBg: "bg-rose-500/12", iconText: "text-rose-600" },
  { href: "/dashboard/seo/og-debugger", label: "OG Debugger", description: "See how your URL renders on Facebook, Twitter, and Google", icon: Eye, section: "SEO", sectionColor: "text-rose-500", iconBg: "bg-rose-500/12", iconText: "text-rose-600" },
];

/* ── Category cards ── */

const categories = [
  {
    href: "/dashboard/inspiration",
    label: "Inspiration",
    description: "Curated design feeds from Awwwards, Dribbble, and more",
    icon: Sparkles,
    iconBg: "bg-indigo-500/12 group-hover:bg-indigo-500/20",
    iconText: "text-indigo-600",
    btnGradient: "from-indigo-600 to-indigo-400",
  },
  {
    href: "/dashboard/designer",
    label: "Designer",
    description: "Image resizer, color palettes, aspect ratio calculator",
    icon: Paintbrush,
    iconBg: "bg-purple-500/12 group-hover:bg-purple-500/20",
    iconText: "text-purple-600",
    btnGradient: "from-purple-600 to-purple-400",
  },
  {
    href: "/dashboard/copywriter",
    label: "Copywriter",
    description: "Word counter, headline analyzer, lorem generator",
    icon: PenTool,
    iconBg: "bg-teal-500/12 group-hover:bg-teal-500/20",
    iconText: "text-teal-600",
    btnGradient: "from-teal-600 to-teal-400",
  },
  {
    href: "/dashboard/strategist",
    label: "Strategist",
    description: "SWOT builder, brief builder, competitor tracker",
    icon: Target,
    iconBg: "bg-orange-500/12 group-hover:bg-orange-500/20",
    iconText: "text-orange-600",
    btnGradient: "from-orange-600 to-orange-400",
  },
  {
    href: "/dashboard/seo",
    label: "SEO",
    description: "Web scraper, keyword density, meta tag previewer",
    icon: Search,
    iconBg: "bg-rose-500/12 group-hover:bg-rose-500/20",
    iconText: "text-rose-600",
    btnGradient: "from-rose-600 to-rose-400",
  },
];

export default function DashboardPage() {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allTools.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.section.toLowerCase().includes(q)
    );
  }, [query]);

  const showResults = isFocused && query.trim().length > 0;

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Global Cmd+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (!showResults) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      router.push(results[selectedIndex].href);
      setQuery("");
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      inputRef.current?.blur();
    }
  }

  return (
    <div className="space-y-10">
      {/* ── Hero welcome ── */}
      <div className="flex flex-col items-center pt-8 pb-2">
        <h1 className="font-headline text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-center">
          Damn, you got{" "}
          <span className="font-skills font-normal" style={{ color: "#f0047f", letterSpacing: "1px" }}>
            skills.
          </span>
        </h1>

        {/* ── Search bar ── */}
        <div className="relative mt-10 w-full max-w-xl">
          <div className="relative flex items-center">
            <SearchIcon className="absolute left-4 h-5 w-5 text-muted-foreground/60 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search tools, assets, or type a command..."
              className="w-full rounded-2xl bg-card py-4 pl-12 pr-20 text-sm shadow-[0px_4px_24px_0px_rgba(44,47,48,0.06)] placeholder:text-muted-foreground/45 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
            />
            <div className="absolute right-4 flex items-center gap-1 pointer-events-none">
              <kbd className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-[10px] font-medium text-muted-foreground">
                <Command className="h-3 w-3" />
              </kbd>
              <kbd className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-[10px] font-medium text-muted-foreground">
                K
              </kbd>
            </div>
          </div>

          {/* ── Search results dropdown ── */}
          {showResults && (
            <div className="absolute top-full left-0 right-0 z-50 mt-2 max-h-80 overflow-y-auto rounded-2xl bg-card shadow-[0px_12px_40px_0px_rgba(44,47,48,0.12)] py-2">
              {results.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No tools match &ldquo;{query}&rdquo;
                </div>
              ) : (
                results.map((tool, i) => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      i === selectedIndex ? "bg-accent" : ""
                    }`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tool.iconBg} ${tool.iconText}`}>
                      <tool.icon className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{tool.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{tool.description}</div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${tool.sectionColor}`}>
                      {tool.section}
                    </span>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Category cards ── */}
      <div className="grid gap-6 sm:grid-cols-2">
        {categories.map((cat) => (
          <Link
            key={cat.href}
            href={cat.href}
            prefetch={true}
            className="group relative flex flex-col gap-5 rounded-2xl bg-card p-7 shadow-[0px_4px_20px_0px_rgba(44,47,48,0.05)] hover:-translate-y-1 hover:shadow-[0px_8px_30px_0px_rgba(44,47,48,0.08)] transition-all duration-300"
          >
            <div className={`flex h-13 w-13 items-center justify-center rounded-xl ${cat.iconBg} ${cat.iconText} transition-all duration-300 group-hover:scale-110`}>
              <cat.icon className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <div className="flex-1">
              <div className="font-headline text-lg font-bold tracking-tight">{cat.label}</div>
              <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {cat.description}
              </div>
            </div>
            <div className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-br ${cat.btnGradient} text-white text-sm font-semibold opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300`}>
              Explore <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
