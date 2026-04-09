"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface NavLinkProps {
  href: string;
  label: string;
  icon: LucideIcon;
}

export function NavLink({ href, label, icon: Icon }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      prefetch={true}
      className={cn(
        "flex items-center gap-3 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-foreground text-background"
          : "text-foreground/55 hover:text-foreground hover:translate-x-1"
      )}
    >
      <Icon className="h-6 w-6 shrink-0" strokeWidth={isActive ? 2 : 1.5} />
      {label}
    </Link>
  );
}
