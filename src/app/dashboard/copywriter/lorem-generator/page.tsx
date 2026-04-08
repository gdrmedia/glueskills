"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const loremWords = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
  "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
  "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud",
  "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo",
  "consequat", "duis", "aute", "irure", "in", "reprehenderit", "voluptate",
  "velit", "esse", "cillum", "fugiat", "nulla", "pariatur", "excepteur", "sint",
  "occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui", "officia",
  "deserunt", "mollit", "anim", "id", "est", "laborum", "perspiciatis", "unde",
  "omnis", "iste", "natus", "error", "voluptatem", "accusantium", "doloremque",
  "laudantium", "totam", "rem", "aperiam", "eaque", "ipsa", "quae", "ab", "illo",
  "inventore", "veritatis", "quasi", "architecto", "beatae", "vitae", "dicta",
  "explicabo", "nemo", "ipsam", "quia", "voluptas", "aspernatur", "aut", "odit",
  "fugit", "consequuntur", "magni", "dolores", "eos", "ratione", "sequi", "nesciunt",
];

type OutputType = "paragraphs" | "sentences" | "words";

function generate(count: number, type: OutputType, seed: number): string {
  let rng = seed;
  function next() {
    rng = (rng * 16807 + 0) % 2147483647;
    return rng;
  }

  function pickWord() {
    return loremWords[next() % loremWords.length];
  }

  function makeSentence(minWords: number, maxWords: number) {
    const len = minWords + (next() % (maxWords - minWords + 1));
    const words = Array.from({ length: len }, pickWord);
    words[0] = words[0][0].toUpperCase() + words[0].slice(1);
    return words.join(" ") + ".";
  }

  function makeParagraph() {
    const sentCount = 3 + (next() % 4);
    return Array.from({ length: sentCount }, () => makeSentence(5, 15)).join(" ");
  }

  if (type === "words") {
    const words = Array.from({ length: count }, pickWord);
    words[0] = words[0][0].toUpperCase() + words[0].slice(1);
    return words.join(" ") + ".";
  }

  if (type === "sentences") {
    return Array.from({ length: count }, () => makeSentence(6, 14)).join(" ");
  }

  return Array.from({ length: count }, makeParagraph).join("\n\n");
}

export default function LoremGeneratorPage() {
  const [count, setCount] = useState(3);
  const [type, setType] = useState<OutputType>("paragraphs");
  const [seed, setSeed] = useState(42);
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => generate(count, type, seed), [count, type, seed]);

  function handleCopy() {
    navigator.clipboard.writeText(output);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Lorem Ipsum Generator</h1>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Count</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
                className="w-24"
              />
            </div>

            <div className="flex gap-2">
              {(["paragraphs", "sentences", "words"] as OutputType[]).map((t) => (
                <Badge
                  key={t}
                  variant={type === t ? "default" : "outline"}
                  className="cursor-pointer capitalize"
                  onClick={() => setType(t)}
                >
                  {t}
                </Badge>
              ))}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setSeed(Date.now())}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>

            <Button onClick={handleCopy}>
              {copied ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              Copy
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
            {output}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
