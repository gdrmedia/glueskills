"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { buttonVariants } from "@/components/ui/button";
import type { BrandPack, BrandPalette } from "@/lib/brands/schema";
import { Plus, Pencil } from "lucide-react";

type BrandSummary = Pick<BrandPack, "slug" | "name" | "logo_primary_url"> & {
  palette?: BrandPalette;
};

async function fetchBrands(): Promise<BrandSummary[]> {
  const res = await fetch("/api/brands");
  if (!res.ok) throw new Error("Failed to load brands");
  const json = await res.json();
  return json.brands;
}

function Swatch({ color }: { color?: string }) {
  if (!color) return null;
  return (
    <span
      className="inline-block size-4 rounded-full border border-border align-middle"
      style={{ backgroundColor: color }}
      title={color}
    />
  );
}

export function BrandsTable() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-brands"],
    queryFn: fetchBrands,
    staleTime: 60_000,
  });

  if (isLoading) return <div className="rounded-xl border p-6 text-sm text-muted-foreground">Loading brands…</div>;
  if (error) return <div className="rounded-xl border p-6 text-sm text-destructive">Could not load brands.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-2xl font-extrabold tracking-tight">Brands</h1>
        <Link href="/admin/brands/new" className={buttonVariants({ variant: "default" })}>
          <Plus className="mr-2 size-4" /> New brand
        </Link>
      </div>

      {(!data || data.length === 0) ? (
        <div className="rounded-xl border p-6 text-sm text-muted-foreground">
          No brands yet. Click &quot;New brand&quot; to create your first one.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium">Logo</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Slug</th>
                <th className="px-4 py-2 font-medium">Palette</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.map((b) => (
                <tr key={b.slug} className="border-t">
                  <td className="px-4 py-3">
                    <img src={b.logo_primary_url} alt="" className="size-8 rounded object-contain" />
                  </td>
                  <td className="px-4 py-3 font-medium">{b.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{b.slug}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <Swatch color={b.palette?.primary} />
                      <Swatch color={b.palette?.secondary} />
                      <Swatch color={b.palette?.accent} />
                      <Swatch color={b.palette?.neutral} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/brands/${b.slug}`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                      aria-label={`Edit ${b.name}`}
                    >
                      <Pencil className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
