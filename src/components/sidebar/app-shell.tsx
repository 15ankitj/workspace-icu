"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

/**
 * The workspace frame: a sticky sidebar on wider screens, and on phones a
 * top bar whose menu button opens the same sidebar as a sheet. The sheet
 * is keyed on the pathname so it closes itself after navigation.
 */
export function AppShell({
  sidebar,
  workspaceName,
  children,
}: {
  sidebar: ReactNode;
  workspaceName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <div className="sticky top-0 hidden h-screen w-64 shrink-0 border-r md:block">
        {sidebar}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur md:hidden">
          <MobileMenu key={pathname} title={workspaceName}>
            {sidebar}
          </MobileMenu>
          <span className="truncate text-sm font-medium">{workspaceName}</span>
        </header>
        {children}
      </div>
    </div>
  );
}

function MobileMenu({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Open workspace menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent title={`${title} menu`}>{children}</SheetContent>
    </Sheet>
  );
}
