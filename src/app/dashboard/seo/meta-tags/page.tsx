"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export default function MetaTagsPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [siteName, setSiteName] = useState("");

  const titleLen = title.length;
  const descLen = description.length;

  function generateCode() {
    const lines = [
      `<title>${title}</title>`,
      `<meta name="description" content="${description}" />`,
      "",
      `<!-- Open Graph -->`,
      `<meta property="og:title" content="${title}" />`,
      `<meta property="og:description" content="${description}" />`,
      `<meta property="og:type" content="website" />`,
      url && `<meta property="og:url" content="${url}" />`,
      siteName && `<meta property="og:site_name" content="${siteName}" />`,
      "",
      `<!-- Twitter -->`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${title}" />`,
      `<meta name="twitter:description" content="${description}" />`,
    ].filter(Boolean);
    return lines.join("\n");
  }

  function handleCopy() {
    navigator.clipboard.writeText(generateCode());
    toast.success("Meta tags copied");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Meta Tag Previewer</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit Tags</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Title</Label>
                <Badge variant={titleLen > 60 ? "destructive" : "secondary"}>
                  {titleLen}/60
                </Badge>
              </div>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Your page title"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Description</Label>
                <Badge variant={descLen > 160 ? "destructive" : "secondary"}>
                  {descLen}/160
                </Badge>
              </div>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A compelling description of your page..."
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/page"
              />
            </div>

            <div className="space-y-2">
              <Label>Site Name</Label>
              <Input
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="My Website"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Google preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Google Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 rounded-lg border p-4">
                <div className="text-xs text-muted-foreground truncate">
                  {url || "https://example.com"}
                </div>
                <div className="text-lg font-medium text-blue-600 dark:text-blue-400 line-clamp-1">
                  {title || "Page Title"}
                </div>
                <div className="text-sm text-muted-foreground line-clamp-2">
                  {description || "Your meta description will appear here..."}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Social preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Social Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <div className="aspect-video bg-muted flex items-center justify-center text-muted-foreground text-sm">
                  og:image preview
                </div>
                <div className="p-3 space-y-1">
                  <div className="text-xs uppercase text-muted-foreground">
                    {siteName || "example.com"}
                  </div>
                  <div className="font-medium line-clamp-1">
                    {title || "Page Title"}
                  </div>
                  <div className="text-sm text-muted-foreground line-clamp-2">
                    {description || "Your description here..."}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Generated code */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Generated Code</CardTitle>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="mr-1 h-4 w-4" />
                Copy
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 text-xs leading-relaxed">
                {generateCode()}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
