"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadBrandAsset, type UploadKind } from "@/app/admin/brands/actions";

type Props = {
  slug: string;
  kind: UploadKind;
  label: string;
  required?: boolean;
  value: string | null;               // current URL
  labelValue?: string;                // optional caption
  onChange: (next: { url: string | null; label?: string }) => void;
  showLabelField?: boolean;
};

export function ImageSlot({ slug, kind, label, required, value, labelValue, onChange, showLabelField }: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Latest labelValue so handlePick sees edits made during the upload.
  const labelValueRef = useRef(labelValue);
  labelValueRef.current = labelValue;

  async function handlePick(file: File) {
    if (uploading) return;
    if (!slug) {
      toast.error("Set a slug before uploading assets.");
      return;
    }
    setUploading(true);
    try {
      const { url } = await uploadBrandAsset(slug, kind, file);
      onChange({ url, label: labelValueRef.current });
      toast.success("Uploaded");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Label>
        {label}
        {!required && <span className="text-muted-foreground font-normal"> (optional)</span>}
      </Label>

      {value ? (
        <div className="flex items-center gap-3">
          <img src={value} alt="" className="size-16 rounded border border-border object-contain" />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UploadCloud className="mr-2 size-4" />}
              Replace
            </Button>
            {!required && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange({ url: null, label: labelValue })}
                aria-label="Remove image"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UploadCloud className="mr-2 size-4" />}
          Upload
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handlePick(f);
        }}
      />

      {showLabelField && (
        <div className="space-y-1">
          <Label className="text-xs">Label</Label>
          <Input
            value={labelValue ?? ""}
            onChange={(e) => onChange({ url: value, label: e.target.value })}
            placeholder="e.g. Hero hero shot"
          />
        </div>
      )}
    </div>
  );
}
