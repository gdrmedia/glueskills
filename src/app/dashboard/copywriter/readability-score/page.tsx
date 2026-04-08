"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function analyze(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const sentences = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  const sentenceCount = Math.max(sentences.length, 1);
  const wordCount = words.length;
  if (wordCount === 0) return null;

  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const complexWords = words.filter((w) => countSyllables(w) >= 3).length;

  const avgWordsPerSentence = wordCount / sentenceCount;
  const avgSyllablesPerWord = totalSyllables / wordCount;

  // Flesch Reading Ease (0-100, higher = easier)
  const fleschEase = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;

  // Flesch-Kincaid Grade Level
  const fleschKincaid = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;

  // Gunning Fog Index
  const gunningFog = 0.4 * (avgWordsPerSentence + 100 * (complexWords / wordCount));

  // Coleman-Liau Index
  const avgCharsPerWord = words.join("").replace(/[^a-zA-Z]/g, "").length / wordCount;
  const L = avgCharsPerWord * 100;
  const S = (sentenceCount / wordCount) * 100;
  const colemanLiau = 0.0588 * L - 0.296 * S - 15.8;

  // SMOG
  const smog = wordCount >= 30
    ? 1.0430 * Math.sqrt(complexWords * (30 / sentenceCount)) + 3.1291
    : null;

  return {
    wordCount,
    sentenceCount,
    avgWordsPerSentence: avgWordsPerSentence.toFixed(1),
    avgSyllablesPerWord: avgSyllablesPerWord.toFixed(2),
    complexWords,
    complexPct: ((complexWords / wordCount) * 100).toFixed(1),
    fleschEase: Math.max(0, Math.min(100, fleschEase)),
    fleschKincaid: Math.max(0, fleschKincaid),
    gunningFog: Math.max(0, gunningFog),
    colemanLiau: Math.max(0, colemanLiau),
    smog,
  };
}

function fleschLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Very Easy", color: "text-green-500" };
  if (score >= 60) return { label: "Easy", color: "text-green-500" };
  if (score >= 40) return { label: "Moderate", color: "text-yellow-500" };
  if (score >= 20) return { label: "Difficult", color: "text-orange-500" };
  return { label: "Very Difficult", color: "text-red-500" };
}

function GaugeBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-2.5 w-full rounded-full bg-muted">
      <div className={`h-2.5 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function ReadabilityScorePage() {
  const [text, setText] = useState("");
  const result = useMemo(() => analyze(text), [text]);
  const flesch = result ? fleschLabel(result.fleschEase) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Readability Score</h1>

      <Card>
        <CardContent className="pt-6">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your content here to analyze readability..."
            className="min-h-[200px] text-base"
          />
        </CardContent>
      </Card>

      {result && (
        <>
          {/* Main score */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-5 pb-4 text-center">
                <div className={`text-4xl font-bold ${flesch!.color}`}>
                  {result.fleschEase.toFixed(0)}
                </div>
                <div className="mt-1 text-sm font-medium">{flesch!.label}</div>
                <div className="text-xs text-muted-foreground">Flesch Reading Ease</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4 text-center">
                <div className="text-4xl font-bold">{result.fleschKincaid.toFixed(1)}</div>
                <div className="mt-1 text-xs text-muted-foreground">Grade Level (F-K)</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4 text-center">
                <div className="text-4xl font-bold">{result.gunningFog.toFixed(1)}</div>
                <div className="mt-1 text-xs text-muted-foreground">Gunning Fog Index</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4 text-center">
                <div className="text-4xl font-bold">{result.colemanLiau.toFixed(1)}</div>
                <div className="mt-1 text-xs text-muted-foreground">Coleman-Liau Index</div>
              </CardContent>
            </Card>
          </div>

          {/* Details */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Text Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Words", value: result.wordCount },
                  { label: "Sentences", value: result.sentenceCount },
                  { label: "Avg words/sentence", value: result.avgWordsPerSentence },
                  { label: "Avg syllables/word", value: result.avgSyllablesPerWord },
                  { label: "Complex words (3+ syllables)", value: `${result.complexWords} (${result.complexPct}%)` },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium">{row.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Score Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Flesch Reading Ease</span>
                    <span className="font-medium">{result.fleschEase.toFixed(0)}/100</span>
                  </div>
                  <GaugeBar value={result.fleschEase} max={100} color="bg-green-500" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Flesch-Kincaid Grade</span>
                    <span className="font-medium">{result.fleschKincaid.toFixed(1)}</span>
                  </div>
                  <GaugeBar value={result.fleschKincaid} max={18} color="bg-blue-500" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Gunning Fog</span>
                    <span className="font-medium">{result.gunningFog.toFixed(1)}</span>
                  </div>
                  <GaugeBar value={result.gunningFog} max={20} color="bg-orange-500" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Coleman-Liau</span>
                    <span className="font-medium">{result.colemanLiau.toFixed(1)}</span>
                  </div>
                  <GaugeBar value={result.colemanLiau} max={18} color="bg-purple-500" />
                </div>
                {result.smog && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>SMOG</span>
                      <span className="font-medium">{result.smog.toFixed(1)}</span>
                    </div>
                    <GaugeBar value={result.smog} max={18} color="bg-teal-500" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Audience guide */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audience Guide</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "General public", target: "6-8", ok: result.fleschKincaid <= 8 },
                  { label: "Blog / marketing", target: "7-9", ok: result.fleschKincaid <= 9 },
                  { label: "Business", target: "10-12", ok: result.fleschKincaid >= 8 && result.fleschKincaid <= 12 },
                  { label: "Academic", target: "12-16", ok: result.fleschKincaid >= 12 },
                ].map((aud) => (
                  <Badge key={aud.label} variant={aud.ok ? "default" : "outline"}>
                    {aud.label} (Grade {aud.target})
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
