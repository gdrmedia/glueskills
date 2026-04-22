"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Save, Trash2 } from "lucide-react";
import { ColorInput } from "./color-input";
import { ImageSlot } from "./image-slot";
import { toSlug } from "@/lib/brands/slug";
import { brandPackInputSchema, MAX_IMAGES, type BrandPack } from "@/lib/brands/schema";
import type { UploadKind } from "@/app/admin/brands/actions";

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  initial?: BrandPack;
};

type FormState = {
  name: string;
  slug: string;
  slugManuallyEdited: boolean;
  palette: { primary: string; secondary: string; accent: string; neutral: string };
  font: {
    family: string;
    fallback: string;
    weights: { bold: string; semi: string; regular: string };
  };
  logo_primary_url: string | null;
  logo_alt_url: string | null;
  images: Array<{ url: string | null; label: string }>;
};

function initialState(initial?: BrandPack): FormState {
  return {
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    slugManuallyEdited: !!initial,
    palette: {
      primary: initial?.palette.primary ?? "",
      secondary: initial?.palette.secondary ?? "",
      accent: initial?.palette.accent ?? "",
      neutral: initial?.palette.neutral ?? "",
    },
    font: {
      family: initial?.font.family ?? "Inter",
      fallback: initial?.font.fallback ?? "Arial",
      weights: {
        bold: initial?.font.weights.bold ?? "Bold",
        semi: initial?.font.weights.semi ?? "Semi Bold",
        regular: initial?.font.weights.regular ?? "Regular",
      },
    },
    logo_primary_url: initial?.logo_primary_url ?? null,
    logo_alt_url: initial?.logo_alt_url ?? null,
    images: Array.from({ length: MAX_IMAGES }, (_, i) => {
      const existing = (initial?.images ?? []).find((x) => x.sort_order === i);
      return { url: existing?.url ?? null, label: existing?.label ?? "" };
    }),
  };
}

export function BrandForm({ mode, initial }: Props) {
  const router = useRouter();
  const [f, setF] = useState<FormState>(() => initialState(initial));
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const effectiveSlug = useMemo(
    () => (f.slugManuallyEdited ? f.slug : toSlug(f.name)),
    [f.name, f.slug, f.slugManuallyEdited]
  );

  function buildPayload() {
    const images = f.images
      .map((img, i) =>
        img.url
          ? { url: img.url, label: img.label.trim() || undefined, sort_order: i }
          : null
      )
      .filter(Boolean) as Array<{ url: string; label?: string; sort_order: number }>;

    const palette = {
      primary: f.palette.primary.trim(),
      secondary: f.palette.secondary.trim(),
      ...(f.palette.accent.trim() ? { accent: f.palette.accent.trim() } : {}),
      ...(f.palette.neutral.trim() ? { neutral: f.palette.neutral.trim() } : {}),
    };

    return {
      slug: effectiveSlug,
      name: f.name.trim(),
      palette,
      font: {
        family: f.font.family.trim(),
        fallback: f.font.fallback.trim(),
        weights: {
          bold: f.font.weights.bold.trim(),
          semi: f.font.weights.semi.trim(),
          regular: f.font.weights.regular.trim(),
        },
      },
      logo_primary_url: f.logo_primary_url ?? "",
      logo_alt_url: f.logo_alt_url,
      images: images.length ? images : null,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const payload = buildPayload();
    const parsed = brandPackInputSchema.safeParse(payload);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(`${first.path.join(".")}: ${first.message}`);
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "create") {
        const res = await fetch("/api/brands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed" }));
          toast.error(err.error || "Failed to create brand");
          return;
        }
        toast.success("Brand created");
        router.push(`/admin/brands/${parsed.data.slug}`);
      } else {
        const res = await fetch(`/api/brands/${initial!.slug}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed" }));
          toast.error(err.error || "Failed to update brand");
          return;
        }
        toast.success("Saved");
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!initial) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/brands/${initial.slug}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete");
        return;
      }
      toast.success("Deleted");
      router.push("/admin/brands");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Identity */}
      <section className="space-y-4 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Identity</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              placeholder="ACME"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={effectiveSlug}
              onChange={(e) => setF({ ...f, slug: e.target.value, slugManuallyEdited: true })}
              disabled={mode === "edit"}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              {mode === "edit"
                ? "Slug cannot be changed after creation."
                : "URL-safe. Auto-generated from name; override if needed."}
            </p>
          </div>
        </div>
      </section>

      {/* Palette */}
      <section className="space-y-4 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Palette</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ColorInput
            id="primary"
            label="Primary"
            required
            value={f.palette.primary}
            onChange={(v) => setF({ ...f, palette: { ...f.palette, primary: v } })}
          />
          <ColorInput
            id="secondary"
            label="Secondary"
            required
            value={f.palette.secondary}
            onChange={(v) => setF({ ...f, palette: { ...f.palette, secondary: v } })}
          />
          <ColorInput
            id="accent"
            label="Accent"
            value={f.palette.accent}
            onChange={(v) => setF({ ...f, palette: { ...f.palette, accent: v } })}
          />
          <ColorInput
            id="neutral"
            label="Neutral"
            value={f.palette.neutral}
            onChange={(v) => setF({ ...f, palette: { ...f.palette, neutral: v } })}
          />
        </div>
      </section>

      {/* Typography */}
      <section className="space-y-4 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Typography</h2>
        <p className="text-xs text-muted-foreground">
          Weight style names must match the Figma font exactly (e.g. &quot;Semi Bold&quot; not &quot;SemiBold&quot;). Figma is strict.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="font-family">Font family</Label>
            <Input
              id="font-family"
              value={f.font.family}
              onChange={(e) => setF({ ...f, font: { ...f.font, family: e.target.value } })}
              placeholder="Inter"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="font-fallback">Fallback family</Label>
            <Input
              id="font-fallback"
              value={f.font.fallback}
              onChange={(e) => setF({ ...f, font: { ...f.font, fallback: e.target.value } })}
              placeholder="Arial"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="w-bold">Bold weight style</Label>
            <Input
              id="w-bold"
              value={f.font.weights.bold}
              onChange={(e) =>
                setF({ ...f, font: { ...f.font, weights: { ...f.font.weights, bold: e.target.value } } })
              }
              placeholder="Bold"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="w-semi">Semi weight style</Label>
            <Input
              id="w-semi"
              value={f.font.weights.semi}
              onChange={(e) =>
                setF({ ...f, font: { ...f.font, weights: { ...f.font.weights, semi: e.target.value } } })
              }
              placeholder="Semi Bold"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="w-reg">Regular weight style</Label>
            <Input
              id="w-reg"
              value={f.font.weights.regular}
              onChange={(e) =>
                setF({ ...f, font: { ...f.font, weights: { ...f.font.weights, regular: e.target.value } } })
              }
              placeholder="Regular"
            />
          </div>
        </div>
      </section>

      {/* Logos */}
      <section className="space-y-4 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Logos</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ImageSlot
            slug={effectiveSlug}
            kind="logo-primary"
            label="Primary logo"
            required
            value={f.logo_primary_url}
            onChange={(x) => setF({ ...f, logo_primary_url: x.url })}
          />
          <ImageSlot
            slug={effectiveSlug}
            kind="logo-alt"
            label="Alt logo"
            value={f.logo_alt_url}
            onChange={(x) => setF({ ...f, logo_alt_url: x.url })}
          />
        </div>
      </section>

      {/* Images */}
      <section className="space-y-4 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Imagery (up to 5)</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {f.images.map((img, i) => (
            <ImageSlot
              key={i}
              slug={effectiveSlug}
              kind={`image-${i}` as UploadKind}
              label={`Image ${i + 1}`}
              value={img.url}
              labelValue={img.label}
              showLabelField
              onChange={(x) => {
                const next = [...f.images];
                next[i] = { url: x.url, label: x.label ?? "" };
                setF({ ...f, images: next });
              }}
            />
          ))}
        </div>
      </section>

      <Separator />

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Save className="mr-2 size-4" />
          )}
          {mode === "create" ? "Create brand" : "Save changes"}
        </Button>

        {mode === "edit" && (
          <AlertDialog>
            <AlertDialogTrigger render={<Button type="button" variant="outline" />}>
              <Trash2 className="mr-2 size-4" /> Delete
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete &quot;{initial?.name}&quot;?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the brand record. Uploaded files stay in Storage. The Figma plugin
                  will stop returning this brand immediately.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Deleting…" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </form>
  );
}
