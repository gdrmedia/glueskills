"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const stopWords = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "it", "its", "this",
  "that", "these", "those", "i", "you", "he", "she", "we", "they", "my",
  "your", "his", "her", "our", "their", "me", "him", "us", "them", "not",
  "no", "so", "if", "as", "up", "out", "about", "into", "over", "after",
  "all", "also", "just", "than", "then", "when", "what", "which", "who",
]);

function analyze(text: string, targetKeyword: string) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1);

  const totalWords = words.length;
  if (totalWords === 0) return null;

  // Single word frequency (no stop words)
  const freq: Record<string, number> = {};
  for (const w of words) {
    if (!stopWords.has(w)) {
      freq[w] = (freq[w] || 0) + 1;
    }
  }

  // Bigrams
  const bigrams: Record<string, number> = {};
  for (let i = 0; i < words.length - 1; i++) {
    if (!stopWords.has(words[i]) || !stopWords.has(words[i + 1])) {
      const bi = `${words[i]} ${words[i + 1]}`;
      bigrams[bi] = (bigrams[bi] || 0) + 1;
    }
  }

  // Trigrams
  const trigrams: Record<string, number> = {};
  for (let i = 0; i < words.length - 2; i++) {
    const tri = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    trigrams[tri] = (trigrams[tri] || 0) + 1;
  }

  const sortByCount = (obj: Record<string, number>) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word, count]) => ({
        word,
        count,
        density: ((count / totalWords) * 100).toFixed(2),
      }));

  // Target keyword analysis
  let targetInfo = null;
  if (targetKeyword.trim()) {
    const kw = targetKeyword.toLowerCase().trim();
    const kwCount = text.toLowerCase().split(kw).length - 1;
    const density = ((kwCount / totalWords) * 100).toFixed(2);
    targetInfo = { keyword: kw, count: kwCount, density };
  }

  return {
    totalWords,
    uniqueWords: Object.keys(freq).length,
    singleWords: sortByCount(freq),
    bigramList: sortByCount(bigrams),
    trigramList: sortByCount(trigrams).filter((t) => t.count > 1),
    targetInfo,
  };
}

function DensityBar({ density }: { density: string }) {
  const pct = Math.min(parseFloat(density) * 10, 100);
  return (
    <div className="h-2 w-full rounded-full bg-muted">
      <div
        className="h-2 rounded-full bg-primary transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function KeywordDensityPage() {
  const [text, setText] = useState("");
  const [targetKeyword, setTargetKeyword] = useState("");
  const result = useMemo(() => analyze(text, targetKeyword), [text, targetKeyword]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Keyword Density Checker</h1>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label>Target Keyword (optional)</Label>
            <Input
              value={targetKeyword}
              onChange={(e) => setTargetKeyword(e.target.value)}
              placeholder="Enter a keyword to track..."
            />
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your content here to analyze keyword density..."
            className="min-h-[200px]"
          />
        </CardContent>
      </Card>

      {result && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <div className="text-2xl font-bold">{result.totalWords}</div>
                <div className="text-xs text-muted-foreground">Total Words</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <div className="text-2xl font-bold">{result.uniqueWords}</div>
                <div className="text-xs text-muted-foreground">Unique Words</div>
              </CardContent>
            </Card>
            {result.targetInfo && (
              <>
                <Card>
                  <CardContent className="pt-4 pb-3 text-center">
                    <div className="text-2xl font-bold">{result.targetInfo.count}</div>
                    <div className="text-xs text-muted-foreground">Keyword Count</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 text-center">
                    <div className="text-2xl font-bold">{result.targetInfo.density}%</div>
                    <div className="text-xs text-muted-foreground">Keyword Density</div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Word tables */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Words</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.singleWords.map((w) => (
                  <div key={w.word} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-mono">{w.word}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{w.count}</Badge>
                        <span className="text-xs text-muted-foreground w-12 text-right">{w.density}%</span>
                      </div>
                    </div>
                    <DensityBar density={w.density} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 2-Word Phrases</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.bigramList.map((w) => (
                  <div key={w.word} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-mono">{w.word}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{w.count}</Badge>
                        <span className="text-xs text-muted-foreground w-12 text-right">{w.density}%</span>
                      </div>
                    </div>
                    <DensityBar density={w.density} />
                  </div>
                ))}
              </CardContent>
            </Card>

            {result.trigramList.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top 3-Word Phrases</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.trigramList.map((w) => (
                    <div key={w.word} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-mono">{w.word}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{w.count}</Badge>
                          <span className="text-xs text-muted-foreground w-12 text-right">{w.density}%</span>
                        </div>
                      </div>
                      <DensityBar density={w.density} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
