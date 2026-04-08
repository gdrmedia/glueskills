"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const spamWords = [
  "free", "act now", "limited time", "click here", "buy now", "order now",
  "don't miss", "urgent", "congratulations", "winner", "cash", "discount",
  "earn money", "no cost", "risk free", "guarantee", "100%", "!!!",
  "all caps", "make money", "double your", "lowest price",
];

const powerWords = [
  "you", "new", "how", "why", "discover", "introducing", "exclusive",
  "breaking", "insider", "secret", "proven", "results", "transform",
  "unlock", "revealed", "guide", "update", "alert", "finally",
];

const urgencyWords = [
  "now", "today", "hurry", "last chance", "ending soon", "deadline",
  "limited", "only", "before", "don't wait", "expires", "final",
];

function analyzeSubject(subject: string) {
  const trimmed = subject.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  const words = lower.split(/\s+/);
  const charCount = trimmed.length;
  const wordCount = words.length;

  // Scores
  let score = 50;
  const issues: string[] = [];
  const wins: string[] = [];

  // Length (ideal: 30-50 chars)
  if (charCount >= 30 && charCount <= 50) {
    score += 15;
    wins.push("Good length (30-50 chars) — fits most mobile screens");
  } else if (charCount < 30) {
    score += 5;
    issues.push("A bit short — try 30-50 characters for better open rates");
  } else if (charCount <= 70) {
    score += 5;
    issues.push("Slightly long — may get cut off on mobile");
  } else {
    score -= 10;
    issues.push("Too long — will be truncated on most email clients");
  }

  // Spam words
  const foundSpam = spamWords.filter((w) => lower.includes(w));
  if (foundSpam.length === 0) {
    score += 10;
    wins.push("No spam trigger words detected");
  } else {
    score -= foundSpam.length * 5;
    issues.push(`Spam triggers found: ${foundSpam.join(", ")}`);
  }

  // Power words
  const foundPower = powerWords.filter((w) => words.includes(w));
  if (foundPower.length > 0) {
    score += Math.min(foundPower.length * 5, 15);
    wins.push(`Power words: ${foundPower.join(", ")}`);
  } else {
    issues.push("No power words — try adding \"you\", \"new\", or \"discover\"");
  }

  // Urgency
  const foundUrgency = urgencyWords.filter((w) => lower.includes(w));
  if (foundUrgency.length > 0) {
    score += 5;
    wins.push(`Creates urgency: ${foundUrgency.join(", ")}`);
  }

  // Personalization brackets
  if (/\{.*?\}/.test(trimmed) || trimmed.toLowerCase().includes("you")) {
    score += 5;
    wins.push("Contains personalization");
  }

  // ALL CAPS check
  if (trimmed === trimmed.toUpperCase() && charCount > 3) {
    score -= 15;
    issues.push("ALL CAPS looks like spam — use sentence case");
  }

  // Emoji check (slight boost)
  if (/\p{Emoji_Presentation}/u.test(trimmed)) {
    score += 3;
    wins.push("Emoji can boost open rates (use sparingly)");
  }

  // Question mark
  if (trimmed.includes("?")) {
    score += 5;
    wins.push("Questions drive curiosity and opens");
  }

  // Number
  if (/\d/.test(trimmed)) {
    score += 5;
    wins.push("Numbers add specificity and credibility");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    charCount,
    wordCount,
    foundSpam,
    foundPower,
    foundUrgency,
    issues,
    wins,
  };
}

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 70 ? "text-green-500" : score >= 40 ? "text-yellow-500" : "text-red-500";
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

export default function EmailSubjectTesterPage() {
  const [subject, setSubject] = useState("");
  const result = useMemo(() => analyzeSubject(subject), [subject]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Email Subject Line Tester</h1>

      <Card>
        <CardContent className="pt-6">
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Type your email subject line..."
            className="text-lg"
          />
          {subject && (
            <div className="mt-2 flex gap-2">
              <Badge variant="secondary">{result?.charCount ?? 0} chars</Badge>
              <Badge variant="secondary">{result?.wordCount ?? 0} words</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {subject && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inbox Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/20" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Your Brand</span>
                    <span className="text-xs text-muted-foreground">10:30 AM</span>
                  </div>
                  <div className="font-medium truncate">{subject}</div>
                  <div className="text-sm text-muted-foreground truncate">
                    Preview text would appear here showing the first line of the email body...
                  </div>
                </div>
              </div>
            </div>
            {/* Mobile truncation preview */}
            <div className="mt-3 text-xs text-muted-foreground">
              Mobile (41 chars): <span className="font-mono">{subject.slice(0, 41)}{subject.length > 41 ? "..." : ""}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Desktop (70 chars): <span className="font-mono">{subject.slice(0, 70)}{subject.length > 70 ? "..." : ""}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          <Card>
            <CardContent className="flex flex-col items-center pt-6">
              <ScoreCircle score={result.score} />
              <p className="mt-2 text-sm font-medium">
                {result.score >= 70 ? "Strong subject line!" : result.score >= 40 ? "Decent — room to improve" : "Needs work"}
              </p>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {result.wins.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-green-500">What&apos;s working</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm">
                    {result.wins.map((w, i) => (
                      <li key={i} className="flex gap-2"><span className="text-green-500">+</span> {w}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {result.issues.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-yellow-500">Suggestions</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm">
                    {result.issues.map((w, i) => (
                      <li key={i} className="flex gap-2"><span className="text-yellow-500">!</span> {w}</li>
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
