"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { usePathname } from "next/navigation";

interface BackLinkProps {
  href: string;
  label: string;
}

export function BackLink({ href, label }: BackLinkProps) {
  const pathname = usePathname();
  if (pathname === href) return null;

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10"
    >
      <ChevronLeft className="h-5 w-5" style={{ color: "#f0047f" }} />
      Back to {label}
    </Link>
  );
}
