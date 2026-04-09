"use client";

import { useState, useRef, useCallback } from "react";
import {
  FileImage,
  Download,
  X,
  AlertCircle,
  Loader2,
  ArrowRight,
  SlidersHorizontal,
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
  thumbnailUrl: string;
  compressedBlob: Blob | null;
  compressedSize: number;
  outputType: string;
  status: "compressing" | "done" | "error";
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveOutputType(inputType: string, format: OutputFormat): string {
  if (format === "webp") return "image/webp";
  if (format === "jpeg") return "image/jpeg";
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
  "image/webp": "WEBP",
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
        thumbnailUrl: URL.createObjectURL(f),
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
                ? { ...e, compressedBlob: blob, compressedSize: blob.size, outputType, status: "done" }
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
    entries.filter((e) => e.status === "done").forEach((e) => downloadEntry(e));
  };

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const entry = prev.find((e) => e.id === id);
      if (entry?.thumbnailUrl) URL.revokeObjectURL(entry.thumbnailUrl);
      return prev.filter((e) => e.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setEntries((prev) => {
      prev.forEach((e) => URL.revokeObjectURL(e.thumbnailUrl));
      return [];
    });
  }, []);

  const doneCount = entries.filter((e) => e.status === "done").length;

  return (
    <div className="mx-auto max-w-3xl space-y-5">

      {/* ── Header ── */}
      <div className="text-center">
        <h1 className="mb-1 text-3xl font-extrabold tracking-tight">Compressor</h1>
        <p className="text-sm text-muted-foreground">
          Batch optimize your visual assets for the modern web.
        </p>
      </div>

      {/* ── Drop zone ── */}
      <div className="group relative">
        <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-primary/20 to-purple-300/20 opacity-25 blur transition duration-1000 group-hover:opacity-100" />
        <div
          role="button"
          tabIndex={0}
          className={`relative flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            dragging
              ? "border-primary bg-primary/5"
              : "border-border bg-background hover:border-primary/50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
          }}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
        >
          <div
            className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-md transition-colors ${
              dragging
                ? "bg-primary/10 shadow-primary/10"
                : "bg-purple-100 shadow-purple-100 dark:bg-purple-950 dark:shadow-purple-950"
            }`}
          >
            <FileImage
              className={`h-7 w-7 transition-colors ${
                dragging ? "text-primary" : "text-purple-600 dark:text-purple-400"
              }`}
            />
          </div>
          <p className="text-base font-bold">
            {dragging ? "Drop to compress" : "Drop images or click to upload"}
          </p>
          <p className="mt-1 max-w-xs text-center text-sm text-muted-foreground">
            Supports WEBP, JPEG, PNG and SVG. Max file size 50MB.
          </p>
          <button
            type="button"
            className="mt-5 rounded-full bg-foreground px-6 py-2 text-sm font-bold text-background transition-transform hover:scale-105 active:scale-95"
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
          >
            Select Files
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={handleInputChange}
          />
        </div>
      </div>

      {/* ── Settings card ── */}
      <div className="rounded-xl border bg-background px-5 py-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">Settings</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Output Format */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Output Format
            </label>
            <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted p-1">
              {(
                [
                  { key: "webp", label: "WebP" },
                  { key: "jpeg", label: "JPEG" },
                  { key: "original", label: "Original" },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFormat(key)}
                  className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                    format === key
                      ? "bg-white font-bold text-foreground shadow-sm dark:bg-background"
                      : "text-muted-foreground hover:bg-white/50 dark:hover:bg-background/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Quality Level */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Quality Level
            </label>
            <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted p-1">
              {(["low", "medium", "high"] as Quality[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuality(q)}
                  className={`rounded-lg px-2 py-1.5 text-xs font-medium capitalize transition-colors ${
                    quality === q
                      ? "bg-primary font-bold text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-white/50 dark:hover:bg-background/50"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        {format === "original" && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            PNG images won&apos;t compress much in original format — use WebP
            or JPEG for better results
          </p>
        )}
      </div>

      {/* ── Results ── */}
      {entries.length > 0 && (
        <div className="rounded-xl bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:bg-background/70">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Compressed images</h2>
            <div className="flex items-center gap-4">
              <button
                onClick={clearAll}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                Clear all
              </button>
              {doneCount > 1 && (
                <button
                  onClick={downloadAll}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/80"
                >
                  <Download className="h-4 w-4" />
                  Download all
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {entries.map((entry) => {
              const pct =
                entry.status === "done"
                  ? savingsPct(entry.originalSize, entry.compressedSize)
                  : 0;

              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-4 rounded-xl bg-background p-4 transition-all hover:shadow-md"
                >
                  {/* Thumbnail */}
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={entry.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>

                  {/* File name + format badges */}
                  <div className="min-w-0 flex-grow">
                    <p className="truncate text-sm font-semibold">{entry.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      {entry.status === "compressing" && (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Compressing…</span>
                        </>
                      )}
                      {entry.status === "done" && (
                        <>
                          <span className="rounded bg-muted px-1.5 py-0.5 font-bold uppercase">
                            {FORMAT_LABELS[entry.originalType] ?? "IMG"}
                          </span>
                          {entry.outputType !== entry.originalType && (
                            <>
                              <ArrowRight className="h-3 w-3 shrink-0" />
                              <span className="rounded bg-purple-100 px-1.5 py-0.5 font-bold uppercase text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                {FORMAT_LABELS[entry.outputType] ?? "IMG"}
                              </span>
                            </>
                          )}
                          {entry.outputType === entry.originalType && (
                            <span className="rounded bg-muted px-1.5 py-0.5 font-bold uppercase">
                              {FORMAT_LABELS[entry.outputType] ?? "IMG"}
                            </span>
                          )}
                        </>
                      )}
                      {entry.status === "error" && (
                        <>
                          <AlertCircle className="h-3 w-3 text-destructive" />
                          <span className="text-destructive">Failed — unsupported image</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Sizes + savings badge */}
                  {entry.status === "done" && (
                    <div className="flex shrink-0 items-center gap-8 px-4">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(entry.originalSize)}
                        </p>
                        <p className="text-sm font-bold">
                          {formatBytes(entry.compressedSize)}
                        </p>
                      </div>
                      {pct > 0 ? (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          -{pct}%
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                          no change
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {entry.status === "done" && (
                      <button
                        onClick={() => downloadEntry(entry)}
                        className="rounded-lg p-2 text-primary transition-colors hover:bg-purple-100 dark:hover:bg-purple-950"
                        aria-label="Download"
                      >
                        <Download className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      onClick={() => removeEntry(entry.id)}
                      className="p-2 text-muted-foreground transition-colors hover:text-destructive"
                      aria-label="Remove"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
