"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { Menu, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MOBILE_BAR_SLOT_ID } from "@/components/page/page-top-bar";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "sidebar-collapsed";
const CHANGE_EVENT = "sidebar-collapsed-change";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Preference simply does not persist.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribeCollapsed(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/**
 * The workspace frame. Wide screens: a sticky sidebar that collapses to a
 * rail (⌘\ or the header button) and peeks back out on hover. Phones: one
 * top bar with the menu button and a slot the open page fills with its
 * own essentials (parent crumb, favourite, menu); the sidebar opens as a
 * sheet, keyed on the pathname so it closes itself after navigation.
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
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsed,
    () => false,
  );
  const [peeking, setPeeking] = useState(false);

  const toggle = useCallback(() => writeCollapsed(!readCollapsed()), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <SidebarCollapseContext.Provider value={{ collapsed, toggle }}>
      <div className="flex min-h-screen">
        {/* Wide screens */}
        <div
          className={cn(
            "relative hidden shrink-0 md:block",
            collapsed ? "w-12" : "w-64",
          )}
          onMouseLeave={() => setPeeking(false)}
        >
          {collapsed ? (
            <div
              className="sticky top-0 flex h-screen w-12 flex-col items-center gap-1 border-r bg-sidebar py-2"
              onMouseEnter={() => setPeeking(true)}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                aria-label="Expand sidebar"
                title="Expand sidebar (⌘\)"
                onClick={toggle}
              >
                <PanelLeft />
              </Button>
            </div>
          ) : (
            <div className="sticky top-0 h-screen w-64 border-r">{sidebar}</div>
          )}
          {collapsed && peeking && (
            <div
              className="absolute inset-y-0 left-12 z-40 w-64 border-r bg-sidebar shadow-lg"
              onMouseEnter={() => setPeeking(true)}
            >
              <div className="sticky top-0 h-screen">{sidebar}</div>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Phones */}
          <header className="sticky top-0 z-40 flex items-center gap-1 border-b bg-background/95 px-2 py-1 backdrop-blur md:hidden">
            <MobileMenu key={pathname} title={workspaceName}>
              {sidebar}
            </MobileMenu>
            <div
              id={MOBILE_BAR_SLOT_ID}
              className="group flex min-w-0 flex-1 items-center"
            >
              <span className="truncate px-1 text-sm font-medium group-has-[[data-page-bar]]:hidden">
                {workspaceName}
              </span>
            </div>
          </header>
          {children}
        </div>
      </div>
    </SidebarCollapseContext.Provider>
  );
}

import { createContext, useContext } from "react";

const SidebarCollapseContext = createContext<{
  collapsed: boolean;
  toggle: () => void;
}>({ collapsed: false, toggle: () => {} });

/** The sidebar's own collapse button reads this. */
export function useSidebarCollapse() {
  return useContext(SidebarCollapseContext);
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
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open workspace menu"
          className="size-11"
        >
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent title={`${title} menu`}>{children}</SheetContent>
    </Sheet>
  );
}
