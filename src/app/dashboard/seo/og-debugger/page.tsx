"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, Search } from "lucide-react";
import { toast } from "sonner";

interface OgData {
  url: string;
  title: string | null;
  metaDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterCard: string | null;
  twitterTitle: string | null;
  canonical: string | null;
}

export default function OgDebuggerPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OgData | null>(null);

  async function handleFetch(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setData(null);

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed");
        return;
      }
      setData(json);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Open Graph Debugger</h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleFetch} className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter a URL to debug..."
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              {loading ? "Fetching..." : "Debug"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      )}

      {data && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Facebook / Generic OG */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Facebook / LinkedIn Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                {data.ogImage ? (
                  <img
                    src={data.ogImage}
                    alt="OG preview"
                    className="aspect-video w-full object-cover bg-muted"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-muted text-sm text-muted-foreground">
                    No og:image found
                  </div>
                )}
                <div className="p-3 space-y-1">
                  <div className="text-xs uppercase text-muted-foreground">
                    {data.url.replace(/^https?:\/\//, "").split("/")[0]}
                  </div>
                  <div className="font-semibold line-clamp-2">
                    {data.ogTitle || data.title || "No title"}
                  </div>
                  <div className="text-sm text-muted-foreground line-clamp-2">
                    {data.ogDescription || data.metaDescription || "No description"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Twitter */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Twitter / X Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-xl border">
                {data.ogImage ? (
                  <img
                    src={data.ogImage}
                    alt="Twitter preview"
                    className={`w-full object-cover bg-muted ${data.twitterCard === "summary" ? "aspect-square max-h-32" : "aspect-video"}`}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-muted text-sm text-muted-foreground">
                    No image found
                  </div>
                )}
                <div className="p-3 space-y-0.5">
                  <div className="font-semibold line-clamp-1">
                    {data.twitterTitle || data.ogTitle || data.title || "No title"}
                  </div>
                  <div className="text-sm text-muted-foreground line-clamp-2">
                    {data.ogDescription || data.metaDescription || "No description"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {data.url.replace(/^https?:\/\//, "").split("/")[0]}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Google */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Google Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 rounded-lg border p-4">
                <div className="text-xs text-muted-foreground truncate">
                  {data.canonical || data.url}
                </div>
                <div className="text-lg font-medium text-blue-600 dark:text-blue-400 line-clamp-1">
                  {data.title || "No title tag"}
                </div>
                <div className="text-sm text-muted-foreground line-clamp-2">
                  {data.metaDescription || "No meta description found"}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Raw tags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Raw Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "title", value: data.title },
                { label: "meta description", value: data.metaDescription },
                { label: "og:title", value: data.ogTitle },
                { label: "og:description", value: data.ogDescription },
                { label: "og:image", value: data.ogImage },
                { label: "twitter:card", value: data.twitterCard },
                { label: "twitter:title", value: data.twitterTitle },
                { label: "canonical", value: data.canonical },
              ].map((tag) => (
                <div key={tag.label} className="flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                    {tag.label}
                  </Badge>
                  <span className="text-sm break-all">
                    {tag.value || <span className="text-muted-foreground/50">missing</span>}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
