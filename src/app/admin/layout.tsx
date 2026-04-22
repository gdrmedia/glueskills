import Link from "next/link";
import { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/admin/brands" className="font-headline text-sm font-semibold">
            GlueSkills · Admin
          </Link>
          <nav aria-label="Admin" className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/admin/brands" className="hover:text-foreground">Brands</Link>
          </nav>
          <div className="ml-auto">
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to app
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <Toaster />
    </div>
  );
}
