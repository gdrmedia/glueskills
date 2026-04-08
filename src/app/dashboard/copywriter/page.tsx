"use client";

import { ToolGrid } from "@/components/dashboard/tool-grid";
import { LetterText, Sparkles, TextCursorInput, BookOpen, Mail } from "lucide-react";

const tools = [
  {
    href: "/dashboard/copywriter/word-counter",
    label: "Word Counter",
    description: "Count words, characters, and check platform limits",
    icon: LetterText,
  },
  {
    href: "/dashboard/copywriter/headline-analyzer",
    label: "Headline Analyzer",
    description: "Score your headlines for impact and engagement",
    icon: Sparkles,
  },
  {
    href: "/dashboard/copywriter/lorem-generator",
    label: "Lorem Generator",
    description: "Generate placeholder text by paragraphs, sentences, or words",
    icon: TextCursorInput,
  },
  {
    href: "/dashboard/copywriter/readability-score",
    label: "Readability Score",
    description: "Flesch-Kincaid, Gunning Fog, and grade level analysis",
    icon: BookOpen,
  },
  {
    href: "/dashboard/copywriter/email-subject-tester",
    label: "Email Subject Tester",
    description: "Test subject lines for open rates and spam triggers",
    icon: Mail,
  },
];

export default function CopywriterPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-extrabold tracking-tight">Copywriter Tools</h1>
        <p className="mt-1.5 text-muted-foreground">Craft compelling copy faster with smart writing utilities.</p>
      </div>
      <ToolGrid tools={tools} color="teal" />
    </div>
  );
}
