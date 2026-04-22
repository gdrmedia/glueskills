import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { BrandForm } from "@/components/brands/brand-form";
import type { BrandPack } from "@/lib/brands/schema";

type PageProps = { params: Promise<{ slug: string }> };

async function fetchBrand(slug: string): Promise<BrandPack | null> {
  const h = await headers();
  const host = h.get("host");
  if (!host) throw new Error("Missing host header");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const res = await fetch(`${proto}://${host}/api/brands/${slug}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load brand");
  return res.json();
}

export default async function EditBrandPage({ params }: PageProps) {
  const { slug } = await params;
  const brand = await fetchBrand(slug);
  if (!brand) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-extrabold tracking-tight">{brand.name}</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{brand.slug}</p>
      </div>
      <BrandForm mode="edit" initial={brand} />
    </div>
  );
}
