"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, Search, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface ScrapeResult {
  url: string;
  title: string | null;
  metaDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterCard: string | null;
  twitterTitle: string | null;
  canonical: string | null;
  headings: { tag: string; text: string }[];
  linkCount: number;
  imageCount: number;
  imagesWithoutAlt: number;
  htmlSize: number;
}

function Issue({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
      )}
      <span className={ok ? "text-muted-foreground" : ""}>{label}</span>
    </div>
  );
}

export default function WebScraperPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);

  async function handleScrape(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to scrape");
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
      <h1 className="text-2xl font-bold tracking-tight">Web Scraper</h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleScrape} className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter a URL to analyze..."
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              {loading ? "Scraping..." : "Scrape"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-48" />
        </div>
      )}

      {result && (
        <>
          {/* Quick checks */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SEO Quick Check</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Issue ok={!!result.title} label={result.title ? `Title: "${result.title}"` : "Missing <title> tag"} />
              <Issue
                ok={!!result.title && result.title.length <= 60}
                label={result.title ? `Title length: ${result.title.length} chars ${result.title.length > 60 ? "(over 60)" : "(good)"}` : "No title to check"}
              />
              <Issue ok={!!result.metaDescription} label={result.metaDescription ? `Meta description: ${result.metaDescription.length} chars` : "Missing meta description"} />
              <Issue
                ok={!!result.metaDescription && result.metaDescription.length <= 160}
                label={result.metaDescription && result.metaDescription.length > 160 ? "Meta description over 160 chars" : "Meta description length OK"}
              />
              <Issue ok={!!result.ogTitle} label={result.ogTitle ? "OG title present" : "Missing og:title"} />
              <Issue ok={!!result.ogDescription} label={result.ogDescription ? "OG description present" : "Missing og:description"} />
              <Issue ok={!!result.ogImage} label={result.ogImage ? "OG image present" : "Missing og:image"} />
              <Issue ok={!!result.canonical} label={result.canonical ? `Canonical: ${result.canonical}` : "No canonical URL"} />
              <Issue ok={result.imagesWithoutAlt === 0} label={`${result.imagesWithoutAlt} images missing alt text (${result.imageCount} total)`} />
            </CardContent>
          </Card>

          {/* Meta tags */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Meta Tags</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Title", value: result.title },
                  { label: "Description", value: result.metaDescription },
                  { label: "OG Title", value: result.ogTitle },
                  { label: "OG Description", value: result.ogDescription },
                  { label: "OG Image", value: result.ogImage },
                  { label: "Twitter Card", value: result.twitterCard },
                  { label: "Canonical", value: result.canonical },
                ].map((tag) => (
                  <div key={tag.label}>
                    <div className="text-xs font-medium text-muted-foreground">
                      {tag.label}
                    </div>
                    <div className="text-sm">
                      {tag.value || <span className="text-muted-foreground/50">Not found</span>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Page Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold">{result.linkCount}</div>
                    <div className="text-xs text-muted-foreground">Links</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold">{result.imageCount}</div>
                    <div className="text-xs text-muted-foreground">Images</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold">{result.headings.length}</div>
                    <div className="text-xs text-muted-foreground">Headings</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold">{result.htmlSize} KB</div>
                    <div className="text-xs text-muted-foreground">HTML Size</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Headings */}
          {result.headings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Heading Structure</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {result.headings.map((h, i) => {
                    const indent = (parseInt(h.tag[1]) - 1) * 16;
                    return (
                      <div key={i} className="flex items-center gap-2 text-sm" style={{ paddingLeft: indent }}>
                        <Badge variant="outline" className="shrink-0 font-mono text-xs">
                          {h.tag}
                        </Badge>
                        <span className="truncate">{h.text}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
