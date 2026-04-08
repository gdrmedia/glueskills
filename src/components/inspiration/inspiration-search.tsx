"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const QUICK_TAGS = [
  "UI design",
  "landing page",
  "dashboard",
  "mobile app",
  "portfolio",
  "e-commerce",
  "SaaS",
  "dark mode",
];

interface InspirationSearchProps {
  onSearchChange: (query: string) => void;
}

export function InspirationSearch({ onSearchChange }: InspirationSearchProps) {
  const [input, setInput] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const callbackRef = useRef(onSearchChange);
  callbackRef.current = onSearchChange;

  // Debounced search propagation
  useEffect(() => {
    const timer = setTimeout(() => {
      callbackRef.current(input);
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);

  const handleTagClick = (tag: string) => {
    if (activeTag === tag) {
      setActiveTag(null);
      setInput("");
    } else {
      setActiveTag(tag);
      setInput(tag);
    }
  };

  const clearSearch = () => {
    setInput("");
    setActiveTag(null);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">
        What do you want to look for today?
      </h1>

      {/* Search input */}
      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setActiveTag(null);
          }}
          placeholder="Search across all feeds..."
          className="h-10 pl-9 pr-9"
        />
        {input && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Quick tags */}
      <div className="flex flex-wrap gap-2">
        {QUICK_TAGS.map((tag) => (
          <button key={tag} onClick={() => handleTagClick(tag)}>
            <Badge
              variant={activeTag === tag ? "default" : "outline"}
              className="cursor-pointer"
            >
              {tag}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  );
}
