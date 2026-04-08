"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const powerWords = [
  "free", "new", "proven", "secret", "amazing", "discover", "guaranteed",
  "instant", "exclusive", "ultimate", "powerful", "easy", "best", "how",
  "why", "now", "today", "limited", "save", "boost", "transform",
  "essential", "simple", "fast", "shocking", "incredible", "hack",
  "mistake", "avoid", "never", "always", "top", "must", "need",
];

const emotionalWords = [
  "love", "fear", "hate", "happy", "sad", "angry", "beautiful",
  "horrible", "amazing", "terrible", "wonderful", "awful", "brilliant",
  "stunning", "breathtaking", "heartbreaking", "inspiring", "devastating",
];

function analyzeHeadline(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const words = trimmed.toLowerCase().split(/\s+/);
  const wordCount = words.length;

  // Length score (ideal: 6-12 words)
  let lengthScore = 0;
  if (wordCount >= 6 && wordCount <= 12) lengthScore = 30;
  else if (wordCount >= 4 && wordCount <= 15) lengthScore = 20;
  else lengthScore = 10;

  // Power words
  const foundPower = words.filter((w) => powerWords.includes(w));
  const powerScore = Math.min(foundPower.length * 10, 25);

  // Emotional words
  const foundEmotional = words.filter((w) => emotionalWords.includes(w));
  const emotionalScore = Math.min(foundEmotional.length * 10, 15);

  // Starts with number
  const startsWithNumber = /^\d/.test(trimmed) ? 10 : 0;

  // Has a question or exclamation
  const punctuationScore = /[?!]$/.test(trimmed) ? 10 : 0;

  // Character length (ideal: 50-70)
  const charLen = trimmed.length;
  let charScore = 0;
  if (charLen >= 50 && charLen <= 70) charScore = 10;
  else if (charLen >= 30 && charLen <= 90) charScore = 5;

  const total = Math.min(
    lengthScore + powerScore + emotionalScore + startsWithNumber + punctuationScore + charScore,
    100
  );

  return {
    score: total,
    wordCount,
    charCount: charLen,
    foundPower,
    foundEmotional,
    startsWithNumber: startsWithNumber > 0,
    hasPunctuation: punctuationScore > 0,
    tips: [
      ...(wordCount < 6 ? ["Try making the headline longer (6-12 words is ideal)"] : []),
      ...(wordCount > 12 ? ["Consider shortening — under 12 words performs better"] : []),
      ...(foundPower.length === 0 ? ["Add a power word like \"proven\", \"essential\", or \"free\""] : []),
      ...(foundEmotional.length === 0 ? ["Consider adding an emotional trigger word"] : []),
      ...(!startsWithNumber ? ["Headlines starting with numbers get more clicks"] : []),
      ...(!punctuationScore ? ["Try ending with a question mark or exclamation"] : []),
      ...(charLen > 70 ? ["Keep under 70 characters for better display on search engines"] : []),
    ],
  };
}

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 70 ? "text-green-500" : score >= 40 ? "text-yellow-500" : "text-red-500";
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
        <circle
          cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${color} transition-all duration-500`}
        />
      </svg>
      <span className={`absolute text-2xl font-bold ${color}`}>{score}</span>
    </div>
  );
}

export default function HeadlineAnalyzerPage() {
  const [headline, setHeadline] = useState("");
  const analysis = useMemo(() => analyzeHeadline(headline), [headline]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Headline Analyzer</h1>

      <Card>
        <CardContent className="pt-6">
          <Input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Type your headline here..."
            className="text-lg"
          />
        </CardContent>
      </Card>

      {analysis && (
        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          <Card>
            <CardContent className="flex flex-col items-center pt-6">
              <ScoreRing score={analysis.score} />
              <p className="mt-2 text-sm font-medium">
                {analysis.score >= 70 ? "Great headline!" : analysis.score >= 40 ? "Good start" : "Needs work"}
              </p>
              <div className="mt-3 flex gap-2">
                <Badge variant="secondary">{analysis.wordCount} words</Badge>
                <Badge variant="secondary">{analysis.charCount} chars</Badge>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Found Keywords</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {analysis.foundPower.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Power:</span>
                    {analysis.foundPower.map((w) => (
                      <Badge key={w} variant="default">{w}</Badge>
                    ))}
                  </div>
                )}
                {analysis.foundEmotional.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Emotional:</span>
                    {analysis.foundEmotional.map((w) => (
                      <Badge key={w}>{w}</Badge>
                    ))}
                  </div>
                )}
                {analysis.startsWithNumber && (
                  <Badge variant="secondary">Starts with number</Badge>
                )}
                {analysis.hasPunctuation && (
                  <Badge variant="secondary">Has ending punctuation</Badge>
                )}
              </CardContent>
            </Card>

            {analysis.tips.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Suggestions</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {analysis.tips.map((tip, i) => (
                      <li key={i} className="flex gap-2">
                        <span>•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
