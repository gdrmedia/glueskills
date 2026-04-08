"use client";

import { Show, UserButton } from "@clerk/nextjs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { NavLink } from "./nav-link";
import { FeedbackDialog } from "./feedback-dialog";
import { sections } from "./sidebar";

export function Header() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 bg-background/70 backdrop-blur-xl px-4 md:px-6">
      <Sheet>
        <SheetTrigger
          render={<Button variant="ghost" size="icon" className="md:hidden" />}
        >
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 bg-background border-none">
          <div className="flex h-16 items-center px-6">
            <img src="/glueskills-logo.png" alt="GlueSkills" className="h-[2.5rem]" />
          </div>
          <nav className="flex flex-col gap-0.5 px-4 py-2">
            {sections.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <div className="flex-1" />

      <FeedbackDialog />

      <div className="h-6 w-px bg-foreground/10" />

      <Show when="signed-in">
        <UserButton />
      </Show>
    </header>
  );
}
