"use client";

import { Show, UserButton } from "@clerk/nextjs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { NavLink } from "./nav-link";
import { Separator } from "@/components/ui/separator";
import { FeedbackDialog } from "./feedback-dialog";
import { sections } from "./sidebar";

export function Header() {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-card px-4 md:px-6">
      <Sheet>
        <SheetTrigger
          render={<Button variant="ghost" size="icon" className="md:hidden" />}
        >
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-56 p-0">
          <div className="flex h-14 items-center px-4 font-semibold tracking-tight">
            <img src="/glueskills-logo.png" alt="GlueSkills" className="h-[2.5rem]" />
          </div>
          <Separator />
          <nav className="flex flex-col gap-1 p-3">
            {sections.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <div className="flex-1" />

      <FeedbackDialog />

      <Show when="signed-in">
        <UserButton />
      </Show>
    </header>
  );
}
