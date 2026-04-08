"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";

const pairings = [
  { heading: "Playfair Display", body: "Source Sans 3", vibe: "Editorial" },
  { heading: "Montserrat", body: "Open Sans", vibe: "Clean" },
  { heading: "Raleway", body: "Lato", vibe: "Modern" },
  { heading: "Oswald", body: "Merriweather", vibe: "Bold" },
  { heading: "Poppins", body: "Inter", vibe: "Friendly" },
  { heading: "DM Serif Display", body: "DM Sans", vibe: "Elegant" },
  { heading: "Space Grotesk", body: "Space Mono", vibe: "Tech" },
  { heading: "Bitter", body: "Outfit", vibe: "Warm" },
  { heading: "Archivo", body: "Libre Franklin", vibe: "Neutral" },
  { heading: "Fraunces", body: "Commissioner", vibe: "Craft" },
  { heading: "Sora", body: "Noto Sans", vibe: "Minimal" },
  { heading: "Bebas Neue", body: "Roboto", vibe: "Impact" },
];

function loadGoogleFont(family: string) {
  const id = `gf-${family.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}

export default function FontPairerPage() {
  const [selected, setSelected] = useState(0);
  const [headingText, setHeadingText] = useState("The quick brown fox jumps over the lazy dog");
  const [bodyText, setBodyText] = useState(
    "Typography is the art and technique of arranging type to make written language legible, readable, and appealing when displayed. Good typography enhances the reading experience and strengthens the visual hierarchy of a page."
  );

  const pair = pairings[selected];

  useEffect(() => {
    loadGoogleFont(pair.heading);
    loadGoogleFont(pair.body);
  }, [pair]);

  function randomize() {
    let next = selected;
    while (next === selected) {
      next = Math.floor(Math.random() * pairings.length);
    }
    setSelected(next);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Font Pairer</h1>
        <Button variant="outline" size="sm" onClick={randomize}>
          <RefreshCw className="mr-1 h-4 w-4" />
          Shuffle
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pairings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {pairings.map((p, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  selected === i ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                }`}
              >
                <div>
                  <div className="font-medium">{p.heading}</div>
                  <div className={selected === i ? "text-primary-foreground/70" : "text-muted-foreground"}>
                    {p.body}
                  </div>
                </div>
                <Badge variant={selected === i ? "secondary" : "outline"} className="text-[10px]">
                  {p.vibe}
                </Badge>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  {pair.heading} — Heading
                </div>
                <h2
                  className="text-4xl font-bold leading-tight"
                  style={{ fontFamily: `'${pair.heading}', sans-serif` }}
                >
                  {headingText}
                </h2>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  {pair.body} — Body
                </div>
                <p
                  className="text-base leading-relaxed text-muted-foreground"
                  style={{ fontFamily: `'${pair.body}', sans-serif` }}
                >
                  {bodyText}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Size scale preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Type Scale</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "H1", size: "2.5rem", weight: 700, font: pair.heading },
                { label: "H2", size: "2rem", weight: 700, font: pair.heading },
                { label: "H3", size: "1.5rem", weight: 700, font: pair.heading },
                { label: "H4", size: "1.25rem", weight: 700, font: pair.heading },
                { label: "Body", size: "1rem", weight: 400, font: pair.body },
                { label: "Small", size: "0.875rem", weight: 400, font: pair.body },
                { label: "Caption", size: "0.75rem", weight: 400, font: pair.body },
              ].map((row) => (
                <div key={row.label} className="flex items-baseline gap-4">
                  <span className="w-14 shrink-0 text-xs text-muted-foreground">{row.label}</span>
                  <span
                    style={{
                      fontFamily: `'${row.font}', sans-serif`,
                      fontSize: row.size,
                      fontWeight: row.weight,
                    }}
                  >
                    {headingText.split(" ").slice(0, 6).join(" ")}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Custom Text</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Heading Preview</Label>
                <Textarea
                  value={headingText}
                  onChange={(e) => setHeadingText(e.target.value)}
                  className="min-h-[60px]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Body Preview</Label>
                <Textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
