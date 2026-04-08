"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageDown, Lock, Unlock, Download } from "lucide-react";

export default function ImageResizerPage() {
  const [image, setImage] = useState<string | null>(null);
  const [originalSize, setOriginalSize] = useState({ w: 0, h: 0 });
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [lockAspect, setLockAspect] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        setOriginalSize({ w: img.width, h: img.height });
        setWidth(img.width);
        setHeight(img.height);
        setImage(ev.target?.result as string);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  function handleWidth(val: number) {
    setWidth(val);
    if (lockAspect && originalSize.w > 0) {
      setHeight(Math.round((val / originalSize.w) * originalSize.h));
    }
  }

  function handleHeight(val: number) {
    setHeight(val);
    if (lockAspect && originalSize.h > 0) {
      setWidth(Math.round((val / originalSize.h) * originalSize.w));
    }
  }

  function handleDownload() {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    const img = new window.Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      const link = document.createElement("a");
      link.download = `resized-${width}x${height}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = image;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Image Resizer</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload Image</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary/50"
              onClick={() => fileRef.current?.click()}
            >
              {image ? (
                <img
                  src={image}
                  alt="Preview"
                  className="max-h-64 rounded object-contain"
                />
              ) : (
                <>
                  <ImageDown className="mb-2 h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload an image
                  </p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
              />
            </div>
            {originalSize.w > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  Original: {originalSize.w} x {originalSize.h}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resize</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor="width">Width (px)</Label>
                <Input
                  id="width"
                  type="number"
                  value={width || ""}
                  onChange={(e) => handleWidth(Number(e.target.value))}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="mb-0.5"
                onClick={() => setLockAspect(!lockAspect)}
              >
                {lockAspect ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Unlock className="h-4 w-4" />
                )}
              </Button>
              <div className="space-y-2">
                <Label htmlFor="height">Height (px)</Label>
                <Input
                  id="height"
                  type="number"
                  value={height || ""}
                  onChange={(e) => handleHeight(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { label: "1080p", w: 1920, h: 1080 },
                { label: "720p", w: 1280, h: 720 },
                { label: "IG Post", w: 1080, h: 1080 },
                { label: "IG Story", w: 1080, h: 1920 },
                { label: "Twitter", w: 1200, h: 675 },
                { label: "Thumbnail", w: 1280, h: 720 },
              ].map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setWidth(preset.w);
                    setHeight(preset.h);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <Button
              className="w-full"
              disabled={!image || width <= 0 || height <= 0}
              onClick={handleDownload}
            >
              <Download className="mr-2 h-4 w-4" />
              Download {width}x{height}
            </Button>
          </CardContent>
        </Card>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
