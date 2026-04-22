"use server";

import { auth } from "@clerk/nextjs/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isValidSlug } from "@/lib/brands/slug";

const ALLOWED_MIME_LIST = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;
type AllowedMime = (typeof ALLOWED_MIME_LIST)[number];
const ALLOWED_MIME: ReadonlySet<string> = new Set(ALLOWED_MIME_LIST);
const MAX_BYTES = 5 * 1024 * 1024;

export type UploadKind =
  | "logo-primary"
  | "logo-alt"
  | "image-0"
  | "image-1"
  | "image-2"
  | "image-3"
  | "image-4";

const EXT_BY_MIME: Record<AllowedMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

// Path allowlist for delete: `<slug>/(logo-primary|logo-alt|image-[0-4]).(png|jpg|webp|svg)`.
// Prevents an authenticated admin from passing a traversal or cross-brand path.
const DELETE_PATH_RE = /^[a-z0-9]+(-[a-z0-9]+)*\/(logo-(primary|alt)|image-[0-4])\.(png|jpg|webp|svg)$/;

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

  const ext = EXT_BY_MIME[file.type as AllowedMime];
  const path = `${slug}/${kind}.${ext}`;

  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage
    .from("brand-assets")
    .upload(path, file, {
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

  if (!DELETE_PATH_RE.test(path)) throw new Error("Invalid asset path");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from("brand-assets").remove([path]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}
