"use client";

import * as React from "react";
import { useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastOptions {
  title: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive";
  /** Milliseconds before auto-dismiss; destructive toasts stay until closed. */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
  id: number;
}

// A tiny store so anything on the client (an editor callback, a hook) can
// raise a toast without threading props through the tree.
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return items;
}

const EMPTY: ToastItem[] = [];
function getServerSnapshot() {
  return EMPTY;
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function toast(options: ToastOptions): number {
  const id = nextId++;
  items = [...items, { ...options, id }];
  emit();
  const duration =
    options.duration ?? (options.variant === "destructive" ? null : 6000);
  if (duration !== null) setTimeout(() => dismissToast(id), duration);
  return id;
}

/**
 * Mount once, in the root layout. Polite toasts announce through the
 * status region; destructive ones through the alert region, so screen
 * readers hear failures without being interrupted by routine notices.
 */
export function Toaster() {
  const current = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const polite = current.filter((t) => t.variant !== "destructive");
  const assertive = current.filter((t) => t.variant === "destructive");

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {polite.map((t) => (
          <ToastCard key={t.id} item={t} />
        ))}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        className="pointer-events-none fixed bottom-4 right-4 z-[61] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
        style={{
          marginBottom: polite.length ? polite.length * 4.5 + "rem" : 0,
        }}
      >
        {assertive.map((t) => (
          <ToastCard key={t.id} item={t} />
        ))}
      </div>
    </>
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  const destructive = item.variant === "destructive";
  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-md border bg-background p-3 text-sm shadow-lg",
        destructive && "border-destructive/50",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className={cn("font-medium", destructive && "text-destructive")}>
          {item.title}
        </p>
        {item.description && (
          <p className="text-muted-foreground">{item.description}</p>
        )}
        {item.action && (
          <button
            type="button"
            className="text-sm font-medium underline underline-offset-4"
            onClick={() => {
              item.action?.onClick();
              dismissToast(item.id);
            }}
          >
            {item.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        className="-m-1 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={() => dismissToast(item.id)}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
