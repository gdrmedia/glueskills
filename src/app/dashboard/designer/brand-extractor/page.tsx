"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Globe,
  Search,
  Copy,
  Check,
  Image as ImageIcon,
  Palette,
  Type,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface BrandResult {
  url: string;
  siteName: string | null;
  description: string | null;
  logos: { type: string; url: string }[];
  colors: string[];
  fonts: string[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function ColorSwatch({ color }: { color: string }) {
  return (
    <div className="group flex items-center gap-2 rounded-lg border p-2 transition-colors hover:bg-muted/50">
      <div
        className="h-10 w-10 shrink-0 rounded-md border shadow-sm"
        style={{ backgroundColor: color }}
      />
      <span className="min-w-0 flex-1 truncate font-mono text-sm">{color}</span>
      <CopyButton text={color} />
    </div>
  );
}

export default function BrandExtractorPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BrandResult | null>(null);

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/brand-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to extract brand assets");
        return;
      }

      setResult(data);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Brand Extractor</h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleExtract} className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter a website URL to extract brand assets..."
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              {loading ? "Extracting..." : "Extract"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-48" />
          <Skeleton className="h-32" />
        </div>
      )}

      {result && (
        <>
          {/* Site info */}
          {(result.siteName || result.description) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe className="h-4 w-4 text-purple-500" />
                  Site Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.siteName && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">
                      Site Name
                    </div>
                    <div className="text-sm font-medium">{result.siteName}</div>
                  </div>
                )}
                {result.description && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">
                      Description
                    </div>
                    <div className="text-sm">{result.description}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    URL
                  </div>
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-purple-500 hover:underline"
                  >
                    {result.url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Logos & Icons */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="h-4 w-4 text-purple-500" />
                Logos & Icons
                <Badge variant="outline" className="ml-auto font-mono text-xs">
                  {result.logos.length} found
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.logos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No logos or icons detected.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {result.logos.map((logo, i) => (
                    <div
                      key={i}
                      className="group flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex h-20 w-full items-center justify-center rounded-md bg-muted/30">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={logo.url}
                          alt={logo.type}
                          className="max-h-16 max-w-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                            (
                              e.target as HTMLImageElement
                            ).parentElement!.innerHTML =
                              '<span class="text-xs text-muted-foreground">Could not load</span>';
                          }}
                        />
                      </div>
                      <div className="flex w-full items-center justify-between gap-1">
                        <Badge
                          variant="outline"
                          className="shrink-0 text-xs"
                        >
                          {logo.type}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <CopyButton text={logo.url} />
                          <a
                            href={logo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title="Open in new tab"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Colors */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="h-4 w-4 text-purple-500" />
                Brand Colors
                <Badge variant="outline" className="ml-auto font-mono text-xs">
                  {result.colors.length} found
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.colors.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No brand colors detected in inline styles.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {result.colors.map((color, i) => (
                    <ColorSwatch key={i} color={color} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fonts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Type className="h-4 w-4 text-purple-500" />
                Fonts
                <Badge variant="outline" className="ml-auto font-mono text-xs">
                  {result.fonts.length} found
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.fonts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No custom fonts detected.
                </p>
              ) : (
                <div className="space-y-2">
                  {result.fonts.map((font, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">{font}</span>
                        <span
                          className="text-xs text-muted-foreground"
                          style={{ fontFamily: `"${font}", sans-serif` }}
                        >
                          The quick brown fox jumps over the lazy dog
                        </span>
                      </div>
                      <CopyButton text={font} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
