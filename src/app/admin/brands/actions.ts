"use server";

import { auth } from "@clerk/nextjs/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isValidSlug } from "@/lib/brands/slug";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);
const MAX_BYTES = 5 * 1024 * 1024;

export type UploadKind =
  | "logo-primary"
  | "logo-alt"
  | "image-0"
  | "image-1"
  | "image-2"
  | "image-3"
  | "image-4";

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/svg+xml") return "svg";
  throw new Error("Unsupported mime");
}

export async function uploadBrandAsset(
  slug: string,
  kind: UploadKind,
  file: File
): Promise<{ url: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  if (!isValidSlug(slug)) throw new Error("Invalid slug");
  if (!ALLOWED_MIME.has(file.type)) throw new Error("Unsupported file type");
  if (file.size > MAX_BYTES) throw new Error("File too large (max 5 MB)");

  const ext = extFromMime(file.type);
  const path = `${slug}/${kind}.${ext}`;

  const admin = createSupabaseAdminClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await admin.storage
    .from("brand-assets")
    .upload(path, bytes, {
      contentType: file.type,
      upsert: true,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = admin.storage.from("brand-assets").getPublicUrl(path);
  // Bust cache so the edit page re-renders the new asset after overwriting.
  const url = `${data.publicUrl}?v=${Date.now()}`;
  return { url };
}

export async function deleteBrandAsset(path: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from("brand-assets").remove([path]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}
