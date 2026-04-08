"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

function countStats(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return { words: 0, characters: 0, charactersNoSpaces: 0, sentences: 0, paragraphs: 0, readingTime: "0 sec" };
  }

  const words = trimmed.split(/\s+/).length;
  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s/g, "").length;
  const sentences = (trimmed.match(/[.!?]+/g) || []).length || (trimmed.length > 0 ? 1 : 0);
  const paragraphs = trimmed.split(/\n\s*\n/).filter(Boolean).length || 1;

  const minutes = words / 200;
  const readingTime =
    minutes < 1
      ? `${Math.ceil(minutes * 60)} sec`
      : `${Math.round(minutes)} min`;

  return { words, characters, charactersNoSpaces, sentences, paragraphs, readingTime };
}

export default function WordCounterPage() {
  const [text, setText] = useState("");
  const stats = useMemo(() => countStats(text), [text]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Word Counter</h1>

      <div className="grid gap-3 grid-cols-3 sm:grid-cols-6">
        {[
          { label: "Words", value: stats.words },
          { label: "Characters", value: stats.characters },
          { label: "No spaces", value: stats.charactersNoSpaces },
          { label: "Sentences", value: stats.sentences },
          { label: "Paragraphs", value: stats.paragraphs },
          { label: "Read time", value: stats.readingTime },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste or type your text here..."
            className="min-h-[300px] resize-y text-base"
          />
        </CardContent>
      </Card>

      {text.trim() && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Platform Limits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {[
                { name: "Twitter/X", limit: 280, unit: "chars" },
                { name: "Instagram Bio", limit: 150, unit: "chars" },
                { name: "Meta Title", limit: 60, unit: "chars" },
                { name: "Meta Description", limit: 160, unit: "chars" },
                { name: "LinkedIn Post", limit: 3000, unit: "chars" },
              ].map((p) => {
                const count = p.unit === "chars" ? stats.characters : stats.words;
                const over = count > p.limit;
                return (
                  <Badge
                    key={p.name}
                    variant={over ? "destructive" : "secondary"}
                  >
                    {p.name}: {count}/{p.limit}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
