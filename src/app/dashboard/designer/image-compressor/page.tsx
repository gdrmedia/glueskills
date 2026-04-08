"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileImage,
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Quality = "high" | "medium" | "low";
const QUALITY_VALUES: Record<Quality, number> = {
  high: 0.85,
  medium: 0.72,
  low: 0.55,
};

type OutputFormat = "webp" | "jpeg" | "original";

type FileEntry = {
  id: string;
  name: string;
  originalType: string;
  originalSize: number;
  compressedBlob: Blob | null;
  compressedSize: number;
  outputType: string;
  status: "compressing" | "done" | "error";
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveOutputType(inputType: string, format: OutputFormat): string {
  if (format === "webp") return "image/webp";
  if (format === "jpeg") return "image/jpeg";
  // "original" — keep input format
  return inputType === "image/png"
    ? "image/png"
    : inputType === "image/webp"
    ? "image/webp"
    : "image/jpeg";
}

async function compressImage(
  file: File,
  quality: number,
  format: OutputFormat
): Promise<{ blob: Blob; outputType: string }> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const outputType = resolveOutputType(file.type, format);

  // PNG is lossless in canvas — quality param is ignored by browsers
  const qualityArg = outputType === "image/png" ? undefined : quality;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve({ blob, outputType });
        else reject(new Error("Compression failed"));
      },
      outputType,
      qualityArg
    );
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function savingsPct(original: number, compressed: number): number {
  return Math.round((1 - compressed / original) * 100);
}

function outputExtension(mimeType: string): string {
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/png") return "png";
  return "jpg";
}

const FORMAT_LABELS: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImageCompressorPage() {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [quality, setQuality] = useState<Quality>("medium");
  const [format, setFormat] = useState<OutputFormat>("webp");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (files: File[]) => {
      const images = files
        .filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type))
        .slice(0, 20);
      if (!images.length) return;

      const newEntries: FileEntry[] = images.map((f) => ({
        id: `${f.name}-${Date.now()}-${Math.random()}`,
        name: f.name,
        originalType: f.type,
        originalSize: f.size,
        compressedBlob: null,
        compressedSize: 0,
        outputType: "",
        status: "compressing",
      }));

      setEntries((prev) => [...prev, ...newEntries]);

      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        const entry = newEntries[i];
        try {
          const { blob, outputType } = await compressImage(
            file,
            QUALITY_VALUES[quality],
            format
          );
          setEntries((prev) =>
            prev.map((e) =>
              e.id === entry.id
                ? {
                    ...e,
                    compressedBlob: blob,
                    compressedSize: blob.size,
                    outputType,
                    status: "done",
                  }
                : e
            )
          );
        } catch {
          setEntries((prev) =>
            prev.map((e) =>
              e.id === entry.id ? { ...e, status: "error" } : e
            )
          );
        }
      }
    },
    [quality, format]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      processFiles(Array.from(e.dataTransfer.files));
    },
    [processFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) processFiles(Array.from(e.target.files));
      e.target.value = "";
    },
    [processFiles]
  );

  const downloadEntry = (entry: FileEntry) => {
    if (!entry.compressedBlob) return;
    const ext = outputExtension(entry.outputType);
    const base = entry.name.replace(/\.[^.]+$/, "");
    const url = URL.createObjectURL(entry.compressedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}-compressed.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    entries
      .filter((e) => e.status === "done")
      .forEach((e) => downloadEntry(e));
  };

  const doneCount = entries.filter((e) => e.status === "done").length;
  const totalSaved = entries
    .filter((e) => e.status === "done")
    .reduce((acc, e) => acc + (e.originalSize - e.compressedSize), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Image Compressor</h1>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        className={`flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node))
            setDragging(false);
        }}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
      >
        <FileImage
          className={`mb-3 h-12 w-12 transition-colors ${
            dragging ? "text-primary" : "text-muted-foreground"
          }`}
        />
        <p className="text-base font-semibold">
          {dragging ? "Drop to compress" : "Drop images or click to upload"}
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          PNG, JPG, WebP &middot; Up to 20 files at once
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      {/* Options row */}
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Output:</span>
          <div className="flex rounded-lg border">
            {(
              [
                { key: "webp", label: "WebP" },
                { key: "jpeg", label: "JPEG" },
                { key: "original", label: "Original" },
              ] as const
            ).map(({ key, label }, i) => (
              <button
                key={key}
                onClick={() => setFormat(key)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  i === 0 ? "rounded-l-[calc(theme(borderRadius.lg)-1px)]" : ""
                } ${
                  i === 2 ? "rounded-r-[calc(theme(borderRadius.lg)-1px)]" : ""
                } ${
                  format === key
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                } ${i > 0 ? "border-l" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Quality:</span>
          <div className="flex rounded-lg border">
            {(["high", "medium", "low"] as Quality[]).map((q, i) => (
              <button
                key={q}
                onClick={() => setQuality(q)}
                className={`px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  i === 0 ? "rounded-l-[calc(theme(borderRadius.lg)-1px)]" : ""
                } ${
                  i === 2 ? "rounded-r-[calc(theme(borderRadius.lg)-1px)]" : ""
                } ${
                  quality === q
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                } ${i > 0 ? "border-l" : ""}`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {format === "original" && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            PNG images won&apos;t compress much in original format — use WebP
            or JPEG for better results
          </p>
        )}
      </div>

      {/* Results */}
      {entries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">
                {doneCount > 0 ? (
                  <span>
                    Compressed {doneCount}{" "}
                    {doneCount === 1 ? "image" : "images"} &mdash; saved{" "}
                    <span className="text-green-600 dark:text-green-400">
                      {formatBytes(totalSaved)}
                    </span>
                  </span>
                ) : (
                  "Processing…"
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {doneCount > 1 && (
                  <Button size="sm" variant="outline" onClick={downloadAll}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Download all
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEntries([])}
                >
                  Clear
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {entries.map((entry) => {
              const pct =
                entry.status === "done"
                  ? savingsPct(entry.originalSize, entry.compressedSize)
                  : 0;

              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded-lg border px-4 py-3"
                >
                  {/* Status */}
                  <div className="shrink-0">
                    {entry.status === "compressing" && (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    )}
                    {entry.status === "done" && (
                      <CheckCircle2
                        className={`h-5 w-5 ${
                          pct > 0 ? "text-green-500" : "text-muted-foreground"
                        }`}
                      />
                    )}
                    {entry.status === "error" && (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    )}
                  </div>

                  {/* File name + format */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {entry.name}
                      </p>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {FORMAT_LABELS[entry.originalType] ?? "IMG"}
                      </Badge>
                      {entry.status === "done" &&
                        entry.outputType !== entry.originalType && (
                          <>
                            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <Badge
                              variant="secondary"
                              className="shrink-0 text-xs"
                            >
                              {FORMAT_LABELS[entry.outputType] ?? "IMG"}
                            </Badge>
                          </>
                        )}
                    </div>

                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      {entry.status === "compressing" && (
                        <span>Compressing…</span>
                      )}
                      {entry.status === "done" && (
                        <>
                          <span>{formatBytes(entry.originalSize)}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span>{formatBytes(entry.compressedSize)}</span>
                          {pct > 0 ? (
                            <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/10 dark:text-green-400">
                              -{pct}%
                            </Badge>
                          ) : (
                            <Badge variant="secondary">no change</Badge>
                          )}
                        </>
                      )}
                      {entry.status === "error" && (
                        <span className="text-destructive">
                          Failed — unsupported image
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    {entry.status === "done" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadEntry(entry)}
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Download
                      </Button>
                    )}
                    <button
                      onClick={() =>
                        setEntries((prev) =>
                          prev.filter((e) => e.id !== entry.id)
                        )
                      }
                      className="ml-1 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
